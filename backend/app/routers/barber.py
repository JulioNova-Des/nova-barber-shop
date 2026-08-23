"""
Agenda del barbero — NOVA BARBER SHOP (doble confirmación)
============================================================
El barbero ya NO marca "completed" directamente. Su acción es marcar
"attended" (el servicio se realizó). Después, el admin/cajero confirma
el pago y ahí se completa la cita y se calcula la comisión.

Flujo:
  SCHEDULED → ATTENDED (barbero)  → COMPLETED (admin/cajero)
  SCHEDULED → NO_SHOW  (barbero)
"""

from datetime import date as date_type, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_barber
from app.models.models import Appointment, AppointmentStatus, Barber, Service, User
from app.schemas.barber import BarberAgendaItem, MarkAttendanceRequest

router = APIRouter(prefix="/barber", tags=["barber"])


def _barber_profile(current_user: User, session: Session) -> Barber:
    barber = session.exec(select(Barber).where(Barber.user_id == current_user.id)).first()
    if not barber:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No tienes un perfil de barbero configurado.")
    return barber


def _to_item(appt: Appointment, session: Session) -> BarberAgendaItem:
    service = session.get(Service, appt.service_id)
    if appt.client_id:
        client = session.get(User, appt.client_id)
        client_name = client.full_name if client else "Cliente"
        client_phone = client.phone if client else ""
        is_guest = False
    else:
        client_name = appt.guest_name or ""
        client_phone = appt.guest_phone or ""
        is_guest = True

    return BarberAgendaItem(
        appointment_id=appt.id,
        client_name=client_name,
        client_phone=client_phone,
        is_guest=is_guest,
        service_name=service.name if service else "",
        service_price=service.price if service else 0,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        barber_pct_snapshot=appt.barber_pct_snapshot,
        shop_pct_snapshot=appt.shop_pct_snapshot,
        barber_amount=appt.barber_amount,
        shop_amount=appt.shop_amount,
        payment_confirmed=appt.payment_confirmed_at is not None,
    )


@router.get("/agenda", response_model=List[BarberAgendaItem])
def my_agenda(
    date: Optional[date_type] = Query(None, description="Default: hoy"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    barber = _barber_profile(current_user, session)
    target_date = date or date_type.today()
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    stmt = (
        select(Appointment)
        .where(Appointment.chair_id == barber.chair_id)
        .where(Appointment.start_time >= day_start)
        .where(Appointment.start_time < day_end)
        .order_by(Appointment.start_time)
    )
    return [_to_item(a, session) for a in session.exec(stmt).all()]


@router.post("/agenda/{appointment_id}/attendance", response_model=BarberAgendaItem)
def mark_attendance(
    appointment_id: int,
    payload: MarkAttendanceRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """
    El barbero marca:
      - "attended" → el servicio se realizó (queda pendiente confirmación de pago)
      - "no_show"  → el cliente no vino
    Ya NO puede marcar "completed" directamente.
    """
    barber = _barber_profile(current_user, session)

    allowed = {AppointmentStatus.ATTENDED, AppointmentStatus.NO_SHOW}
    if payload.status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Solo puedes marcar 'attended' (atendido) o 'no_show' (ausencia). "
            "La confirmación de pago la hace el cajero o admin."
        )

    appt = session.get(Appointment, appointment_id)
    if not appt or appt.chair_id != barber.chair_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada en tu silla.")
    if appt.status != AppointmentStatus.SCHEDULED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se puede marcar citas agendadas.")

    appt.status = payload.status

    if payload.status == AppointmentStatus.ATTENDED:
        appt.attended_at = datetime.utcnow()
        appt.attended_by = current_user.id

    session.add(appt)
    session.commit()
    session.refresh(appt)
    return _to_item(appt, session)
