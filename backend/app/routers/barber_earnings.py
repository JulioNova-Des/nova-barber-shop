"""
Contabilidad del barbero — NOVA BARBER SHOP
==============================================
Sistema de balance personal para cada barbero. Solo ve SUS propias
cuentas (filtrado por barber_id del usuario autenticado).

Endpoints:
  GET /barber/balance            → Resumen actual: hoy + semana (dom-dom) + mes
  GET /barber/balance/day        → Detalle de un día: cada servicio como línea
  GET /barber/balance/week       → Detalle de una semana (dom a sáb): día a día
  GET /barber/balance/month      → Detalle de un mes completo: día a día + por servicio
  GET /barber/balance/history    → Lista de todos los meses con datos (para navegar)

La semana de NOVA va de DOMINGO a SÁBADO (como opera la barbería).
"""

from datetime import date as date_type, datetime, timedelta
from typing import Dict, List, Optional
import calendar

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_barber
from app.models.models import Appointment, AppointmentStatus, Barber, Service, User


router_earnings = APIRouter(prefix="/barber", tags=["barber-balance"])

DOW_NAMES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


# ==================== Schemas ====================

class ServiceLineItem(BaseModel):
    """Una línea en el estado de cuenta: un servicio completado."""
    appointment_id: int
    time: str              # "08:30"
    client_name: str
    service_name: str
    service_price: int     # precio bruto del servicio
    barber_pct: int        # porcentaje aplicado (ej: 60)
    barber_amount: int     # lo que le toca al barbero
    shop_amount: int       # lo que se queda la barbería


class DaySummary(BaseModel):
    """Resumen de un día."""
    date: date_type
    day_label: str         # "dom 24 ago"
    completed_count: int
    no_show_count: int
    gross_revenue: int
    barber_total: int
    shop_total: int
    avg_pct: float         # porcentaje promedio ponderado del día


class DayDetail(BaseModel):
    """Detalle completo de un día con cada servicio listado."""
    date: date_type
    day_label: str
    summary: DaySummary
    line_items: List[ServiceLineItem]


class ServiceBreakdown(BaseModel):
    """Cuántos de cada servicio hizo y cuánto le dejó."""
    service_name: str
    count: int
    gross_revenue: int
    barber_total: int


class WeekDetail(BaseModel):
    """Una semana de domingo a sábado."""
    week_label: str        # "Sem 18 ago – 24 ago"
    from_date: date_type
    to_date: date_type
    completed_count: int
    gross_revenue: int
    barber_total: int
    shop_total: int
    avg_pct: float
    days: List[DaySummary]


class MonthDetail(BaseModel):
    """Un mes completo con desglose día a día y por servicio."""
    month_label: str       # "Agosto 2026"
    year: int
    month: int
    from_date: date_type
    to_date: date_type
    completed_count: int
    no_show_count: int
    gross_revenue: int
    barber_total: int
    shop_total: int
    avg_pct: float
    days: List[DaySummary]
    weeks: List[WeekDetail]
    by_service: List[ServiceBreakdown]


class BalanceOverview(BaseModel):
    """Vista principal: resumen rápido de hoy + semana + mes."""
    barber_id: int
    barber_name: str
    today: DaySummary
    today_items: List[ServiceLineItem]  # detalle del día actual
    current_week: WeekDetail
    current_month: MonthDetail


class MonthHistoryItem(BaseModel):
    year: int
    month: int
    month_label: str       # "Agosto 2026"
    completed_count: int
    gross_revenue: int
    barber_total: int


# ==================== Helpers ====================

def _get_barber(current_user: User, session: Session) -> Barber:
    barber = session.exec(select(Barber).where(Barber.user_id == current_user.id)).first()
    if not barber:
        raise HTTPException(404, "Perfil de barbero no encontrado.")
    return barber


def _sunday_week_start(d: date_type) -> date_type:
    """Devuelve el domingo al inicio de la semana que contiene `d`.
    Python weekday: Mon=0 ... Sun=6. Queremos que dom sea el inicio."""
    days_since_sunday = (d.weekday() + 1) % 7
    return d - timedelta(days=days_since_sunday)


