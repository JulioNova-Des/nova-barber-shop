from datetime import time
from typing import Optional

from pydantic import BaseModel


class BranchCreate(BaseModel):
    name: str
    address: str
    city: str
    phone: Optional[str] = None
    opening_time: time = time(8, 0)
    closing_time: time = time(20, 0)


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    is_active: Optional[bool] = None


class BranchRead(BaseModel):
    id: int
    name: str
    address: str
    city: str
    phone: Optional[str] = None
    opening_time: time
    closing_time: time
    is_active: bool

    class Config:
        from_attributes = True
