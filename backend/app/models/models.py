"""
NOVA BARBER SHOP — Modelo de datos (SQLModel)
================================================
Entidades: Branch, Chair, User, Barber, Service, CommissionRule, Appointment.

Flujo de doble confirmación:
  1. SCHEDULED  → cliente reservó
  2. ATTENDED   → barbero confirma que atendió al cliente
  3. COMPLETED  → admin/cajero confirma que se cobró → SE CALCULA LA COMISIÓN
  4. NO_SHOW    → barbero marca que el cliente no vino
  5. CANCELLED  → cliente o admin cancela

La comisión (barber_amount, shop_amount) solo se snapshot-ea cuando el
admin/cajero marca COMPLETED (paso 3). Así el ingreso solo se registra
cuando hay doble confirmación: servicio realizado Y pago cobrado.

Roles:
  - CLIENT:  se autorregistra, reserva citas.
  - BARBER:  lo crea el admin. Ve su silla, marca ATTENDED/NO_SHOW.
  - CASHIER: lo crea el admin. Confirma pagos (ATTENDED → COMPLETED).
  - ADMIN:   gestiona todo. Puede hacer lo del cajero también.
"""

import enum
from datetime import date, datetime, time
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import UniqueConstraint, Index


SLOT_MINUTES = 30


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    CLIENT = "client"
    BARBER = "barber"
    CASHIER = "cashier"
    ADMIN = "admin"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"    # reservada
    ATTENDED = "attended"      # barbero confirma que atendió
    COMPLETED = "completed"    # admin/cajero confirma pago → comisión calculada
    NO_SHOW = "no_show"        # barbero marca ausencia
    CANCELLED = "cancelled"    # cancelada


# ---------------------------------------------------------------------------
# Branch
# ---------------------------------------------------------------------------

class Branch(SQLModel, table=True):
    __tablename__ = "branches"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    address: str
    city: str
    phone: Optional[str] = None
    is_active: bool = Field(default=True)
    opening_time: time = Field(default=time(8, 0))
    closing_time: time = Field(default=time(20, 0))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    chairs: List["Chair"] = Relationship(back_populates="branch")
    barbers: List["Barber"] = Relationship(back_populates="branch")
    appointments: List["Appointment"] = Relationship(back_populates="branch")
    commission_rules: List["CommissionRule"] = Relationship(back_populates="branch")


# ---------------------------------------------------------------------------
# Chair
# ---------------------------------------------------------------------------

class Chair(SQLModel, table=True):
    __tablename__ = "chairs"
    __table_args__ = (
        UniqueConstraint("branch_id", "label", name="uq_chair_label_per_branch"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    branch_id: int = Field(foreign_key="branches.id", index=True)
    label: str
    is_active: bool = Field(default=True)

    branch: Branch = Relationship(back_populates="chairs")
    barber: Optional["Barber"] = Relationship(back_populates="chair")
    appointments: List["Appointment"] = Relationship(back_populates="chair")


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str
    email: Optional[str] = Field(default=None, unique=True, index=True)
    phone: str = Field(index=True)
    hashed_password: Optional[str] = None
    role: UserRole = Field(default=UserRole.CLIENT, index=True)
    is_active: bool = Field(default=True)
    must_change_password: bool = Field(default=False)  # para cuentas creadas por admin
    created_at: datetime = Field(default_factory=datetime.utcnow)

    preferred_branch_id: Optional[int] = Field(default=None, foreign_key="branches.id")
    preferred_barber_id: Optional[int] = Field(default=None, foreign_key="barbers.id")

    barber_profile: Optional["Barber"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"foreign_keys": "Barber.user_id"},
    )
    appointments: List["Appointment"] = Relationship(
        back_populates="client",
        sa_relationship_kwargs={"foreign_keys": "Appointment.client_id"},
    )


# ---------------------------------------------------------------------------
# Barber
# ---------------------------------------------------------------------------

class Barber(SQLModel, table=True):
    __tablename__ = "barbers"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True)
    branch_id: int = Field(foreign_key="branches.id", index=True)
    chair_id: int = Field(foreign_key="chairs.id", unique=True)
    bio: Optional[str] = None
    is_active: bool = Field(default=True)

    user: User = Relationship(
        back_populates="barber_profile",
        sa_relationship_kwargs={"foreign_keys": "Barber.user_id"},
    )
    branch: Branch = Relationship(back_populates="barbers")
    chair: Chair = Relationship(back_populates="barber")
    appointments: List["Appointment"] = Relationship(back_populates="barber")
    commission_rules: List["CommissionRule"] = Relationship(back_populates="barber")
    gallery_photos: List["GalleryPhoto"] = Relationship(back_populates="barber")