def _day_label(d: date_type) -> str:
    dow = DOW_NAMES[d.weekday()]
    months = ["", "ene", "feb", "mar", "abr", "may", "jun",
              "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{dow} {d.day} {months[d.month]}"


def _month_label(year: int, month: int) -> str:
    names = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return f"{names[month]} {year}"


def _fetch_completed(
    session: Session, barber_id: int, from_dt: datetime, to_dt: datetime
) -> List[Appointment]:
    return list(session.exec(
        select(Appointment)
        .where(Appointment.barber_id == barber_id)
        .where(Appointment.status == AppointmentStatus.COMPLETED)
        .where(Appointment.start_time >= from_dt)
        .where(Appointment.start_time < to_dt)
        .order_by(Appointment.start_time)
    ).all())


def _fetch_all_statuses(
    session: Session, barber_id: int, from_dt: datetime, to_dt: datetime
) -> List[Appointment]:
    return list(session.exec(
        select(Appointment)
        .where(Appointment.barber_id == barber_id)
        .where(Appointment.start_time >= from_dt)
        .where(Appointment.start_time < to_dt)
        .order_by(Appointment.start_time)
    ).all())


def _to_line_item(appt: Appointment, services: Dict[int, Service], session: Session) -> ServiceLineItem:
    service = services.get(appt.service_id)
    if appt.client_id:
        client = session.get(User, appt.client_id)
        client_name = client.full_name if client else "Cliente"
    else:
        client_name = appt.guest_name or "Invitado"

    return ServiceLineItem(
        appointment_id=appt.id,
        time=appt.start_time.strftime("%H:%M"),
        client_name=client_name,
        service_name=service.name if service else "—",
        service_price=service.price if service else 0,
        barber_pct=appt.barber_pct_snapshot or 0,
        barber_amount=appt.barber_amount or 0,
        shop_amount=appt.shop_amount or 0,
    )


def _build_day_summary(
    d: date_type, all_appts: List[Appointment], services: Dict[int, Service]
) -> DaySummary:
    completed = [a for a in all_appts
                 if a.start_time.date() == d and a.status == AppointmentStatus.COMPLETED]
    no_shows = [a for a in all_appts
                if a.start_time.date() == d and a.status == AppointmentStatus.NO_SHOW]
    gross = sum(services[a.service_id].price for a in completed if a.service_id in services)
    barber_total = sum(a.barber_amount or 0 for a in completed)
    shop_total = sum(a.shop_amount or 0 for a in completed)
    pct_sum = sum(a.barber_pct_snapshot or 0 for a in completed)
    avg_pct = round(pct_sum / len(completed), 1) if completed else 0.0

    return DaySummary(
        date=d,
        day_label=_day_label(d),
        completed_count=len(completed),
        no_show_count=len(no_shows),
        gross_revenue=gross,
        barber_total=barber_total,
        shop_total=shop_total,
        avg_pct=avg_pct,
    )


def _build_week_detail(
    week_start: date_type,
    all_appts: List[Appointment],
    services: Dict[int, Service],
    cap_date: Optional[date_type] = None,
) -> WeekDetail:
    week_end = week_start + timedelta(days=6)
    if cap_date:
        week_end = min(week_end, cap_date)

    days = []
    cursor = week_start
    while cursor <= week_end:
        days.append(_build_day_summary(cursor, all_appts, services))
        cursor += timedelta(days=1)

    completed_count = sum(d.completed_count for d in days)
    gross = sum(d.gross_revenue for d in days)
    barber_total = sum(d.barber_total for d in days)
    shop_total = sum(d.shop_total for d in days)
    pct_sum = sum(d.avg_pct * d.completed_count for d in days)
    avg_pct = round(pct_sum / completed_count, 1) if completed_count else 0.0

    return WeekDetail(
        week_label=f"Sem {week_start.day} {['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][week_start.month]} – {week_end.day} {['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][week_end.month]}",
        from_date=week_start,
        to_date=week_end,
        completed_count=completed_count,
        gross_revenue=gross,
        barber_total=barber_total,
        shop_total=shop_total,
        avg_pct=avg_pct,
        days=days,
    )


def _build_service_breakdown(
    completed: List[Appointment], services: Dict[int, Service]
) -> List[ServiceBreakdown]:
    by_svc: Dict[int, dict] = {}
    for a in completed:
        e = by_svc.setdefault(a.service_id, {"count": 0, "gross": 0, "barber": 0})
        e["count"] += 1
        e["gross"] += services[a.service_id].price if a.service_id in services else 0
        e["barber"] += a.barber_amount or 0
    return sorted([
        ServiceBreakdown(
            service_name=services[sid].name if sid in services else f"#{sid}",
            count=d["count"],
            gross_revenue=d["gross"],
            barber_total=d["barber"],
        )
        for sid, d in by_svc.items()
    ], key=lambda s: s.barber_total, reverse=True)


def _build_month_detail(
    year: int, month: int,
    all_appts: List[Appointment],
    services: Dict[int, Service],
    cap_date: Optional[date_type] = None,
) -> MonthDetail:
    month_start = date_type(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    month_end = date_type(year, month, last_day)
    if cap_date:
        month_end = min(month_end, cap_date)

    days = []
    cursor = month_start
    while cursor <= month_end:
        days.append(_build_day_summary(cursor, all_appts, services))
        cursor += timedelta(days=1)

    completed_in_month = [
        a for a in all_appts
        if month_start <= a.start_time.date() <= month_end
        and a.status == AppointmentStatus.COMPLETED
    ]
    no_shows_in_month = [
        a for a in all_appts
        if month_start <= a.start_time.date() <= month_end
        and a.status == AppointmentStatus.NO_SHOW
    ]

    gross = sum(d.gross_revenue for d in days)
    barber_total = sum(d.barber_total for d in days)
    shop_total = sum(d.shop_total for d in days)
    pct_sum = sum(d.avg_pct * d.completed_count for d in days)
    total_completed = sum(d.completed_count for d in days)
    avg_pct = round(pct_sum / total_completed, 1) if total_completed else 0.0

    # Semanas del mes (dom a sáb)
    weeks = []
    ws = _sunday_week_start(month_start)
    if ws < month_start:
        ws = month_start
    while ws <= month_end:
        weeks.append(_build_week_detail(ws, all_appts, services, cap_date=month_end))
        ws += timedelta(days=7)
        if ws.month != month and ws > month_end:
            break

    return MonthDetail(
        month_label=_month_label(year, month),
        year=year,
        month=month,
        from_date=month_start,
        to_date=month_end,
        completed_count=total_completed,
        no_show_count=len(no_shows_in_month),
        gross_revenue=gross,
        barber_total=barber_total,
        shop_total=shop_total,
        avg_pct=avg_pct,
        days=days,
        weeks=weeks,
        by_service=_build_service_breakdown(completed_in_month, services),
    )


# ==================== Endpoints ====================

@router_earnings.get("/balance", response_model=BalanceOverview)
def my_balance(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """Vista principal del barbero: resumen de hoy, semana actual
    (dom-sáb) y mes en curso, con el detalle servicio por servicio del
    día actual."""
    barber = _get_barber(current_user, session)
    today = date_type.today()

    month_start = today.replace(day=1)
    fetch_from = datetime.combine(month_start, datetime.min.time())
    fetch_to = datetime.combine(today + timedelta(days=1), datetime.min.time())

    all_appts = _fetch_all_statuses(session, barber.id, fetch_from, fetch_to)
    completed = [a for a in all_appts if a.status == AppointmentStatus.COMPLETED]
    services = {s.id: s for s in session.exec(select(Service)).all()}

    today_summary = _build_day_summary(today, all_appts, services)
    today_completed = [a for a in completed if a.start_time.date() == today]
    today_items = [_to_line_item(a, services, session) for a in today_completed]

    week_start = _sunday_week_start(today)
    if week_start < month_start:
        extra_from = datetime.combine(week_start, datetime.min.time())
        extra_appts = _fetch_all_statuses(session, barber.id, extra_from, fetch_from)
        all_appts_extended = extra_appts + all_appts
    else:
        all_appts_extended = all_appts

    current_week = _build_week_detail(week_start, all_appts_extended, services, cap_date=today)
    current_month = _build_month_detail(today.year, today.month, all_appts, services, cap_date=today)

    return BalanceOverview(
        barber_id=barber.id,
        barber_name=current_user.full_name,
        today=today_summary,
        today_items=today_items,
        current_week=current_week,
        current_month=current_month,
    )


@router_earnings.get("/balance/day", response_model=DayDetail)
def balance_day(
    date: date_type = Query(..., description="Fecha del día a consultar (YYYY-MM-DD)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """Detalle completo de un día específico: cada servicio como línea
    de estado de cuenta."""
    barber = _get_barber(current_user, session)
    from_dt = datetime.combine(date, datetime.min.time())
    to_dt = from_dt + timedelta(days=1)

    all_appts = _fetch_all_statuses(session, barber.id, from_dt, to_dt)
    completed = [a for a in all_appts if a.status == AppointmentStatus.COMPLETED]
    services = {s.id: s for s in session.exec(select(Service)).all()}

    summary = _build_day_summary(date, all_appts, services)
    items = [_to_line_item(a, services, session) for a in completed]

    return DayDetail(date=date, day_label=_day_label(date), summary=summary, line_items=items)


@router_earnings.get("/balance/week", response_model=WeekDetail)
def balance_week(
    date: date_type = Query(
        None, description="Cualquier fecha dentro de la semana a consultar. Default: semana actual."
    ),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """Detalle de una semana (dom-sáb) con resumen día a día."""
    barber = _get_barber(current_user, session)
    ref = date or date_type.today()
    week_start = _sunday_week_start(ref)
    week_end = week_start + timedelta(days=6)

    from_dt = datetime.combine(week_start, datetime.min.time())
    to_dt = datetime.combine(week_end + timedelta(days=1), datetime.min.time())

    all_appts = _fetch_all_statuses(session, barber.id, from_dt, to_dt)
    services = {s.id: s for s in session.exec(select(Service)).all()}

    today = date_type.today()
    cap = today if week_end >= today else None
    return _build_week_detail(week_start, all_appts, services, cap_date=cap)


@router_earnings.get("/balance/month", response_model=MonthDetail)
def balance_month(
    year: int = Query(None, description="Año. Default: año actual."),
    month: int = Query(None, ge=1, le=12, description="Mes (1-12). Default: mes actual."),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """Detalle completo de un mes: día a día, semana a semana, y desglose
    por tipo de servicio. Sirve para navegar meses históricos."""
    barber = _get_barber(current_user, session)
    today = date_type.today()
    y = year or today.year
    m = month or today.month

    month_start = date_type(y, m, 1)
    _, last_day = calendar.monthrange(y, m)
    month_end = date_type(y, m, last_day)

    from_dt = datetime.combine(month_start, datetime.min.time())
    to_dt = datetime.combine(month_end + timedelta(days=1), datetime.min.time())

    all_appts = _fetch_all_statuses(session, barber.id, from_dt, to_dt)
    services = {s.id: s for s in session.exec(select(Service)).all()}

    cap = today if month_end >= today else None
    return _build_month_detail(y, m, all_appts, services, cap_date=cap)


@router_earnings.get("/balance/history", response_model=List[MonthHistoryItem])
def balance_history(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """Lista de todos los meses en los que el barbero tiene citas completadas,
    ordenados de más reciente a más antiguo. Sirve para el navegador de
    meses históricos."""
    barber = _get_barber(current_user, session)

    all_completed = session.exec(
        select(Appointment)
        .where(Appointment.barber_id == barber.id)
        .where(Appointment.status == AppointmentStatus.COMPLETED)
        .order_by(Appointment.start_time.desc())
    ).all()

    services = {s.id: s for s in session.exec(select(Service)).all()}

    months_seen: Dict[str, dict] = {}
    for a in all_completed:
        key = f"{a.start_time.year}-{a.start_time.month:02d}"
        e = months_seen.setdefault(key, {"year": a.start_time.year, "month": a.start_time.month,
                                          "count": 0, "gross": 0, "barber": 0})
        e["count"] += 1
        e["gross"] += services[a.service_id].price if a.service_id in services else 0
        e["barber"] += a.barber_amount or 0

    return sorted([
        MonthHistoryItem(
            year=d["year"],
            month=d["month"],
            month_label=_month_label(d["year"], d["month"]),
            completed_count=d["count"],
            gross_revenue=d["gross"],
            barber_total=d["barber"],
        )
        for d in months_seen.values()
    ], key=lambda m: (m.year, m.month), reverse=True)
