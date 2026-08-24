import os

from sqlmodel import create_engine, Session, SQLModel

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://nova:nova@localhost:5432/nova_barber",
)

# Neon/Render pueden dar URLs con distintos prefijos:
#   postgres://...       → viejo, SQLAlchemy busca psycopg2 (no instalado)
#   postgresql://...     → igual, busca psycopg2
# Nuestro driver es psycopg v3, necesita:
#   postgresql+psycopg://...
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, echo=False)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
