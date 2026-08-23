"""
Calendario por sucursal — NOVA BARBER SHOP
=============================================
Dos formas de ver la disponibilidad de una sucursal:

1. GET /branches/{id}/calendar?date=
   Grilla completa: sillas × franjas de 30 min. Cada celda dice si
   está libre, ocupada (con qué servicio y cliente), o bloqueada.
   Público — puede alimentar una pantalla en la entrada de la
   barbería o el panel del admin sin auth.

2. GET /branches/{id}/calendar.ics?days=
   Feed iCal (RFC 5545) con las citas agendadas. Se suscribe
   desde Google Calendar, Apple Calendar o Outlook copiando la URL.
   Solo muestra citas SCHEDULED/COMPLETED, sin datos sensibles del
   cliente (solo iniciales + servicio).

Ambos endpoints son públicos: no requieren autenticación. El .ics no
expone datos personales completos (solo iniciales del nombre) para que
sea seguro ponerlo en una pantalla pública.
"""

from datetime import date as date_type, datetime, time, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    Branch,
    Chair,
    Service,
    User,
    SLOT_MINUTES,
)

router = APIRouter(prefix="/branches/{branch_id}", tags=["calendar"])


# ==================== Schemas ====================

class SlotInfo(BaseModel):
    start_time: str        # "08:00"
    end_time: str          # "08:30"
    status: str            # "free" | "booked" | "completed" | "no_show"
    service_name: Optional[str] = None
    client_initials: Optional[str] = None   # "JP" — no el nombre completo
    appointment_id: Optional[int] = None


class ChairColumn(BaseModel):
    chair_id: int
    chair_label: str       # "Silla 1"
    barber_name: Optional[str] = None
    slots: List[SlotInfo]


class CalendarResponse(BaseModel):
    branch_id: int
    branch_name: str
    date: date_type
    opening_time: str
    closing_time: str
    slot_minutes: int
    time_labels: List[str]  # ["08:00", "08:30", ...] — eje Y de la grilla
    chairs: List[ChairColumn]

    # Resumen rápido para la pantalla de entrada
    total_slots: int
    booked_slots: int
    free_slots: int
    occupancy_pct: float   # 0..100


class DaySummaryItem(BaseModel):
    date: date_type
    day_label: str         # "lun 25 ago"
    total_slots: int
    booked_slots: int
    free_slots: int
    occupancy_pct: float


class CalendarWeekResponse(BaseModel):
    branch_id: int
    branch_name: str
    days: List[DaySummaryItem]


# ==================== Helpers ====================

DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
MONTHS = ["", "ene", "feb", "mar", "abr", "may", "jun",
          "jul", "ago", "sep", "oct", "nov", "dic"]


