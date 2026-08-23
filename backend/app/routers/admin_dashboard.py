"""
Dashboard financiero — NOVA BARBER SHOP (Admin/Propietario)
================================================================
GET /admin/dashboard agrega, sobre un rango de fechas (y opcionalmente
una sucursal), los datos que el propietario necesita:
- Totales brutos + split barbero/barberia
- Desglose por sucursal y servicio
- Ranking de barberos con sus ganancias reales
- Tasa de no-show

Solo cuentan como ingreso las citas con status=COMPLETED.
Los montos de split se toman de barber_amount/shop_amount snapshot-eados
en el Appointment al momento de completar — son inmutables y exactos.
"""

from datetime import date as date_type, datetime, timedelta
from typing import Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.models import Appointment, AppointmentStatus, Barber, Branch, Service, User
from app.schemas.dashboard import (
    BarberPerformance,
    DashboardResponse,
    RevenueByBranch,
    RevenueByService,
)

router = APIRouter(
    prefix="/admin/dashboard", tags=["admin"], dependencies=[Depends(get_current_admin)]
)


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    date_from: Optional[date_type] = Query(None, description="Default: hace 30 dias"),
    date_to: Optional[date_type] = Query(None, description="Default: hoy"),
    branch_id: Optional[int] = Query(None, description="Filtrar por sucursal"),
    session: Session = Depends(get_session),
):
    date_to = date_to or date_type.today()
    date_from = date_from or (date_to - timedelta(days=30))

    range_start = datetime.combine(date_from, datetime.min.time())
    range_end = datetime.combine(date_to, datetime.min.time()) + timedelta(days=1)

    stmt = (
        select(Appointment)
        .where(Appointment.start_time >= range_start)
        .where(Appointment.start_time < range_end)
    )
    if branch_id:
        stmt = stmt.where(Appointment.branch_id == branch_id)

    appointments = session.exec(stmt).all()

    completed = [a for a in appointments if a.status == AppointmentStatus.COMPLETED]
    no_shows  = [a for a in appointments if a.status == AppointmentStatus.NO_SHOW]
    cancelled = [a for a in appointments if a.status == AppointmentStatus.CANCELLED]
    scheduled = [a for a in appointments if a.status == AppointmentStatus.SCHEDULED]

    services = {s.id: s for s in session.exec(select(Service)).all()}
    branches = {b.id: b for b in session.exec(select(Branch)).all()}
    barbers  = {b.id: b for b in session.exec(select(Barber)).all()}
    users    = {u.id: u for u in session.exec(select(User)).all()}

    total_gross   = sum(services[a.service_id].price for a in completed if a.service_id in services)
    total_barber  = sum(a.barber_amount or 0 for a in completed)
    total_shop    = sum(a.shop_amount or 0 for a in completed)

    # Por sucursal
    rev_branch: Dict[int, dict] = {}
    for a in completed:
        e = rev_branch.setdefault(a.branch_id, {"completed_count": 0, "gross_revenue": 0, "barber_total": 0, "shop_total": 0})
        e["completed_count"] += 1
        e["gross_revenue"]   += services[a.service_id].price if a.service_id in services else 0
        e["barber_total"]    += a.barber_amount or 0
        e["shop_total"]      += a.shop_amount or 0

    # Por servicio
    rev_service: Dict[int, dict] = {}
    for a in completed:
        e = rev_service.setdefault(a.service_id, {"completed_count": 0, "revenue": 0})
        e["completed_count"] += 1
        e["revenue"]         += services[a.service_id].price if a.service_id in services else 0

    # Por barbero (completed + no_shows para medir confiabilidad)
    perf: Dict[int, dict] = {}
    for a in appointments:
        if not a.barber_id:
            continue
        e = perf.setdefault(a.barber_id, {"completed_count": 0, "no_show_count": 0,
                                           "gross_revenue": 0, "barber_total": 0,
                                           "shop_total": 0, "pct_sum": 0})
        if a.status == AppointmentStatus.COMPLETED:
            price = services[a.service_id].price if a.service_id in services else 0
            e["completed_count"] += 1
            e["gross_revenue"]   += price
            e["barber_total"]    += a.barber_amount or 0
            e["shop_total"]      += a.shop_amount or 0
            e["pct_sum"]         += a.barber_pct_snapshot or 0
        elif a.status == AppointmentStatus.NO_SHOW:
            e["no_show_count"] += 1

    revenue_by_branch = [
        RevenueByBranch(
            branch_id=bid,
            branch_name=branches[bid].name if bid in branches else f"Sucursal #{bid}",
            **data,
        )
        for bid, data in rev_branch.items()
    ]

    revenue_by_service = [
        RevenueByService(
            service_id=sid,
            service_name=services[sid].name if sid in services else f"Servicio #{sid}",
            **data,
        )
        for sid, data in rev_service.items()
    ]

    top_barbers = sorted(
        (
            BarberPerformance(
                barber_id=bid,
                barber_name=(
                    users[barbers[bid].user_id].full_name
                    if bid in barbers and barbers[bid].user_id in users
                    else f"Barbero #{bid}"
                ),
                branch_name=(
                    branches[barbers[bid].branch_id].name
                    if bid in barbers and barbers[bid].branch_id in branches
                    else ""
                ),
                completed_count=d["completed_count"],
                no_show_count=d["no_show_count"],
                gross_revenue=d["gross_revenue"],
                barber_total=d["barber_total"],
                shop_total=d["shop_total"],
                avg_pct=round(d["pct_sum"] / d["completed_count"], 1) if d["completed_count"] else 0.0,
            )
            for bid, d in perf.items()
        ),
        key=lambda p: p.barber_total,
        reverse=True,
    )

    denom = len(completed) + len(no_shows)
    no_show_rate = round(len(no_shows) / denom, 4) if denom else 0.0

    return DashboardResponse(
        date_from=date_from,
        date_to=date_to,
        total_gross=total_gross,
        total_barber=total_barber,
        total_shop=total_shop,
        total_appointments=len(appointments),
        completed_count=len(completed),
        no_show_count=len(no_shows),
        cancelled_count=len(cancelled),
        scheduled_count=len(scheduled),
        no_show_rate=no_show_rate,
        revenue_by_branch=revenue_by_branch,
        revenue_by_service=revenue_by_service,
        top_barbers=list(top_barbers),
    )
