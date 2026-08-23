from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.availability_engine import AvailabilityError, get_available_slots
from app.core.database import get_session
from app.schemas.availability import AvailabilityResponse

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=AvailabilityResponse)
def read_availability(
    branch_id: int = Query(..., description="Sucursal donde se agenda"),
    service_id: int = Query(..., description="Servicio a reservar"),
    date: date_type = Query(..., description="Fecha (YYYY-MM-DD)"),
    barber_id: Optional[int] = Query(
        None, description="Filtrar por barbero habitual (opcional)"
    ),
    session: Session = Depends(get_session),
):
    """
    Devuelve la grilla de franjas de 30 min para la fecha solicitada,
    cruzando sucursal + servicio (+ barbero si se especifica), marcando
    cada franja como disponible o no y con qué barbero/silla concretos.
    """
    try:
        return get_available_slots(
            session=session,
            branch_id=branch_id,
            service_id=service_id,
            target_date=date,
            barber_id=barber_id,
        )
    except AvailabilityError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
