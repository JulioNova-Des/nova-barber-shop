"""
Analytics — NOVA BARBER SHOP
================================
Contador de visitas a la página con historial mensual.

POST /analytics/visit     → público, incrementa el contador del día actual
GET  /analytics/visits    → admin, estadísticas de visitas
"""

from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.models import PageVisit

router = APIRouter(prefix="/analytics", tags=["analytics"])


class DailyVisit(BaseModel):
    date: str
    count: int


class MonthlyVisit(BaseModel):
    year: int
    month: int
    month_label: str
    total: int
    days: List[DailyVisit]


class VisitsResponse(BaseModel):
    today: int
    this_month: int
    history: List[MonthlyVisit]


MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
               "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


@router.post("/visit", status_code=204)
def track_visit(session: Session = Depends(get_session)):
    """Público — el frontend llama esto cada vez que alguien abre la página."""
    today = date_type.today()
    visit = session.exec(
        select(PageVisit)
        .where(PageVisit.year == today.year)
        .where(PageVisit.month == today.month)
        .where(PageVisit.day == today.day)
    ).first()

    if visit:
        visit.count += 1
    else:
        visit = PageVisit(year=today.year, month=today.month, day=today.day, count=1)
    session.add(visit)
    session.commit()


@router.get("/visits", response_model=VisitsResponse, dependencies=[Depends(get_current_admin)])
def get_visits(
    months: int = Query(6, ge=1, le=24, description="Meses de historial"),
    session: Session = Depends(get_session),
):
    """Admin — estadísticas de visitas con historial mensual."""
    today = date_type.today()

    # Today's count
    today_visit = session.exec(
        select(PageVisit)
        .where(PageVisit.year == today.year)
        .where(PageVisit.month == today.month)
        .where(PageVisit.day == today.day)
    ).first()
    today_count = today_visit.count if today_visit else 0

    # This month total
    month_visits = session.exec(
        select(PageVisit)
        .where(PageVisit.year == today.year)
        .where(PageVisit.month == today.month)
    ).all()
    this_month_total = sum(v.count for v in month_visits)

    # History by month
    all_visits = session.exec(
        select(PageVisit).order_by(PageVisit.year.desc(), PageVisit.month.desc(), PageVisit.day)
    ).all()

    months_map = {}
    for v in all_visits:
        key = f"{v.year}-{v.month:02d}"
        if key not in months_map:
            months_map[key] = {"year": v.year, "month": v.month, "days": [], "total": 0}
        months_map[key]["days"].append(
            DailyVisit(date=f"{v.year}-{v.month:02d}-{v.day:02d}", count=v.count)
        )
        months_map[key]["total"] += v.count

    history = sorted(
        [
            MonthlyVisit(
                year=m["year"], month=m["month"],
                month_label=f"{MONTH_NAMES[m['month']]} {m['year']}",
                total=m["total"], days=m["days"],
            )
            for m in months_map.values()
        ],
        key=lambda x: (x.year, x.month),
        reverse=True,
    )[:months]

    return VisitsResponse(today=today_count, this_month=this_month_total, history=history)
