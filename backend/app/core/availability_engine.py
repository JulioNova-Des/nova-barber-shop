"""
Motor de disponibilidad — NOVA BARBER SHOP
================================================
Calcula, para una sucursal + servicio + fecha dados, qué franjas de
`SLOT_MINUTES` (30 min) están disponibles, cruzando:

    sucursal -> sillas activas -> barbero activo asignado a cada silla
             -> citas ya agendadas ese día (bloquean la silla)

Reglas:
- Toda la grilla de horarios se construye en pasos fijos de 30 min,
  entre `branch.opening_time` y `branch.closing_time`.
- Un servicio puede requerir 1 o más franjas consecutivas (hoy todos
  los servicios de NOVA duran 30 min = 1 franja, pero el motor soporta
  duraciones mayores sin cambios).
- Una franja se considera disponible si AL MENOS una silla (con su
  barbero activo) está libre durante todo el rango [inicio, fin) del
  servicio.
- Si se pasa `barber_id`, sólo se evalúa la silla de ese barbero
  (usado cuando un cliente registrado filtra por su barbero habitual).
"""

from __future__ import annotations

import math
from datetime import date as date_type, datetime, time, timedelta
from typing import List, Optional

from sqlmodel import Session, select

from app.models.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    Branch,
    Chair,
    Service,
    User,
    UserRole,
    SLOT_MINUTES,
)
from app.schemas.availability import (
    AvailabilityResponse,
    AvailabilitySlot,
    AvailableBarber,
)


class AvailabilityError(ValueError):
    """Errores de validación de negocio (branch/service inactivo, etc.)."""


def _combine(d: date_type, t: time) -> datetime:
    return datetime.combine(d, t)


def get_available_slots(
    session: Session,
    branch_id: int,
    service_id: int,
    target_date: date_type,
    barber_id: Optional[int] = None,
) -> AvailabilityResponse:
    branch = session.get(Branch, branch_id)
    if not branch or not branch.is_active:
        raise AvailabilityError("Sucursal no encontrada o inactiva.")

    service = session.get(Service, service_id)
    if not service or not service.is_active:
        raise AvailabilityError("Servicio no encontrado o inactivo.")

    duration = timedelta(minutes=service.duration_minutes)
    slots_needed = math.ceil(service.duration_minutes / SLOT_MINUTES)

    # 1. Sillas elegibles: activas, con barbero activo asignado, en la sucursal.
    eligible_query = (
        select(Chair, Barber, User)
        .join(Barber, Barber.chair_id == Chair.id)
        .join(User, User.id == Barber.user_id)
        .where(Chair.branch_id == branch_id)
        .where(Chair.is_active == True)  # noqa: E712
        .where(Barber.is_active == True)  # noqa: E712
        .where(User.role == UserRole.BARBER)
        .where(User.is_active == True)  # noqa: E712
    )
    if barber_id is not None:
        eligible_query = eligible_query.where(Barber.id == barber_id)

    eligible_rows = session.exec(eligible_query).all()

    if not eligible_rows:
        # No hay sillas/barberos disponibles para el cruce solicitado.
        return AvailabilityResponse(
            branch_id=branch_id,
            service_id=service_id,
            date=target_date,
            duration_minutes=service.duration_minutes,
            slot_minutes=SLOT_MINUTES,
            slots=[],
        )

    # 2. Citas ya agendadas ese día en la sucursal (bloquean silla).
    day_start = _combine(target_date, time(0, 0))
    day_end = day_start + timedelta(days=1)

    appts_query = (
        select(Appointment)
        .where(Appointment.branch_id == branch_id)
        .where(Appointment.start_time >= day_start)
        .where(Appointment.start_time < day_end)
        .where(
            Appointment.status.in_(
                [AppointmentStatus.SCHEDULED, AppointmentStatus.ATTENDED, AppointmentStatus.COMPLETED]
            )
        )
    )
    existing_appointments = session.exec(appts_query).all()

    # Índice: chair_id -> lista de (start, end) ocupados
    busy_by_chair: dict[int, list[tuple[datetime, datetime]]] = {}
    for appt in existing_appointments:
        busy_by_chair.setdefault(appt.chair_id, []).append(
            (appt.start_time, appt.end_time)
        )

    def chair_is_free(chair_id: int, start: datetime, end: datetime) -> bool:
        for busy_start, busy_end in busy_by_chair.get(chair_id, []):
            if start < busy_end and end > busy_start:
                return False
        return True

    # 3. Grilla de franjas de 30 min entre apertura y cierre.
    opening_dt = _combine(target_date, branch.opening_time)
    closing_dt = _combine(target_date, branch.closing_time)
    step = timedelta(minutes=SLOT_MINUTES)

    slots: List[AvailabilitySlot] = []
    cursor = opening_dt

    while cursor + duration <= closing_dt:
        slot_end = cursor + duration
        available_barbers: List[AvailableBarber] = []

        for chair, barber, user in eligible_rows:
            if chair_is_free(chair.id, cursor, slot_end):
                available_barbers.append(
                    AvailableBarber(
                        barber_id=barber.id,
                        barber_name=user.full_name,
                        chair_id=chair.id,
                        chair_label=chair.label,
                    )
                )

        slots.append(
            AvailabilitySlot(
                start_time=cursor.strftime("%H:%M"),
                end_time=slot_end.strftime("%H:%M"),
                available=len(available_barbers) > 0,
                available_barbers=available_barbers,
            )
        )
        cursor += step

    return AvailabilityResponse(
        branch_id=branch_id,
        service_id=service_id,
        date=target_date,
        duration_minutes=service.duration_minutes,
        slot_minutes=SLOT_MINUTES,
        slots=slots,
    )
