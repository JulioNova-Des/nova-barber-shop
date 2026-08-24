import os
import re

from sqlmodel import create_engine, Session, SQLModel

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://nova:nova@localhost:5432/nova_barber",
)

# Forzar el driver psycopg v3 sin importar qué prefijo venga.
# Cubre: postgres://, postgresql://, postgresql+psycopg2://, etc.
DATABASE_URL = re.sub(
    r"^postgres(ql)?(\+\w+)?://",
    "postgresql+psycopg://",
    DATABASE_URL,
)

engine = create_engine(DATABASE_URL, echo=False)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
