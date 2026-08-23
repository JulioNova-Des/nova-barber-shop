from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.models import Barber, Chair, User
from app.schemas.chair import ChairCreate, ChairRead, ChairUpdate

router = APIRouter(prefix="/branches/{branch_id}/chairs", tags=["chairs"])


def _to_read(chair: Chair, session: Session) -> ChairRead:
    barber_name = None
    barber = session.exec(select(Barber).where(Barber.chair_id == chair.id)).first()
    if barber:
        user = session.get(User, barber.user_id)
        barber_name = user.full_name if user else None
    return ChairRead(
        id=chair.id,
        branch_id=chair.branch_id,
        label=chair.label,
        is_active=chair.is_active,
        barber_name=barber_name,
    )


@router.get("", response_model=List[ChairRead])
def list_chairs(branch_id: int, session: Session = Depends(get_session)):
    chairs = session.exec(select(Chair).where(Chair.branch_id == branch_id)).all()
    return [_to_read(c, session) for c in chairs]


@router.post(
    "", response_model=ChairRead, status_code=201, dependencies=[Depends(get_current_admin)]
)
def add_chair(branch_id: int, payload: ChairCreate, session: Session = Depends(get_session)):
    """Agrega una silla más a la sucursal. El número de sillas es dinámico:
    no hay límite fijo, el admin las crea/desactiva según el local."""
    chair = Chair(branch_id=branch_id, label=payload.label)
    session.add(chair)
    session.commit()
    session.refresh(chair)
    return _to_read(chair, session)


@router.patch(
    "/{chair_id}", response_model=ChairRead, dependencies=[Depends(get_current_admin)]
)
def update_chair(
    branch_id: int, chair_id: int, payload: ChairUpdate, session: Session = Depends(get_session)
):
    chair = session.get(Chair, chair_id)
    if not chair or chair.branch_id != branch_id:
        raise HTTPException(404, "Silla no encontrada en esta sucursal.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(chair, field, value)
    session.add(chair)
    session.commit()
    session.refresh(chair)
    return _to_read(chair, session)


@router.delete("/{chair_id}", status_code=204, dependencies=[Depends(get_current_admin)])
def remove_chair(branch_id: int, chair_id: int, session: Session = Depends(get_session)):
    """Soft delete: desactiva la silla (nunca se borra si tiene historial de citas)."""
    chair = session.get(Chair, chair_id)
    if not chair or chair.branch_id != branch_id:
        raise HTTPException(404, "Silla no encontrada en esta sucursal.")
    chair.is_active = False
    session.add(chair)
    session.commit()
