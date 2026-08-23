"""
Confirmación de pago — NOVA BARBER SHOP
==========================================
El admin o cajero confirma que el pago se realizó. Esto es el paso 2
de la doble confirmación:

  Barbero marca ATTENDED  →  Cajero/Admin marca COMPLETED + calcula comisión

Solo citas en status=ATTENDED pueden ser confirmadas como pagadas.
La comisión se snapshot-ea aquí, no en el paso del barbero.

Endpoints:
  GET  /cashier/pending          → citas atendidas pendientes de cobro
  POST /cashier/{id}/confirm     → confirmar pago → COMPLETED + comisión
  POST /cashier/{id}/reject      → rechazar (volver a SCHEDULED si hubo error)
"""

from datetime import date as date_type, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.commission_engine import resolve_commission
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    Branch,
    Service,
    User,
    UserRole,
)

router = APIRouter(prefix="/cashier", tags=["cashier"])


def _require_cashier_or_admin(user: User):
    if user.role not in (UserRole.CASHIER, UserRole.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol cajero o admin.")


class PendingPaymentItem(BaseModel):
    appointment_id: int
    branch_name: str
    chair_label: str
    barber_name: str
    client_name: str
    client_phone: str
    is_guest: bool
    service_name: str
    service_price: int
    start_time: str     # "08:30"
    date: str           # "2026-08-22"
    attended_at: Optional[datetime] = None
    status: AppointmentStatus


class PaymentConfirmResponse(BaseModel):
    appointment_id: int
    status: AppointmentStatus
    service_price: int
    barber_pct: int
    barber_amount: int
    shop_amount: int
    confirmed_by: str
    confirmed_at: datetime


def _to_pending(appt: Appointment, session: Session) -> PendingPaymentItem:
    service = session.get(Service, appt.service_id)
    branch = session.get(Branch, appt.branch_id)
    barber = session.get(Barber, appt.barber_id) if appt.barber_id else None
    barber_user = session.get(User, barber.user_id) if barber else None

    from app.models.models import Chair
    chair = session.get(Chair, appt.chair_id)

    if appt.client_id:
        client = session.get(User, appt.client_id)
        client_name = client.full_name if client else "Cliente"
        client_phone = client.phone if client else ""
        is_guest = False
    else:
        client_name = appt.guest_name or ""
        client_phone = appt.guest_phone or ""
        is_guest = True

    return PendingPaymentItem(
        appointment_id=appt.id,
        branch_name=branch.name if branch else "",
        chair_label=chair.label if chair else "",
        barber_name=barber_user.full_name if barber_user else "",
        client_name=client_name,
        client_phone=client_phone,
        is_guest=is_guest,
        service_name=service.name if service else "",
        service_price=service.price if service else 0,
        start_time=appt.start_time.strftime("%H:%M"),
        date=appt.start_time.date().isoformat(),
        attended_at=appt.attended_at,
        status=appt.status,
    )


@router.get("/pending", response_model=List[PendingPaymentItem])
def list_pending_payments(
    branch_id: Optional[int] = Query(None, description="Filtrar por sucursal"),
    date: Optional[date_type] = Query(None, description="Filtrar por fecha. Default: hoy"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Lista las citas que el barbero ya marcó como ATTENDED pero que aún
    no tienen confirmación de pago. Es la 'cola de cobro' del cajero.
    """
    _require_cashier_or_admin(current_user)

    target_date = date or date_type.today()
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    stmt = (
        select(Appointment)
        .where(Appointment.status == AppointmentStatus.ATTENDED)
        .where(Appointment.start_time >= day_start)
        .where(Appointment.start_time < day_end)
        .order_by(Appointment.start_time)
    )
    if branch_id:
        stmt = stmt.where(Appointment.branch_id == branch_id)

    return [_to_pending(a, session) for a in session.exec(stmt).all()]


@router.post("/{appointment_id}/confirm", response_model=PaymentConfirmResponse)
def confirm_payment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Confirma que el pago se cobró. Esto es el paso 2 de la doble confirmación.

    Solo funciona sobre citas en status=ATTENDED. Cambia el status a
    COMPLETED y calcula/snapshot-ea la comisión del barbero.
    """
    _require_cashier_or_admin(current_user)

    appt = session.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada.")
    if appt.status != AppointmentStatus.ATTENDED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Solo se puede confirmar pago de citas atendidas (status actual: {appt.status.value})."
        )

    # Calcular comisión
    service = session.get(Service, appt.service_id)
    price = service.price if service else 0
    on_date = appt.start_time.date()

    if appt.barber_id:
        barber_pct, shop_pct = resolve_commission(session, appt.barber_id, on_date)
    else:
        barber_pct, shop_pct = 60, 40  # fallback

    barber_amount = round(price * barber_pct / 100)
    shop_amount = price - barber_amount

    # Actualizar cita
    appt.status = AppointmentStatus.COMPLETED
    appt.payment_confirmed_at = datetime.utcnow()
    appt.payment_confirmed_by = current_user.id
    appt.barber_pct_snapshot = barber_pct
    appt.shop_pct_snapshot = shop_pct
    appt.barber_amount = barber_amount
    appt.shop_amount = shop_amount

    session.add(appt)
    session.commit()
    session.refresh(appt)

    return PaymentConfirmResponse(
        appointment_id=appt.id,
        status=appt.status,
        service_price=price,
        barber_pct=barber_pct,
        barber_amount=barber_amount,
        shop_amount=shop_amount,
        confirmed_by=current_user.full_name,
        confirmed_at=appt.payment_confirmed_at,
    )


@router.post("/{appointment_id}/reject")
def reject_payment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Si el barbero marcó ATTENDED por error (o el cliente se fue sin pagar),
    el admin/cajero puede devolver la cita a SCHEDULED o marcarla como
    NO_SHOW según corresponda.
    """
    _require_cashier_or_admin(current_user)

    appt = session.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada.")
    if appt.status != AppointmentStatus.ATTENDED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se puede revertir citas atendidas.")

    appt.status = AppointmentStatus.SCHEDULED
    appt.attended_at = None
    appt.attended_by = None
    session.add(appt)
    session.commit()

    return {"message": "Cita devuelta a estado 'agendada'."}
