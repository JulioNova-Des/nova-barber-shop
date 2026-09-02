"""
Recuperar contraseña — NOVA BARBER SHOP
==========================================
POST /auth/recover — el cliente ingresa su teléfono y la contraseña
se resetea automáticamente a nova + últimos 4 dígitos del teléfono.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import hash_password
from app.models.models import User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class RecoverRequest(BaseModel):
    phone: str


class RecoverResponse(BaseModel):
    message: str
    new_password: str


@router.post("/recover", response_model=RecoverResponse)
def recover_password(payload: RecoverRequest, session: Session = Depends(get_session)):
    """
    Resetea la contraseña del cliente a: nova + últimos 4 dígitos del teléfono.
    Solo funciona para clientes (no staff).
    """
    clean = payload.phone.strip().replace(" ", "").replace("+", "")
    user = session.exec(select(User).where(User.phone == clean)).first()
    if not user:
        # También buscar con formatos alternativos
        user = session.exec(select(User).where(User.phone == payload.phone.strip())).first()
    if not user:
        raise HTTPException(404, "No encontramos una cuenta con ese teléfono.")
    if user.role != UserRole.CLIENT:
        raise HTTPException(400, "Para resetear contraseña de staff, contacta al administrador.")

    new_pw = "nova" + clean[-4:]
    user.hashed_password = hash_password(new_pw)
    user.must_change_password = True
    session.add(user)
    session.commit()

    return RecoverResponse(
        message=f"Contraseña restablecida para {user.full_name}.",
        new_password=new_pw,
    )
