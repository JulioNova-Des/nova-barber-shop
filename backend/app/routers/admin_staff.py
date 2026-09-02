"""
Gestión de staff — NOVA BARBER SHOP
======================================
El admin crea las cuentas de barberos y cajeros con una contraseña
temporal. Al primer login, el sistema marca `must_change_password=True`
para que el frontend fuerce el cambio.

Endpoints:
  POST /admin/staff                → crear barbero o cajero
  GET  /admin/staff                → listar todo el staff
  POST /admin/staff/{id}/reset     → resetear contraseña (genera una temporal)
  POST /auth/change-password       → el propio usuario cambia su contraseña
"""

import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user, hash_password
from app.models.models import Barber, Branch, Chair, User, UserRole

router = APIRouter(tags=["admin-staff"])


# ==================== Schemas ====================

class CreateStaffRequest(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    role: str  # "barber" o "cashier"
    emergency_contact: Optional[str] = None
    branch_id: Optional[int] = None
    chair_id: Optional[int] = None
    password: Optional[str] = None


class StaffRead(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    role: str
    is_active: bool
    must_change_password: bool
    emergency_contact: Optional[str] = None
    branch_name: Optional[str] = None
    chair_label: Optional[str] = None
    barber_id: Optional[int] = None


class StaffCreatedResponse(BaseModel):
    user: StaffRead
    temporary_password: str  # se muestra UNA VEZ al admin para que se la dé al barbero


class ResetPasswordResponse(BaseModel):
    user_id: int
    full_name: str
    new_temporary_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ==================== Endpoints ====================

@router.post(
    "/admin/staff",
    response_model=StaffCreatedResponse,
    status_code=201,
    dependencies=[Depends(get_current_admin)],
)
def create_staff(payload: CreateStaffRequest, session: Session = Depends(get_session)):
    """
    Crea una cuenta de barbero o cajero. El admin le da la contraseña
    temporal al empleado (en persona o por WhatsApp). Al primer login
    el frontend debe forzar el cambio de contraseña.
    """
    if payload.role not in ("barber", "cashier"):
        raise HTTPException(400, "El rol debe ser 'barber' o 'cashier'.")

    # Verificar duplicados
    existing = session.exec(select(User).where(User.phone == payload.phone)).first()
    if existing:
        raise HTTPException(409, f"Ya existe un usuario con el teléfono {payload.phone}.")
    if payload.email:
        existing_email = session.exec(select(User).where(User.email == payload.email)).first()
        if existing_email:
            raise HTTPException(409, f"Ya existe un usuario con el email {payload.email}.")

    # Generar contraseña temporal si no se especificó una
    temp_password = payload.password or _generate_temp_password()

    user = User(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        hashed_password=hash_password(temp_password),
        role=UserRole(payload.role),
        must_change_password=payload.password is None,
        emergency_contact=payload.emergency_contact,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # Si es barbero, crear el perfil Barber con asignación de silla
    barber_id = None
    branch_name = None
    chair_label = None
    if payload.role == "barber":
        if not payload.branch_id or not payload.chair_id:
            raise HTTPException(400, "Para un barbero, branch_id y chair_id son obligatorios.")

        branch = session.get(Branch, payload.branch_id)
        if not branch:
            raise HTTPException(404, "Sucursal no encontrada.")
        chair = session.get(Chair, payload.chair_id)
        if not chair or chair.branch_id != payload.branch_id:
            raise HTTPException(404, "Silla no encontrada en esa sucursal.")

        # Verificar que la silla no tenga otro barbero
        existing_barber = session.exec(
            select(Barber).where(Barber.chair_id == payload.chair_id).where(Barber.is_active == True)
        ).first()
        if existing_barber:
            raise HTTPException(409, f"La {chair.label} ya tiene un barbero asignado.")

        barber = Barber(
            user_id=user.id,
            branch_id=payload.branch_id,
            chair_id=payload.chair_id,
        )
        session.add(barber)
        session.commit()
        session.refresh(barber)
        barber_id = barber.id
        branch_name = branch.name
        chair_label = chair.label

    return StaffCreatedResponse(
        user=StaffRead(
            id=user.id,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            role=user.role.value,
            is_active=user.is_active,
            must_change_password=user.must_change_password,
            emergency_contact=user.emergency_contact,
            branch_name=branch_name,
            chair_label=chair_label,
            barber_id=barber_id,
        ),
        temporary_password=temp_password,
    )


@router.get(
    "/admin/staff",
    response_model=List[StaffRead],
    dependencies=[Depends(get_current_admin)],
)
def list_staff(
    role: Optional[str] = Query(None, description="Filtrar por rol: barber, cashier"),
    session: Session = Depends(get_session),
):
    stmt = select(User).where(User.role.in_([UserRole.BARBER, UserRole.CASHIER]))
    if role:
        stmt = stmt.where(User.role == UserRole(role))
    users = session.exec(stmt).all()

    result = []
    for u in users:
        branch_name = None
        chair_label = None
        barber_id = None
        if u.role == UserRole.BARBER:
            barber = session.exec(select(Barber).where(Barber.user_id == u.id)).first()
            if barber:
                barber_id = barber.id
                branch = session.get(Branch, barber.branch_id)
                chair = session.get(Chair, barber.chair_id)
                branch_name = branch.name if branch else None
                chair_label = chair.label if chair else None

        result.append(StaffRead(
            id=u.id,
            full_name=u.full_name,
            phone=u.phone,
            email=u.email,
            role=u.role.value,
            is_active=u.is_active,
            must_change_password=u.must_change_password,
            emergency_contact=u.emergency_contact,
            branch_name=branch_name,
            chair_label=chair_label,
            barber_id=barber_id,
        ))
    return result


@router.post(
    "/admin/staff/{user_id}/reset-password",
    response_model=ResetPasswordResponse,
    dependencies=[Depends(get_current_admin)],
)
def reset_staff_password(user_id: int, session: Session = Depends(get_session)):
    """Genera una nueva contraseña temporal para un empleado."""
    user = session.get(User, user_id)
    if not user or user.role not in (UserRole.BARBER, UserRole.CASHIER):
        raise HTTPException(404, "Empleado no encontrado.")

    new_password = _generate_temp_password()
    user.hashed_password = hash_password(new_password)
    user.must_change_password = True
    session.add(user)
    session.commit()

    return ResetPasswordResponse(
        user_id=user.id,
        full_name=user.full_name,
        new_temporary_password=new_password,
    )


class UpdateStaffRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    emergency_contact: Optional[str] = None
    chair_id: Optional[int] = None


@router.patch(
    "/admin/staff/{user_id}",
    response_model=StaffRead,
    dependencies=[Depends(get_current_admin)],
)
def update_staff(user_id: int, payload: UpdateStaffRequest, session: Session = Depends(get_session)):
    """Editar datos de un empleado. Si se desactiva un barbero, su silla queda libre."""
    user = session.get(User, user_id)
    if not user or user.role not in (UserRole.BARBER, UserRole.CASHIER):
        raise HTTPException(404, "Empleado no encontrado.")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.email is not None:
        user.email = payload.email
    if payload.emergency_contact is not None:
        user.emergency_contact = payload.emergency_contact
    if payload.is_active is not None:
        user.is_active = payload.is_active
        # Si se desactiva un barbero, desactivar su perfil para liberar la silla
        if not payload.is_active and user.role == UserRole.BARBER:
            barber = session.exec(select(Barber).where(Barber.user_id == user.id)).first()
            if barber:
                barber.is_active = False
                session.add(barber)

    session.add(user)

    # Reasignar silla si se especifica
    if payload.chair_id is not None and user.role == UserRole.BARBER:
        barber = session.exec(select(Barber).where(Barber.user_id == user.id)).first()
        if barber:
            chair = session.get(Chair, payload.chair_id)
            if not chair:
                raise HTTPException(404, "Silla no encontrada.")
            # Verificar que la silla no tenga otro barbero activo
            existing = session.exec(
                select(Barber).where(Barber.chair_id == payload.chair_id).where(Barber.is_active == True).where(Barber.id != barber.id)
            ).first()
            if existing:
                raise HTTPException(409, "Esa silla ya tiene un barbero asignado.")
            barber.chair_id = payload.chair_id
            barber.branch_id = chair.branch_id
            session.add(barber)

    session.commit()
    session.refresh(user)

    # Build response
    branch_name = None
    chair_label = None
    barber_id = None
    if user.role == UserRole.BARBER:
        barber = session.exec(select(Barber).where(Barber.user_id == user.id)).first()
        if barber:
            barber_id = barber.id
            branch = session.get(Branch, barber.branch_id)
            chair = session.get(Chair, barber.chair_id)
            branch_name = branch.name if branch else None
            chair_label = chair.label if chair else None

    return StaffRead(
        id=user.id, full_name=user.full_name, phone=user.phone,
        email=user.email, role=user.role.value, is_active=user.is_active,
        must_change_password=user.must_change_password,
        emergency_contact=user.emergency_contact,
        branch_name=branch_name, chair_label=chair_label, barber_id=barber_id,
    )


@router.delete(
    "/admin/staff/{user_id}",
    status_code=204,
    dependencies=[Depends(get_current_admin)],
)
def deactivate_staff(user_id: int, session: Session = Depends(get_session)):
    """Desactiva un empleado (soft delete). Si es barbero, libera su silla."""
    user = session.get(User, user_id)
    if not user or user.role not in (UserRole.BARBER, UserRole.CASHIER):
        raise HTTPException(404, "Empleado no encontrado.")

    user.is_active = False
    session.add(user)

    if user.role == UserRole.BARBER:
        barber = session.exec(select(Barber).where(Barber.user_id == user.id)).first()
        if barber:
            barber.is_active = False
            session.add(barber)

    session.commit()


@router.post("/auth/change-password")
def change_own_password(
    payload: ChangePasswordRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Cualquier usuario autenticado cambia su propia contraseña."""
    from app.core.security import verify_password

    if not verify_password(payload.current_password, current_user.hashed_password or ""):
        raise HTTPException(401, "Contraseña actual incorrecta.")
    if len(payload.new_password) < 6:
        raise HTTPException(400, "La nueva contraseña debe tener al menos 6 caracteres.")

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    session.add(current_user)
    session.commit()
    return {"message": "Contraseña actualizada."}


def _generate_temp_password() -> str:
    """Genera una contraseña temporal legible: 3 letras + 4 dígitos (ej: 'nova7284')."""
    return "nova" + "".join(secrets.choice("0123456789") for _ in range(4))
