"""
Caja menor — NOVA BARBER SHOP
=================================
CRUD de gastos de caja menor. Solo admin y cajero.
"""
from datetime import date as date_type, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.models import PettyCash, User, UserRole

router = APIRouter(prefix="/petty-cash", tags=["petty-cash"])


def _require_cashier_or_admin(user: User):
    if user.role not in (UserRole.CASHIER, UserRole.ADMIN):
        raise HTTPException(403, "Requiere rol cajero o admin.")


class PettyCashCreate(BaseModel):
    date: date_type
    description: str
    amount: int


class PettyCashUpdate(BaseModel):
    date: Optional[date_type] = None
    description: Optional[str] = None
    amount: Optional[int] = None


class PettyCashRead(BaseModel):
    id: int
    date: str
    description: str
    amount: int
    created_by_name: str
    created_at: datetime


@router.get("", response_model=List[PettyCashRead])
def list_petty_cash(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_cashier_or_admin(current_user)
    today = date_type.today()
    y = year or today.year
    m = month or today.month

    stmt = (
        select(PettyCash)
        .where(PettyCash.expense_date >= date_type(y, m, 1))
        .where(PettyCash.expense_date < date_type(y + (1 if m == 12 else 0), (m % 12) + 1, 1))
        .order_by(PettyCash.expense_date.desc(), PettyCash.created_at.desc())
    )
    items = session.exec(stmt).all()
    result = []
    for item in items:
        user = session.get(User, item.created_by)
        result.append(PettyCashRead(
            id=item.id, date=item.expense_date.isoformat(),
            description=item.description, amount=item.amount,
            created_by_name=user.full_name if user else "—",
            created_at=item.created_at,
        ))
    return result


@router.post("", response_model=PettyCashRead, status_code=201)
def create_petty_cash(
    payload: PettyCashCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_cashier_or_admin(current_user)
    item = PettyCash(
        expense_date=payload.date, description=payload.description,
        amount=payload.amount, created_by=current_user.id,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return PettyCashRead(
        id=item.id, date=item.expense_date.isoformat(),
        description=item.description, amount=item.amount,
        created_by_name=current_user.full_name, created_at=item.created_at,
    )


@router.patch("/{item_id}", response_model=PettyCashRead)
def update_petty_cash(
    item_id: int, payload: PettyCashUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_cashier_or_admin(current_user)
    item = session.get(PettyCash, item_id)
    if not item:
        raise HTTPException(404, "Gasto no encontrado.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        db_field = "expense_date" if field == "date" else field
        setattr(item, db_field, value)
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    user = session.get(User, item.created_by)
    return PettyCashRead(
        id=item.id, date=item.expense_date.isoformat(),
        description=item.description, amount=item.amount,
        created_by_name=user.full_name if user else "—", created_at=item.created_at,
    )


@router.delete("/{item_id}", status_code=204)
def delete_petty_cash(
    item_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_cashier_or_admin(current_user)
    item = session.get(PettyCash, item_id)
    if not item:
        raise HTTPException(404, "Gasto no encontrado.")
    session.delete(item)
    session.commit()
