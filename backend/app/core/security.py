"""
Seguridad — NOVA BARBER SHOP
================================
Hashing de contraseñas + JWT. `get_current_user_optional` es la pieza
clave para el paso 3: permite que /appointments identifique si quien
reserva es un cliente registrado (token válido) o un invitado (sin
token), sin forzar login en ningún caso.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session

from app.core.database import get_session
from app.models.models import User, UserRole

SECRET_KEY = os.getenv("NOVA_SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 días

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# auto_error=False -> no lanza 401 automáticamente si falta el token;
# así el mismo endpoint sirve a invitados y a clientes logueados.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_user_id(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> Optional[User]:
    """Devuelve el User si el token es válido, o None (invitado) si no
    hay token / es inválido. Nunca lanza error por sí sola."""
    if not token:
        return None
    user_id = _decode_user_id(token)
    if user_id is None:
        return None
    user = session.get(User, user_id)
    return user if (user and user.is_active) else None


def get_current_user(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Para endpoints que SÍ requieren sesión (historial, admin, barbero)."""
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado.")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol admin.")
    return user


def get_current_barber(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.BARBER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol barbero.")
    return user


def get_current_cashier_or_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.CASHIER, UserRole.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol cajero o admin.")
    return user
