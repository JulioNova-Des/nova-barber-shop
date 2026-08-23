from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.models import AppointmentStatus


class BarberAgendaItem(BaseModel):
    appointment_id: int
    client_name: str
    client_phone: str
    is_guest: bool
    service_name: str
    service_price: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus
    barber_pct_snapshot: Optional[int] = None
    shop_pct_snapshot: Optional[int] = None
    barber_amount: Optional[int] = None
    shop_amount: Optional[int] = None
    payment_confirmed: bool = False  # True solo cuando el cajero/admin confirmo


class MarkAttendanceRequest(BaseModel):
    status: AppointmentStatus  # solo ATTENDED o NO_SHOW
