"""
Setup — NOVA BARBER SHOP (Candelaria, Valle)
===============================================
Limpia datos de configuración y recrea con datos actualizados.
El admin existente se conserva.
"""

from datetime import time
from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.core.security import hash_password
from app.models.models import (
    Barber, Branch, Chair, CommissionRule, Service, User, UserRole,
)


def setup():
    init_db()

    with Session(engine) as s:
        # ============================================================
        # 1. ADMIN — conservar si existe, crear si no
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
            print(f"[admin] Conservado: {admin.email} (id={admin.id})")

        # ============================================================
        # 2. LIMPIAR staff anterior (excepto admin)
        # ============================================================
        old_barbers = s.exec(select(Barber)).all()
        for b in old_barbers:
            b.is_active = False
            s.add(b)
        old_staff = s.exec(
            select(User).where(User.role.in_([UserRole.BARBER, UserRole.CASHIER]))
        ).all()
        for u in old_staff:
            u.is_active = False
            s.add(u)
        s.commit()
        print("[limpieza] Staff anterior desactivado")

        # ============================================================
        # 3. SUCURSAL
        # ============================================================
        branch = s.exec(select(Branch).where(Branch.name == "Nova Barber Shop")).first()
        if branch:
            branch.address = "Calle 5 # 4 - 63"
            branch.city = "Candelaria"
            branch.phone = "3207970201"
            branch.opening_time = time(9, 0)
            branch.closing_time = time(21, 0)
            branch.is_active = True
            s.add(branch)
            s.commit()
            s.refresh(branch)
            print(f"[sucursal] Actualizada: {branch.name} (id={branch.id})")
        else:
            branch = Branch(
                name="Nova Barber Shop",
                address="Calle 5 # 4 - 63",
                city="Candelaria",
                phone="3207970201",
                opening_time=time(9, 0),
                closing_time=time(21, 0),
                is_active=True,
            )
            s.add(branch)
            s.commit()
            s.refresh(branch)
            print(f"[sucursal] Creada: {branch.name} (id={branch.id})")

        # Desactivar otras sucursales
        other = s.exec(select(Branch).where(Branch.id != branch.id)).all()
        for ob in other:
            ob.is_active = False
            s.add(ob)
        s.commit()

        # ============================================================
        # 4. SILLAS (3)
        # ============================================================
        chairs = {}
        for label in ["Silla 1", "Silla 2", "Silla 3"]:
            chair = s.exec(
                select(Chair)
                .where(Chair.branch_id == branch.id)
                .where(Chair.label == label)
            ).first()
            if not chair:
                chair = Chair(branch_id=branch.id, label=label, is_active=True)
                s.add(chair)
                s.commit()
                s.refresh(chair)
                print(f"[silla] Creada: {label} (id={chair.id})")
            else:
                chair.is_active = True
                s.add(chair)
                s.commit()
                s.refresh(chair)
                print(f"[silla] OK: {label} (id={chair.id})")
            chairs[label] = chair

        # ============================================================
        # 5. BARBEROS
        # ============================================================
        barberos = [
            {
                "full_name": "Gustavo Moreno",
                "phone": "3170724789",
                "emergency": "3148027541",
                "chair": "Silla 2",
            },
            {
                "full_name": "Juan Carlos Moreno",
                "phone": "3117632525",
                "emergency": "3170724789",
                "chair": "Silla 3",
            },
        ]

        print("\n" + "=" * 55)
        print("  CREDENCIALES DEL EQUIPO")
        print("=" * 55)

        for bb in barberos:
            temp_pw = f"nova{bb['phone'][-4:]}"

            user = s.exec(select(User).where(User.phone == bb["phone"])).first()
            if user:
                user.full_name = bb["full_name"]
                user.role = UserRole.BARBER
                user.is_active = True
                user.emergency_contact = bb["emergency"]
                s.add(user)
                s.commit()
                s.refresh(user)
            else:
                user = User(
                    full_name=bb["full_name"],
                    phone=bb["phone"],
                    hashed_password=hash_password(temp_pw),
                    role=UserRole.BARBER,
                    is_active=True,
                    must_change_password=True,
                    emergency_contact=bb["emergency"],
                )
                s.add(user)
                s.commit()
                s.refresh(user)

            barber = s.exec(select(Barber).where(Barber.user_id == user.id)).first()
            if barber:
                barber.is_active = True
                barber.chair_id = chairs[bb["chair"]].id
                barber.branch_id = branch.id
                s.add(barber)
                s.commit()
            else:
                barber = Barber(
                    user_id=user.id,
                    branch_id=branch.id,
                    chair_id=chairs[bb["chair"]].id,
                    is_active=True,
                )
                s.add(barber)
                s.commit()

            print(f"  {bb['full_name']:22s} | tel: {bb['phone']:12s} | pw: {temp_pw:10s} | {bb['chair']}")

        # ============================================================
        # 6. CAJERA
        # ============================================================
        cajera_pw = "nova7541"
        cajera = s.exec(select(User).where(User.phone == "3148027541")).first()
        if cajera:
            cajera.full_name = "Nathalia Muñoz"
            cajera.role = UserRole.CASHIER
            cajera.is_active = True
            cajera.emergency_contact = "3170724789"
            s.add(cajera)
            s.commit()
        else:
            cajera = User(
                full_name="Nathalia Muñoz",
                phone="3148027541",
                hashed_password=hash_password(cajera_pw),
                role=UserRole.CASHIER,
                is_active=True,
                must_change_password=True,
                emergency_contact="3170724789",
            )
            s.add(cajera)
            s.commit()

        print(f"  {'Nathalia Muñoz':22s} | tel: {'3148027541':12s} | pw: {cajera_pw:10s} | Cajera")
        print("=" * 55)

        # ============================================================
        # 7. SERVICIOS
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
                s.add(Service(**sv, is_active=True))

        # Desactivar servicios que no estén en la lista
        all_svcs = s.exec(select(Service)).all()
        active_names = {sv["name"] for sv in servicios}
        for svc in all_svcs:
            if svc.name not in active_names:
                svc.is_active = False
                s.add(svc)

        s.commit()
        print(f"\n[servicios] Corte ($17.000), Corte + Barba ($19.000), Barba ($6.000)")

        # ============================================================
        # 8. COMISIÓN BASE 60/40
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
        print(f"[comisión] 60% barbero / 40% barbería")

        # ============================================================
        print("\n" + "=" * 55)
        print("  ✅ NOVA BARBER SHOP — CONFIGURACIÓN COMPLETA")
        print("=" * 55)
        print(f"  Sucursal:    {branch.name}")
        print(f"  Dirección:   {branch.address}, {branch.city}")
        print(f"  Teléfono:    {branch.phone}")
        print(f"  Horario:     9:00 AM — 9:00 PM")
        print(f"  Sillas:      3 (Silla 1 libre, Silla 2 Gustavo, Silla 3 Juan Carlos)")
        print(f"  Cajera:      Nathalia Muñoz")
        print(f"  Admin:       novabarbercol@gmail.com")
        print("=" * 55)


if __name__ == "__main__":
    setup()
