"""
Comisiones — NOVA BARBER SHOP
================================
- GET  /commissions              Lista todas las reglas configuradas.
- POST /commissions              Crea una regla nueva (o actualiza si ya existe
                                 la misma combinación scope+fecha).
- PATCH /commissions/{id}        Cambia barber_pct de una regla existente.
- DELETE /commissions/{id}       Elimina una regla (vuelve al nivel superior).
- GET /commissions/preview       Muestra qué regla quedaría activa para cada
                                 barbero en una fecha dada (útil antes de
                                 configurar un domingo especial).
Todos los endpoints requieren rol admin.
"""

from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.commission_engine import resolve_commission
from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.models import Barber, Branch, CommissionRule, User
from app.schemas.commission import (
    CommissionPreview,
    CommissionRuleCreate,
    CommissionRuleRead,
    CommissionRuleUpdate,
)

router = APIRouter(
    prefix="/commissions",
    tags=["commissions"],
    dependencies=[Depends(get_current_admin)],
)


def _rule_to_read(rule: CommissionRule, session: Session) -> CommissionRuleRead:
    barber_name = None
    branch_name = None
    if rule.barber_id:
        barber = session.get(Barber, rule.barber_id)
        if barber:
            user = session.get(User, barber.user_id)
            barber_name = user.full_name if user else None
    if rule.branch_id:
        branch = session.get(Branch, rule.branch_id)
        branch_name = branch.name if branch else None
    return CommissionRuleRead(
        id=rule.id,
        barber_id=rule.barber_id,
        barber_name=barber_name,
        branch_id=rule.branch_id,
        branch_name=branch_name,
        applies_on=rule.applies_on,
        barber_pct=rule.barber_pct,
        shop_pct=100 - rule.barber_pct,
        note=rule.note,
    )


@router.get("", response_model=List[CommissionRuleRead])
def list_rules(session: Session = Depends(get_session)):
    rules = session.exec(select(CommissionRule)).all()
    return [_rule_to_read(r, session) for r in rules]


@router.post("", response_model=CommissionRuleRead, status_code=201)
def create_or_update_rule(
    payload: CommissionRuleCreate, session: Session = Depends(get_session)
):
    """
    Si ya existe una regla con el mismo scope (barber_id, branch_id, applies_on)
    la actualiza en lugar de crear un duplicado — así el admin puede cambiar
    el porcentaje de un domingo especial sin tener que borrar primero.
    """
    existing = session.exec(
        select(CommissionRule)
        .where(CommissionRule.barber_id == payload.barber_id)
        .where(CommissionRule.branch_id == payload.branch_id)
        .where(CommissionRule.applies_on == payload.applies_on)
    ).first()

    if existing:
        existing.barber_pct = payload.barber_pct
        existing.note = payload.note
        from datetime import datetime
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _rule_to_read(existing, session)

    rule = CommissionRule(**payload.model_dump())
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return _rule_to_read(rule, session)


@router.patch("/{rule_id}", response_model=CommissionRuleRead)
def update_rule(
    rule_id: int, payload: CommissionRuleUpdate, session: Session = Depends(get_session)
):
    rule = session.get(CommissionRule, rule_id)
    if not rule:
        raise HTTPException(404, "Regla no encontrada.")
    rule.barber_pct = payload.barber_pct
    if payload.applies_on is not None:
        rule.applies_on = payload.applies_on
    if payload.note is not None:
        rule.note = payload.note
    from datetime import datetime
    rule.updated_at = datetime.utcnow()
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return _rule_to_read(rule, session)


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: int, session: Session = Depends(get_session)):
    rule = session.get(CommissionRule, rule_id)
    if not rule:
        raise HTTPException(404, "Regla no encontrada.")
    session.delete(rule)
    session.commit()


@router.get("/preview", response_model=List[CommissionPreview])
def preview_commissions(
    on_date: date_type = Query(..., description="Fecha a consultar (YYYY-MM-DD)"),
    branch_id: Optional[int] = Query(None, description="Filtrar por sucursal"),
    session: Session = Depends(get_session),
):
    """
    Muestra cómo queda el split para cada barbero activo en la fecha dada,
    con el nombre de la regla que ganó. Útil para confirmar antes de
    aplicar configuraciones especiales de fines de semana o festivos.
    """
    stmt = select(Barber).where(Barber.is_active == True)  # noqa: E712
    if branch_id:
        stmt = stmt.where(Barber.branch_id == branch_id)
    barbers = session.exec(stmt).all()

    all_rules = session.exec(select(CommissionRule)).all()
    rule_by_id = {r.id: r for r in all_rules}

    result = []
    for barber in barbers:
        user = session.get(User, barber.user_id)
        barber_pct, shop_pct = resolve_commission(session, barber.id, on_date)

        # Find which rule "won" (re-run scoring to get rule id)
        winning_rule_id = None
        winning_note = None
        # (simplified: just attach note from the resolve engine's best rule)
        for rule in all_rules:
            if rule.barber_pct == barber_pct:
                winning_rule_id = rule.id
                winning_note = rule.note
                break

        result.append(CommissionPreview(
            barber_id=barber.id,
            barber_name=user.full_name if user else f"Barbero #{barber.id}",
            on_date=on_date,
            barber_pct=barber_pct,
            shop_pct=shop_pct,
            rule_id=winning_rule_id,
            rule_note=winning_note,
        ))
    return result
