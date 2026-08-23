from datetime import datetime
from typing import Optional

from pydantic import BaseModel, model_validator

from app.models.models import AppointmentStatus


class AppointmentCreate(BaseModel):
    branch_id: int
    service_id: int
    chair_id: int
    barber_id: int
    start_time: datetime  # ya viene con fecha+hora combinadas del paso 2

    # Solo aplican si NO hay un cliente autenticado (Bearer token). Si el
    # request trae token válido de cliente registrado, estos campos se
    # ignoran en el router y se usa el usuario autenticado.
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None

    @model_validator(mode="after")
    def guest_fields_together(self):
        has_name = bool(self.guest_name and self.guest_name.strip())
        has_phone = bool(self.guest_phone and self.guest_phone.strip())
        if has_name != has_phone:
            raise ValueError(
                "guest_name y guest_phone deben enviarse juntos (o ninguno, si hay sesión)."
            )
        return self


class AppointmentRead(BaseModel):
    id: int
    branch_id: int
    branch_name: str
    chair_id: int
    chair_label: str
    barber_id: Optional[int] = None
    barber_name: Optional[str] = None
    service_id: int
    service_name: str
    price: int

    client_name: str
    client_phone: str
    is_guest: bool

    start_time: datetime
    end_time: datetime
    status: AppointmentStatus
    created_at: datetime

    class Config:
        from_attributes = True