# ---------------------------------------------------------------------------
# GalleryPhoto — fotos de cortes subidas por los barberos
# ---------------------------------------------------------------------------

class GalleryPhoto(SQLModel, table=True):
    __tablename__ = "gallery_photos"

    id: Optional[int] = Field(default=None, primary_key=True)
    barber_id: int = Field(foreign_key="barbers.id", index=True)
    branch_id: int = Field(foreign_key="branches.id", index=True)

    image_url: str           # URL de la imagen (Cloudinary, S3, etc.)
    caption: Optional[str] = None  # ej: "Degradado texturizado"
    service_id: Optional[int] = Field(default=None, foreign_key="services.id")

    is_active: bool = Field(default=True)
    is_featured: bool = Field(default=False)  # admin puede destacar
    created_at: datetime = Field(default_factory=datetime.utcnow)

    barber: Barber = Relationship(back_populates="gallery_photos")


# ---------------------------------------------------------------------------
# CommissionRule
# ---------------------------------------------------------------------------

class CommissionRule(SQLModel, table=True):
    __tablename__ = "commission_rules"
    __table_args__ = (
        UniqueConstraint(
            "barber_id", "branch_id", "applies_on",
            name="uq_commission_scope_date",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    barber_id: Optional[int] = Field(default=None, foreign_key="barbers.id", index=True)
    branch_id: Optional[int] = Field(default=None, foreign_key="branches.id", index=True)
    applies_on: Optional[date] = Field(default=None, index=True)
    barber_pct: int = Field(ge=0, le=100)
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    barber: Optional[Barber] = Relationship(back_populates="commission_rules")
    branch: Optional[Branch] = Relationship(back_populates="commission_rules")


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class Service(SQLModel, table=True):
    __tablename__ = "services"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    price: int
    duration_minutes: int = Field(default=SLOT_MINUTES)
    is_active: bool = Field(default=True)

    appointments: List["Appointment"] = Relationship(back_populates="service")


# ---------------------------------------------------------------------------
# Appointment — con doble confirmación
# ---------------------------------------------------------------------------

class Appointment(SQLModel, table=True):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_chair_start_time", "chair_id", "start_time", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    branch_id: int = Field(foreign_key="branches.id", index=True)
    chair_id: int = Field(foreign_key="chairs.id", index=True)
    barber_id: Optional[int] = Field(default=None, foreign_key="barbers.id", index=True)
    service_id: int = Field(foreign_key="services.id")

    client_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None

    start_time: datetime = Field(index=True)
    end_time: datetime

    status: AppointmentStatus = Field(default=AppointmentStatus.SCHEDULED, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # --- Doble confirmación ---
    # Paso 1: barbero marca "atendido" (SCHEDULED → ATTENDED)
    attended_at: Optional[datetime] = Field(default=None)
    attended_by: Optional[int] = Field(default=None, foreign_key="users.id")

    # Paso 2: admin/cajero confirma pago (ATTENDED → COMPLETED)
    payment_confirmed_at: Optional[datetime] = Field(default=None)
    payment_confirmed_by: Optional[int] = Field(default=None, foreign_key="users.id")

    # --- Comisión (se calcula SOLO al confirmar pago, paso 2) ---
    barber_pct_snapshot: Optional[int] = Field(default=None)
    shop_pct_snapshot: Optional[int] = Field(default=None)
    barber_amount: Optional[int] = Field(default=None)
    shop_amount: Optional[int] = Field(default=None)

    branch: Branch = Relationship(back_populates="appointments")
    chair: Chair = Relationship(back_populates="appointments")
    barber: Optional[Barber] = Relationship(back_populates="appointments")
    service: Service = Relationship(back_populates="appointments")
    client: Optional[User] = Relationship(
        back_populates="appointments",
        sa_relationship_kwargs={"foreign_keys": "Appointment.client_id"},
    )


# ---------------------------------------------------------------------------
# PageVisit — contador de visitas a la página (mensual)
# ---------------------------------------------------------------------------

class PageVisit(SQLModel, table=True):
    __tablename__ = "page_visits"

    id: Optional[int] = Field(default=None, primary_key=True)
    year: int = Field(index=True)
    month: int = Field(index=True)
    day: int
    count: int = Field(default=0)
    # Unique constraint: una fila por día
    __table_args__ = (
        UniqueConstraint("year", "month", "day", name="uq_visit_day"),
    )
