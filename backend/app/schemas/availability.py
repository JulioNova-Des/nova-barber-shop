from datetime import date as date_type
from typing import List, Optional

from pydantic import BaseModel


class AvailableBarber(BaseModel):
    barber_id: int
    barber_name: str
    chair_id: int
    chair_label: str


class AvailabilitySlot(BaseModel):
    start_time: str  # "HH:MM", hora local de la sucursal
    end_time: str
    available: bool
    # Barberos/sillas concretos que pueden atender ESTA franja.
    # Vacío cuando available=False.
    available_barbers: List[AvailableBarber] = []


class AvailabilityResponse(BaseModel):
    branch_id: int
    service_id: int
    date: date_type
    duration_minutes: int
    slot_minutes: int
    slots: List[AvailabilitySlot]


class AvailabilityQuery(BaseModel):
    branch_id: int
    service_id: int
    date: date_type
    barber_id: Optional[int] = None  # si el cliente registrado filtra por su barbero habitual
