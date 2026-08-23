from datetime import date as date_type
from typing import List

from pydantic import BaseModel


class RevenueByBranch(BaseModel):
    branch_id: int
    branch_name: str
    completed_count: int
    gross_revenue: int
    barber_total: int
    shop_total: int


class RevenueByService(BaseModel):
    service_id: int
    service_name: str
    completed_count: int
    revenue: int


class BarberPerformance(BaseModel):
    barber_id: int
    barber_name: str
    branch_name: str
    completed_count: int
    no_show_count: int
    gross_revenue: int
    barber_total: int   # lo que se lleva el barbero (suma de barber_amount)
    shop_total: int     # lo que queda para la barberia (suma de shop_amount)
    avg_pct: float      # porcentaje promedio ponderado aplicado en el periodo


class DashboardResponse(BaseModel):
    date_from: date_type
    date_to: date_type

    total_gross: int
    total_barber: int
    total_shop: int

    total_appointments: int
    completed_count: int
    no_show_count: int
    cancelled_count: int
    scheduled_count: int
    no_show_rate: float

    revenue_by_branch: List[RevenueByBranch]
    revenue_by_service: List[RevenueByService]
    top_barbers: List[BarberPerformance]
