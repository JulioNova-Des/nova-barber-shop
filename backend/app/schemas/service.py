from typing import Optional

from pydantic import BaseModel, Field


class ServiceCreate(BaseModel):
    name: str
    price: int = Field(gt=0, description="Precio entero (COP), sin decimales")
    duration_minutes: int = Field(
        default=30, gt=0, multiple_of=30, description="Debe ser múltiplo de 30"
    )


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = Field(default=None, gt=0)
    duration_minutes: Optional[int] = Field(default=None, gt=0, multiple_of=30)
    is_active: Optional[bool] = None


class ServiceRead(BaseModel):
    id: int
    name: str
    price: int
    duration_minutes: int
    is_active: bool

    class Config:
        from_attributes = True
