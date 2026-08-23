from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.models import Branch
from app.schemas.branch import BranchCreate, BranchRead, BranchUpdate

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=List[BranchRead])
def list_branches(only_active: bool = True, session: Session = Depends(get_session)):
    """Público — el flujo de reserva (paso 1) necesita listar sucursales sin login."""
    stmt = select(Branch)
    if only_active:
        stmt = stmt.where(Branch.is_active == True)  # noqa: E712
    return session.exec(stmt).all()


@router.get("/{branch_id}", response_model=BranchRead)
def get_branch(branch_id: int, session: Session = Depends(get_session)):
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(404, "Sucursal no encontrada.")
    return branch


@router.post(
    "", response_model=BranchRead, status_code=201, dependencies=[Depends(get_current_admin)]
)
def create_branch(payload: BranchCreate, session: Session = Depends(get_session)):
    branch = Branch(**payload.model_dump())
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@router.patch(
    "/{branch_id}", response_model=BranchRead, dependencies=[Depends(get_current_admin)]
)
def update_branch(branch_id: int, payload: BranchUpdate, session: Session = Depends(get_session)):
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(404, "Sucursal no encontrada.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(branch, field, value)
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=204, dependencies=[Depends(get_current_admin)])
def deactivate_branch(branch_id: int, session: Session = Depends(get_session)):
    """Soft delete: una sucursal con historial de citas nunca se borra físicamente."""
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(404, "Sucursal no encontrada.")
    branch.is_active = False
    session.add(branch)
    session.commit()
