from typing import Optional

from pydantic import BaseModel


class ChairCreate(BaseModel):
    label: str  # ej: "Silla 1" — el admin define el número de sillas libremente


class ChairUpdate(BaseModel):
    label: Optional[str] = None
    is_active: Optional[bool] = None


class ChairRead(BaseModel):
    id: int
    branch_id: int
    label: str
    is_active: bool
    barber_name: Optional[str] = None  # None si la silla aún no tiene barbero asignado
