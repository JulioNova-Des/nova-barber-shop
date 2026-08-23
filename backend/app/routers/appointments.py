"""
Router de citas — NOVA BARBER SHOP (Paso 3)
================================================
POST /appointments es el punto donde se materializa la reserva del
paso 2. Reglas de negocio clave:

1. Identidad — exactamente una de estas dos:
   a) Cliente registrado: viene un Bearer token válido -> se usa
      `current_user.id` como `client_id`, se ignoran guest_name/phone
      aunque el cliente los mande.
   b) Invitado: no hay token -> `guest_name` y `guest_phone` son
      obligatorios (validado también a nivel de schema).

2. Consistencia — chair pertenece a branch, barber está asignado a esa
   chair, service está activo.

3. Anti doble-reserva — se revalida disponibilidad en el momento de
   escribir (no solo se confía en lo que el usuario vio en el paso 2,
   que pudo quedar desactualizado), y además se captura el error de
   integridad de la base como última línea de defensa ante condiciones
   de carrera (dos solicitudes casi simultáneas para el mismo slot).
"""

from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_user_optional
from app.models.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    Branch,
    Chair,
    Service,
    User,
    UserRole,
)
from app.schemas.appointment import AppointmentCreate, AppointmentRead

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _to_read(appt: Appointment, session: Session) -> AppointmentRead:
    service = session.get(Service, appt.service_id)
    branch = session.get(Branch, appt.branch_id)
    chair = session.get(Chair, appt.chair_id)

    barber_name = None
    if appt.barber_id:
        barber = session.get(Barber, appt.barber_id)
        if barber:
            barber_user = session.get(User, barber.user_id)
            barber_name = barber_user.full_name if barber_user else None

    if appt.client_id:
        client = session.get(User, appt.client_id)
        client_name = client.full_name if client else "Cliente"
        client_phone = client.phone if client else ""
        is_guest = False
    else:
        client_name = appt.guest_name or ""
        client_phone = appt.guest_phone or ""
        is_guest = True

    return AppointmentRead(
        id=appt.id,
        branch_id=appt.branch_id,
        branch_name=branch.name if branch else "",
        chair_id=appt.chair_id,
        chair_label=chair.label if chair else "",
        barber_id=appt.barber_id,
        barber_name=barber_name,
        service_id=appt.service_id,
        service_name=service.name if service else "",
        price=service.price if service else 0,
        client_name=client_name,
        client_phone=client_phone,
        is_guest=is_guest,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        created_at=appt.created_at,
    )


@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    # --- 1. Identidad: cliente registrado vs invitado -----------------
    if current_user:
        if current_user.role != UserRole.CLIENT:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Solo cuentas de cliente pueden agendar citas por esta vía.",
            )
        client_id = current_user.id
        guest_name = None
        guest_phone = None
    else:
        if not payload.guest_name or not payload.guest_phone:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Inicia sesión o envía guest_name y guest_phone para reservar como invitado.",
            )
        client_id = None
        guest_name = payload.guest_name.strip()
        guest_phone = payload.guest_phone.strip()

    # --- 2. Validar que branch/chair/barber/service existan y calcen --
    branch = session.get(Branch, payload.branch_id)
    if not branch or not branch.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sucursal no encontrada o inactiva.")

    service = session.get(Service, payload.service_id)
    if not service or not service.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Servicio no encontrado o inactivo.")

    chair = session.get(Chair, payload.chair_id)
    if not chair or not chair.is_active or chair.branch_id != payload.branch_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Silla no válida para esta sucursal.")

    barber = session.get(Barber, payload.barber_id)
    if not barber or not barber.is_active or barber.chair_id != payload.chair_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Barbero no válido para esta silla.")

    # --- 3. Revalidar disponibilidad (anti doble-reserva) --------------
    start_time = payload.start_time
    end_time = start_time + timedelta(minutes=service.duration_minutes)

    overlap_stmt = (
        select(Appointment)
        .where(Appointment.chair_id == payload.chair_id)
        .where(
            Appointment.status.in_(
                [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED]
            )
        )
        .where(Appointment.start_time < end_time)
        .where(Appointment.end_time > start_time)
    )
    if session.exec(overlap_stmt).first():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ese horario ya no está disponible. Por favor elige otra franja.",
        )

    appointment = Appointment(
        branch_id=payload.branch_id,
        chair_id=payload.chair_id,
        barber_id=payload.barber_id,
        service_id=payload.service_id,
        client_id=client_id,
        guest_name=guest_name,
        guest_phone=guest_phone,
        start_time=start_time,
        end_time=end_time,
        status=AppointmentStatus.SCHEDULED,
    )
    session.add(appointment)

    try:
        session.commit()
    except IntegrityError:
        # Dos solicitudes llegaron casi simultáneas y ganaron la carrera
        # contra el chequeo de arriba (mismo chair_id + start_time exacto).
        session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ese horario se acaba de ocupar. Por favor elige otra franja.",
        )

    session.refresh(appointment)
    return _to_read(appointment, session)


@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(appointment_id: int, session: Session = Depends(get_session)):
    appt = session.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada.")
    return _to_read(appt, session)


@router.get("/me/history", response_model=List[AppointmentRead])
def my_appointment_history(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Historial del cliente registrado (mencionado en los requisitos:
    'Cliente Registrado: Guarda historial')."""
    if not current_user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Debes iniciar sesión.")

    stmt = (
        select(Appointment)
        .where(Appointment.client_id == current_user.id)
        .order_by(Appointment.start_time.desc())
    )
    appts = session.exec(stmt).all()
    return [_to_read(a, session) for a in appts]


@router.post("/{appointment_id}/cancel", response_model=AppointmentRead)
def cancel_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    appt = session.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada.")
    if appt.status != AppointmentStatus.SCHEDULED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esta cita ya no se puede cancelar.")
    if current_user and appt.client_id and appt.client_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No puedes cancelar la cita de otro cliente.")

    appt.status = AppointmentStatus.CANCELLED
    session.add(appt)
    session.commit()
    session.refresh(appt)
    return _to_read(appt, session)
