"""
Seed Data — NOVA BARBER SHOP
================================
Pobla la tabla `services` con el catálogo inicial exacto del negocio.
Precios enteros (COP), duración fija en minutos.

Uso:
    python -m app.seed
"""

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.models.models import Service


INITIAL_SERVICES = [
    {"name": "Corte", "price": 17000, "duration_minutes": 30},
    {"name": "Corte + Barba", "price": 19000, "duration_minutes": 30},
    {"name": "Barba", "price": 6000, "duration_minutes": 30},
    {"name": "Corte niño", "price": 15000, "duration_minutes": 30},
]


def seed_services(session: Session) -> None:
    for data in INITIAL_SERVICES:
        existing = session.exec(
            select(Service).where(Service.name == data["name"])
        ).first()

        if existing:
            # Mantiene el catálogo sincronizado si se vuelve a correr el seed
            existing.price = data["price"]
            existing.duration_minutes = data["duration_minutes"]
            existing.is_active = True
            session.add(existing)
        else:
            session.add(Service(**data))

    session.commit()
    print(f"[seed] {len(INITIAL_SERVICES)} servicios sincronizados.")


def run() -> None:
    init_db()
    with Session(engine) as session:
        seed_services(session)


if __name__ == "__main__":
    run()
