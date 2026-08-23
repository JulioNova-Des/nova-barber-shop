"""
Motor de resolución de comisiones — NOVA BARBER SHOP
=====================================================
Dado un barber_id y una fecha, devuelve el porcentaje correcto
aplicando la cascada de prioridades definida en models.py.

La función principal es `resolve_commission(session, barber_id, on_date)`
y la usa el router de barber al marcar una cita como COMPLETED.
"""

from datetime import date as date_type
from typing import Optional, Tuple

from sqlmodel import Session, select

from app.models.models import Barber, CommissionRule

DEFAULT_BARBER_PCT = 60  # fallback si no existe ninguna regla configurada


def resolve_commission(
    session: Session,
    barber_id: int,
    on_date: date_type,
) -> Tuple[int, int]:
    """
    Devuelve (barber_pct, shop_pct) vigente para el barbero en la fecha dada.
    Prioridad (mayor especificidad gana):
        1. barber_id + applies_on  exacto
        2. barber_id + applies_on  NULL
        3. branch_id + applies_on  exacto (branch del barbero)
        4. branch_id + applies_on  NULL
        5. global    + applies_on  exacto
        6. global    + applies_on  NULL
        7. fallback  DEFAULT_BARBER_PCT / (100 - DEFAULT_BARBER_PCT)
    """
    barber = session.get(Barber, barber_id)
    branch_id = barber.branch_id if barber else None

    all_rules = session.exec(select(CommissionRule)).all()

    def _score(rule: CommissionRule) -> Optional[int]:
        # Devuelve prioridad (1=más alta … 6=más baja) o None si no aplica.
        date_match = rule.applies_on == on_date
        date_any = rule.applies_on is None

        if rule.barber_id == barber_id:
            if date_match: return 1
            if date_any:   return 2
        if branch_id and rule.branch_id == branch_id and rule.barber_id is None:
            if date_match: return 3
            if date_any:   return 4
        if rule.barber_id is None and rule.branch_id is None:
            if date_match: return 5
            if date_any:   return 6
        return None

    best: Optional[CommissionRule] = None
    best_score = 999
    for rule in all_rules:
        score = _score(rule)
        if score is not None and score < best_score:
            best_score = score
            best = rule

    barber_pct = best.barber_pct if best else DEFAULT_BARBER_PCT
    shop_pct = 100 - barber_pct
    return barber_pct, shop_pct
