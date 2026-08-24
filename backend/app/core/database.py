import os

from sqlmodel import create_engine, Session, SQLModel

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://nova:nova@localhost:5432/nova_barber",
)

# Neon da URLs tipo "postgresql://..." pero nuestro driver es psycopg (v3).
# SQLAlchemy necesita "postgresql+psycopg://..." para usar el driver correcto.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, echo=False)


def init_db() -> None:
    """Crea las tablas si no existen. En producción usar Alembic."""
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
