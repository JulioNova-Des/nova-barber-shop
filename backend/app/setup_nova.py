"""
Setup completo — NOVA BARBER SHOP (Candelaria, Valle)
=======================================================
Corre este script UNA VEZ después del deploy para dejar todo
configurado y listo para operar.

Uso:
    DATABASE_URL="postgresql://..." python -m app.setup_nova

Crea:
  - Admin (si no existe)
  - Sucursal: Nova Barber Shop, Candelaria Valle
  - 3 sillas
  - 3 barberos con contraseñas temporales
  - 1 cajera
  - 4 servicios (Corte, Corte+Barba, Barba, Corte niño)
  - Regla de comisión base 60/40
"""

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.core.security import hash_password
from app.models.models import (
    Barber,
    Branch,
    Chair,
    CommissionRule,
    Service,
    User,
    UserRole,
)


def setup():
    init_db()

    with Session(engine) as s:
        # ============================================================
        # 1. ADMIN
        # ============================================================
        admin = s.exec(select(User).where(User.email == "novabarbercol@gmail.com")).first()
        if not admin:
            admin = User(
                full_name="novabarber",
                phone="+573117632526",
                email="novabarbercol@gmail.com",
                hashed_password=hash_password("nova2026*"),
                role=UserRole.ADMIN,
            )
            s.add(admin)
            s.commit()
            s.refresh(admin)
            print(f"[admin] Creado: {admin.email}")
        else:
            print(f"[admin] Ya existe: {admin.email} (id={admin.id})")

        # ============================================================
        # 2. SUCURSAL
        # ============================================================
        branch = s.exec(select(Branch).where(Branch.name == "Nova Barber Shop")).first()
        if not branch:
            from datetime import time
            branch = Branch(
                name="Nova Barber Shop",
                address="Calle 9 #4-63",
                city="Candelaria, Valle",
                opening_time=time(9, 0),   # 9:00 AM
                closing_time=time(21, 0),  # 9:00 PM
            )
            s.add(branch)
            s.commit()
            s.refresh(branch)
            print(f"[sucursal] Creada: {branch.name} (id={branch.id})")
        else:
            print(f"[sucursal] Ya existe: {branch.name} (id={branch.id})")

        # ============================================================
        # 3. SILLAS
        # ============================================================
        chairs = {}
        for label in ["Silla 1", "Silla 2", "Silla 3"]:
            chair = s.exec(
                select(Chair)
                .where(Chair.branch_id == branch.id)
                .where(Chair.label == label)
            ).first()
            if not chair:
                chair = Chair(branch_id=branch.id, label=label)
                s.add(chair)
                s.commit()
                s.refresh(chair)
                print(f"[silla] Creada: {label} (id={chair.id})")
            else:
                print(f"[silla] Ya existe: {label} (id={chair.id})")
            chairs[label] = chair

        # ============================================================
        # 4. BARBEROS
        # ============================================================
        barberos = [
            {"name": "Juan Carlos",  "phone": "3117632525",  "chair": "Silla 3"},
            {"name": "Gustavo",  "phone": "3170724789", "chair": "Silla 2"},
        ]

        print("\n" + "=" * 50)
        print("  CONTRASEÑAS DE BARBEROS (anotar y entregar)")
        print("=" * 50)

        for bb in barberos:
            user = s.exec(select(User).where(User.phone == bb["phone"])).first()
            temp_pw = f"nova{bb['phone'][-4:]}"  # ej: nova3455

            if not user:
                user = User(
                    full_name=bb["name"],
                    phone=bb["phone"],
                    hashed_password=hash_password(temp_pw),
                    role=UserRole.BARBER,
                    must_change_password=True,
                )
                s.add(user)
                s.commit()
                s.refresh(user)
            else:
                print(f"  [barbero] Ya existe: {bb['name']}")

            # Crear perfil Barber si no existe
            barber = s.exec(select(Barber).where(Barber.user_id == user.id)).first()
            if not barber:
                barber = Barber(
                    user_id=user.id,
                    branch_id=branch.id,
                    chair_id=chairs[bb["chair"]].id,
                )
                s.add(barber)
                s.commit()
                s.refresh(barber)

            print(f"  {bb['name']:12s} | tel: {bb['phone']:12s} | pw: {temp_pw:10s} | {bb['chair']}")

        print("=" * 50)

        # ============================================================
        # 5. CAJERA
        # ============================================================
        cajera = s.exec(select(User).where(User.phone == "3148027541")).first()
        cajera_pw = "nova7541"
        if not cajera:
            cajera = User(
                full_name="Nathaly",
                phone="3148027541",
                hashed_password=hash_password(cajera_pw),
                role=UserRole.CASHIER,
                must_change_password=True,
            )
            s.add(cajera)
            s.commit()
            s.refresh(cajera)

        print(f"\n  CAJERA: Nathaly | tel: 3148027541 | pw: {cajera_pw}")

        # ============================================================
        # 6. SERVICIOS
        # ============================================================
        servicios = [
            {"name": "Corte",         "price": 17000, "duration_minutes": 30},
            {"name": "Corte + Barba", "price": 19000, "duration_minutes": 30},
            {"name": "Barba",         "price": 6000,  "duration_minutes": 30},
        ]
        for sv in servicios:
            existing = s.exec(select(Service).where(Service.name == sv["name"])).first()
            if existing:
                existing.price = sv["price"]
                existing.duration_minutes = sv["duration_minutes"]
                existing.is_active = True
                s.add(existing)
            else:
                s.add(Service(**sv))
        # Desactivar Corte niño si existe
        corte_nino = s.exec(select(Service).where(Service.name == "Corte niño")).first()
        if corte_nino:
            corte_nino.is_active = False
            s.add(corte_nino)
        s.commit()
        print(f"\n[servicios] 3 servicios configurados")

        # ============================================================
        # 7. COMISIÓN BASE 60/40
        # ============================================================
        rule = s.exec(
            select(CommissionRule)
            .where(CommissionRule.barber_id == None)
            .where(CommissionRule.branch_id == None)
            .where(CommissionRule.applies_on == None)
        ).first()
        if not rule:
            rule = CommissionRule(barber_pct=60, note="Regla base 60/40")
            s.add(rule)
            s.commit()
            print(f"[comisión] Regla base: 60% barbero / 40% barbería")
        else:
            print(f"[comisión] Ya existe regla base: {rule.barber_pct}%/{100 - rule.barber_pct}%")

        # ============================================================
        # RESUMEN
        # ============================================================
        print("\n" + "=" * 50)
        print("  ✅ NOVA BARBER SHOP — CONFIGURACIÓN COMPLETA")
        print("=" * 50)
        print(f"  Sucursal:  {branch.name}")
        print(f"  Dirección: {branch.address}, {branch.city}")
        print(f"  Horario:   {branch.opening_time} — {branch.closing_time}")
        print(f"  Sillas:    3")
        print(f"  Barberos:  Juan Carlos, Gustavo")
        print(f"  Cajera:    Nathaly")
        print(f"  Comisión:  60% barbero / 40% barbería")
        print(f"  Admin:     novabarbercol@gmail.com")
        print("=" * 50)


if __name__ == "__main__":
    setup()
