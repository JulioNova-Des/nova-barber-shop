"""
Crear admin inicial — NOVA BARBER SHOP
========================================
Corre este script UNA VEZ después del primer deploy para crear el
usuario admin que gestionará sucursales, sillas, servicios y comisiones.

Uso (desde la raíz del backend):
    DATABASE_URL="postgresql://..." python -m app.create_admin

También corre el seed de servicios si no se ha hecho.
"""

import os
import sys

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.core.security import hash_password
from app.models.models import User, UserRole
from app.seed import seed_services


def create_admin():
    init_db()

    with Session(engine) as session:
        # Seed de servicios
        seed_services(session)

        # Verificar si ya existe un admin
        existing = session.exec(
            select(User).where(User.role == UserRole.ADMIN)
        ).first()
        if existing:
            print(f"[admin] Ya existe un admin: {existing.full_name} ({existing.email})")
            return

        # Leer datos del admin desde env o input
        name = os.getenv("ADMIN_NAME") or input("Nombre del admin: ").strip()
        email = os.getenv("ADMIN_EMAIL") or input("Email: ").strip()
        phone = os.getenv("ADMIN_PHONE") or input("WhatsApp: ").strip()
        password = os.getenv("ADMIN_PASSWORD") or input("Contraseña: ").strip()

        if not all([name, email, phone, password]):
            print("[error] Todos los campos son obligatorios.")
            sys.exit(1)

        admin = User(
            full_name=name,
            email=email,
            phone=phone,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)
        print(f"[admin] Creado: {admin.full_name} (id={admin.id})")

        # Crear regla de comisión global por defecto (60/40)
        from app.models.models import CommissionRule
        existing_rule = session.exec(
            select(CommissionRule).where(
                CommissionRule.barber_id == None,
                CommissionRule.branch_id == None,
                CommissionRule.applies_on == None,
            )
        ).first()
        if not existing_rule:
            rule = CommissionRule(barber_pct=60, note="Regla base 60/40")
            session.add(rule)
            session.commit()
            print("[commission] Regla global 60/40 creada.")


if __name__ == "__main__":
    create_admin()
