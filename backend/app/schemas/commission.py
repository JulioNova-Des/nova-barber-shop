from datetime import date as date_type
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class CommissionRuleCreate(BaseModel):
    barber_id: Optional[int] = None
    branch_id: Optional[int] = None
    applies_on: Optional[date_type] = None
    barber_pct: int = Field(ge=0, le=100)
    note: Optional[str] = None

    @model_validator(mode="after")
    def scope_check(self):
        # No puede ser barber_id Y branch_id al mismo tiempo
        if self.barber_id and self.branch_id:
            raise ValueError("Especifica barber_id O branch_id, no ambos.")
        return self


class CommissionRuleUpdate(BaseModel):
    barber_pct: int = Field(ge=0, le=100)
    applies_on: Optional[date_type] = None
    note: Optional[str] = None


class CommissionRuleRead(BaseModel):
    id: int
    barber_id: Optional[int] = None
    barber_name: Optional[str] = None
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    applies_on: Optional[date_type] = None
    barber_pct: int
    shop_pct: int
    note: Optional[str] = None

    class Config:
        from_attributes = True


class CommissionPreview(BaseModel):
    """Resultado de resolver la regla activa para un barbero en una fecha."""
    barber_id: int
    barber_name: str
    on_date: date_type
    barber_pct: int
    shop_pct: int
    rule_id: Optional[int] = None
    rule_note: Optional[str] = None