def _initials(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    parts = name.strip().split()
    return "".join(p[0].upper() for p in parts[:2]) if parts else None


def _build_day(
    branch: Branch,
    target_date: date_type,
    chairs_with_barbers: list,
    appointments: List[Appointment],
    services: dict,
    session: Session,
) -> CalendarResponse:
    opening = datetime.combine(target_date, branch.opening_time)
    closing = datetime.combine(target_date, branch.closing_time)
    step = timedelta(minutes=SLOT_MINUTES)

    # Build time labels
    time_labels = []
    cursor = opening
    while cursor < closing:
        time_labels.append(cursor.strftime("%H:%M"))
        cursor += step

    # Index appointments by chair_id
    appts_by_chair: dict[int, dict[str, Appointment]] = {}
    for appt in appointments:
        appts_by_chair.setdefault(appt.chair_id, {})[
            appt.start_time.strftime("%H:%M")
        ] = appt

    total_slots = 0
    booked_slots = 0
    columns = []

    for chair, barber, barber_user in chairs_with_barbers:
        chair_appts = appts_by_chair.get(chair.id, {})
        slots = []
        for t_label in time_labels:
            total_slots += 1
            appt = chair_appts.get(t_label)
            if appt:
                booked_slots += 1
                svc = services.get(appt.service_id)
                # Client initials (privacy-safe for public displays)
                if appt.client_id:
                    client = session.get(User, appt.client_id)
                    initials = _initials(client.full_name if client else None)
                else:
                    initials = _initials(appt.guest_name)

                status_map = {
                    AppointmentStatus.SCHEDULED: "booked",
                    AppointmentStatus.COMPLETED: "completed",
                    AppointmentStatus.NO_SHOW: "no_show",
                    AppointmentStatus.CANCELLED: "free",
                }
                st = status_map.get(appt.status, "booked")
                if st == "free":
                    booked_slots -= 1  # cancelled = free

                end_t = (
                    datetime.combine(target_date, time(0, 0))
                    + timedelta(
                        hours=int(t_label[:2]),
                        minutes=int(t_label[3:]) + SLOT_MINUTES,
                    )
                ).strftime("%H:%M")

                slots.append(SlotInfo(
                    start_time=t_label,
                    end_time=end_t,
                    status=st,
                    service_name=svc.name if svc else None,
                    client_initials=initials if st != "free" else None,
                    appointment_id=appt.id if st != "free" else None,
                ))
            else:
                end_t = (
                    datetime.combine(target_date, time(0, 0))
                    + timedelta(
                        hours=int(t_label[:2]),
                        minutes=int(t_label[3:]) + SLOT_MINUTES,
                    )
                ).strftime("%H:%M")
                slots.append(SlotInfo(
                    start_time=t_label, end_time=end_t, status="free"
                ))

        columns.append(ChairColumn(
            chair_id=chair.id,
            chair_label=chair.label,
            barber_name=barber_user.full_name if barber_user else None,
            slots=slots,
        ))

    free_slots = total_slots - booked_slots
    occupancy = round(booked_slots / total_slots * 100, 1) if total_slots else 0.0

    return CalendarResponse(
        branch_id=branch.id,
        branch_name=branch.name,
        date=target_date,
        opening_time=branch.opening_time.strftime("%H:%M"),
        closing_time=branch.closing_time.strftime("%H:%M"),
        slot_minutes=SLOT_MINUTES,
        time_labels=time_labels,
        chairs=columns,
        total_slots=total_slots,
        booked_slots=booked_slots,
        free_slots=free_slots,
        occupancy_pct=occupancy,
    )


def _get_chairs_with_barbers(session: Session, branch_id: int):
    return session.exec(
        select(Chair, Barber, User)
        .outerjoin(Barber, Barber.chair_id == Chair.id)
        .outerjoin(User, User.id == Barber.user_id)
        .where(Chair.branch_id == branch_id)
        .where(Chair.is_active == True)  # noqa
        .order_by(Chair.label)
    ).all()


def _get_day_appointments(session: Session, branch_id: int, target_date: date_type):
    day_start = datetime.combine(target_date, time(0, 0))
    day_end = day_start + timedelta(days=1)
    return list(session.exec(
        select(Appointment)
        .where(Appointment.branch_id == branch_id)
        .where(Appointment.start_time >= day_start)
        .where(Appointment.start_time < day_end)
        .where(Appointment.status != AppointmentStatus.CANCELLED)
    ).all())


# ==================== Endpoints ====================

@router.get("/calendar", response_model=CalendarResponse)
def branch_calendar(
    branch_id: int,
    date: Optional[date_type] = Query(None, description="Default: hoy"),
    session: Session = Depends(get_session),
):
    """
    Grilla completa del día para una sucursal: sillas × franjas de 30 min.
    Público — sirve para la pantalla de la entrada, para el admin, o para
    el widget de reservas.
    """
    branch = session.get(Branch, branch_id)
    if not branch or not branch.is_active:
        raise HTTPException(404, "Sucursal no encontrada.")

    target_date = date or date_type.today()
    chairs = _get_chairs_with_barbers(session, branch_id)
    appointments = _get_day_appointments(session, branch_id, target_date)
    services = {s.id: s for s in session.exec(select(Service)).all()}

    return _build_day(branch, target_date, chairs, appointments, services, session)


@router.get("/calendar/week", response_model=CalendarWeekResponse)
def branch_calendar_week(
    branch_id: int,
    from_date: Optional[date_type] = Query(None, description="Default: hoy"),
    session: Session = Depends(get_session),
):
    """
    Resumen de ocupación de 7 días para la sucursal. Útil para que el
    admin vea rápidamente qué días están más cargados.
    """
    branch = session.get(Branch, branch_id)
    if not branch or not branch.is_active:
        raise HTTPException(404, "Sucursal no encontrada.")

    start = from_date or date_type.today()
    chairs = _get_chairs_with_barbers(session, branch_id)
    services = {s.id: s for s in session.exec(select(Service)).all()}

    days = []
    for i in range(7):
        d = start + timedelta(days=i)
        appointments = _get_day_appointments(session, branch_id, d)
        cal = _build_day(branch, d, chairs, appointments, services, session)
        dow_idx = d.weekday()
        days.append(DaySummaryItem(
            date=d,
            day_label=f"{DOW[dow_idx]} {d.day} {MONTHS[d.month]}",
            total_slots=cal.total_slots,
            booked_slots=cal.booked_slots,
            free_slots=cal.free_slots,
            occupancy_pct=cal.occupancy_pct,
        ))

    return CalendarWeekResponse(
        branch_id=branch.id, branch_name=branch.name, days=days
    )


@router.get("/calendar.ics")
def branch_ical_feed(
    branch_id: int,
    days: int = Query(14, ge=1, le=90, description="Días hacia adelante a incluir"),
    session: Session = Depends(get_session),
):
    """
    Feed iCal (RFC 5545) de las citas de la sucursal. Se suscribe
    copiando la URL en Google Calendar > 'Desde URL'.

    Ejemplo de URL para suscripción:
        https://nova-api.onrender.com/branches/1/calendar.ics?days=14

    Privacidad: solo muestra iniciales del cliente + servicio, no datos
    personales completos. Seguro para pantallas públicas.
    """
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(404, "Sucursal no encontrada.")

    today = date_type.today()
    start_dt = datetime.combine(today, time(0, 0))
    end_dt = start_dt + timedelta(days=days)

    appointments = session.exec(
        select(Appointment)
        .where(Appointment.branch_id == branch_id)
        .where(Appointment.start_time >= start_dt)
        .where(Appointment.start_time < end_dt)
        .where(
            Appointment.status.in_(
                [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED]
            )
        )
        .order_by(Appointment.start_time)
    ).all()

    services = {s.id: s for s in session.exec(select(Service)).all()}
    chairs = {c.id: c for c in session.exec(
        select(Chair).where(Chair.branch_id == branch_id)
    ).all()}
    barbers_db = session.exec(
        select(Barber).where(Barber.branch_id == branch_id)
    ).all()
    barber_names = {}
    for b in barbers_db:
        u = session.get(User, b.user_id)
        barber_names[b.id] = u.full_name if u else f"Barbero #{b.id}"

    # Build iCal
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//NOVA Barber Shop//{branch.name}//ES",
        f"X-WR-CALNAME:NOVA {branch.name}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for appt in appointments:
        svc = services.get(appt.service_id)
        chair = chairs.get(appt.chair_id)
        barber_name = barber_names.get(appt.barber_id, "")

        if appt.client_id:
            client = session.get(User, appt.client_id)
            initials = _initials(client.full_name if client else None) or "NN"
        else:
            initials = _initials(appt.guest_name) or "NN"

        summary = f"{svc.name if svc else 'Servicio'} — {initials}"
        description = f"Barbero: {barber_name}\\nSilla: {chair.label if chair else '?'}"
        dtstart = appt.start_time.strftime("%Y%m%dT%H%M%S")
        dtend = appt.end_time.strftime("%Y%m%dT%H%M%S")
        uid = f"nova-appt-{appt.id}@novabarbershop.com"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{branch.name} - {branch.address}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")

    ics_content = "\r\n".join(lines)
    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'inline; filename="nova-{branch.name.lower().replace(" ","-")}.ics"',
        },
    )
