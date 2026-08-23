from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.models import Service
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=List[ServiceRead])
def list_services(only_active: bool = True, session: Session = Depends(get_session)):
    """Público — el flujo de reserva (paso 1) necesita el catálogo sin login."""
    stmt = select(Service)
    if only_active:
        stmt = stmt.where(Service.is_active == True)  # noqa: E712
    return session.exec(stmt).all()


@router.post(
    "", response_model=ServiceRead, status_code=201, dependencies=[Depends(get_current_admin)]
)
def create_service(payload: ServiceCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Service).where(Service.name == payload.name)).first()
    if existing:
        raise HTTPException(409, "Ya existe un servicio con ese nombre.")
    service = Service(**payload.model_dump())
    session.add(service)
    session.commit()
    session.refresh(service)
    return service


@router.patch(
    "/{service_id}", response_model=ServiceRead, dependencies=[Depends(get_current_admin)]
)
def update_service(service_id: int, payload: ServiceUpdate, session: Session = Depends(get_session)):
    """Permite ajustar precios y duraciones (ej: subir el precio del Corte)."""
    service = session.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Servicio no encontrado.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    session.add(service)
    session.commit()
    session.refresh(service)
    return service


@router.delete("/{service_id}", status_code=204, dependencies=[Depends(get_current_admin)])
def deactivate_service(service_id: int, session: Session = Depends(get_session)):
    service = session.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Servicio no encontrado.")
    service.is_active = False
    session.add(service)
    session.commit()
