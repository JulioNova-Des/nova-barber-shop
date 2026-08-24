"""
Auth — NOVA BARBER SHOP
================================
- POST /auth/register: alta pública de CLIENTE registrado.
- POST /auth/login: login JSON (usado por la app frontend).
- POST /auth/token: login OAuth2 form (usado por Swagger Authorize).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.models import User, UserRole
from app.schemas.auth import ClientRegister, LoginRequest, TokenResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def _do_login(identifier: str, password: str, session: Session) -> dict:
    user = session.exec(
        select(User).where(
            (User.email == identifier) | (User.phone == identifier)
        )
    ).first()

    if not user or not user.hashed_password or not verify_password(
        password, user.hashed_password
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta inactiva.")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_client(payload: ClientRegister, session: Session = Depends(get_session)):
    existing_phone = session.exec(select(User).where(User.phone == payload.phone)).first()
    if existing_phone:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese WhatsApp.")

    if payload.email:
        existing_email = session.exec(select(User).where(User.email == payload.email)).first()
        if existing_email:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email.")

    user = User(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.CLIENT,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    """Login con JSON body — usado por la app frontend."""
    return _do_login(payload.identifier, payload.password, session)


@router.post("/token")
def login_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """
    Login con OAuth2 form data — usado por el botón Authorize de Swagger.
    En username poné tu email o teléfono.
    """
    result = _do_login(form_data.username, form_data.password, session)
    # OAuth2 espera "access_token" en la respuesta (ya lo tiene TokenResponse)
    return result


@router.get("/me", response_model=UserPublic)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
