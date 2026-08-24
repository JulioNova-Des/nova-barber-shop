from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db
from app.routers import (
    admin_dashboard,
    admin_staff,
    appointments,
    auth,
    availability,
    barber,
    barber_earnings,
    branch_calendar,
    branches,
    cashier,
    chairs,
    commissions,
    gallery,
    services,
)

app = FastAPI(title="NOVA Barber Shop API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    # Configuración automática de NOVA — idempotente, no duplica datos
    from app.setup_nova import setup
    setup()


app.include_router(auth.router)
app.include_router(branches.router)
app.include_router(chairs.router)
app.include_router(services.router)
app.include_router(availability.router)
app.include_router(appointments.router)
app.include_router(barber.router)
app.include_router(barber_earnings.router_earnings)
app.include_router(cashier.router)
app.include_router(admin_staff.router)
app.include_router(commissions.router)
app.include_router(admin_dashboard.router)
app.include_router(branch_calendar.router)
app.include_router(gallery.router)


@app.get("/health")
def health():
    return {"status": "ok"}
