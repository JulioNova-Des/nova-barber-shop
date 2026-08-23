# NOVA BARBER SHOP — Sistema de Reservas

> Sistema multi-sucursal de reservas para barbería con gestión de comisiones,
> calendario en tiempo real y contabilidad por barbero.

## Stack

- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI + SQLModel + PostgreSQL
- **Deploy:** Vercel (frontend) + Render (backend) + Neon (base de datos)

## Estructura del proyecto

```
nova-barber/
├── .env.example                      # Variables de entorno (template)
├── render.yaml                       # Auto-config para Render
├── preview/
│   └── nova_preview.html             # Vista previa completa (abrir en navegador)
│
├── backend/
│   ├── Dockerfile                    # Para deploy con Docker (Railway, Fly.io)
│   ├── requirements.txt
│   └── app/
│       ├── main.py                   # FastAPI app + wiring de todos los routers
│       ├── seed.py                   # Seed de servicios iniciales
│       ├── create_admin.py           # Script para crear primer admin
│       ├── core/
│       │   ├── database.py           # Engine + Session
│       │   ├── security.py           # JWT + hashing + deps de auth/roles
│       │   ├── availability_engine.py # Motor de franjas de 30 min
│       │   └── commission_engine.py  # Resolución de comisiones (cascada 6 niveles)
│       ├── models/
│       │   └── models.py             # Branch, Chair, User, Barber, Service,
│       │                             # CommissionRule, Appointment
│       ├── schemas/                  # Pydantic: entrada/salida de cada endpoint
│       │   ├── appointment.py
│       │   ├── auth.py
│       │   ├── availability.py
│       │   ├── barber.py
│       │   ├── branch.py
│       │   ├── chair.py
│       │   ├── commission.py
│       │   ├── dashboard.py
│       │   └── service.py
│       └── routers/
│           ├── auth.py               # POST /auth/register, /auth/login, GET /auth/me
│           ├── branches.py           # CRUD sucursales (público + admin)
│           ├── chairs.py             # CRUD sillas por sucursal (admin)
│           ├── services.py           # CRUD servicios y precios (admin)
│           ├── availability.py       # GET /availability (público)
│           ├── appointments.py       # Crear/cancelar/historial de citas
│           ├── barber.py             # Agenda del barbero + marcar asistencia
│           ├── barber_earnings.py    # Balance: día/semana/mes + historial
│           ├── branch_calendar.py    # Calendario por sucursal + feed iCal
│           ├── commissions.py        # CRUD reglas de comisión (admin)
│           └── admin_dashboard.py    # Dashboard financiero con split
│
└── frontend/
    ├── vercel.json                   # Auto-config para Vercel
    ├── tailwind.config.js            # Paleta NOVA + fuentes
    ├── public/
    │   └── logo-nova.jpg             # Logo oficial
    └── src/
        ├── index.css                 # Fuentes + dark mode forzado
        ├── lib/
        │   └── api.js                # Cliente fetch (availability + appointments)
        └── components/booking/
            ├── BookingStepBranchService.jsx   # Paso 1
            ├── BookingStepDateTime.jsx        # Paso 2
            └── BookingStepConfirm.jsx         # Paso 3
```

## API — Endpoints completos

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/auth/register` | público | Registro de cliente |
| POST | `/auth/login` | público | Login (email o teléfono) |
| GET | `/auth/me` | autenticado | Datos del usuario actual |
| GET | `/branches` | público | Lista sucursales activas |
| POST/PATCH/DELETE | `/branches/{id}` | admin | CRUD sucursales |
| GET | `/branches/{id}/chairs` | público | Sillas de una sucursal |
| POST/PATCH/DELETE | `/branches/{id}/chairs/{id}` | admin | CRUD sillas (dinámico) |
| GET | `/branches/{id}/calendar` | público | Grilla sillas × horarios del día |
| GET | `/branches/{id}/calendar/week` | público | Ocupación 7 días |
| GET | `/branches/{id}/calendar.ics` | público | Feed iCal (Google Calendar) |
| GET | `/services` | público | Catálogo de servicios |
| POST/PATCH/DELETE | `/services/{id}` | admin | CRUD servicios |
| GET | `/availability` | público | Franjas de 30 min disponibles |
| POST | `/appointments` | público | Crear cita (invitado o cliente) |
| GET | `/appointments/{id}` | público | Detalle de cita |
| GET | `/appointments/me/history` | cliente | Historial del cliente |
| POST | `/appointments/{id}/cancel` | público | Cancelar cita |
| GET | `/barber/agenda` | barbero | Agenda de su silla (hoy) |
| POST | `/barber/agenda/{id}/attendance` | barbero | Marcar completado/no-show |
| GET | `/barber/balance` | barbero | Balance: hoy + semana + mes |
| GET | `/barber/balance/day` | barbero | Detalle de un día |
| GET | `/barber/balance/week` | barbero | Detalle de una semana (dom-sáb) |
| GET | `/barber/balance/month` | barbero | Detalle de un mes + historial |
| GET | `/barber/balance/history` | barbero | Lista de meses con actividad |
| GET | `/commissions` | admin | Lista reglas de comisión |
| POST | `/commissions` | admin | Crear/actualizar regla |
| PATCH/DELETE | `/commissions/{id}` | admin | Editar/eliminar regla |
| GET | `/commissions/preview` | admin | Preview del split por fecha |
| GET | `/admin/dashboard` | admin | Dashboard financiero completo |

## Deploy rápido

1. **Neon** → Crear proyecto → copiar connection string
2. **GitHub** → Subir este repo
3. **Render** → New Web Service → root: `backend` → env: `DATABASE_URL`
4. **Vercel** → Import repo → root: `frontend` → env: `VITE_API_URL`
5. **Seed** → `DATABASE_URL="..." python -m app.create_admin`

## Servicios iniciales (seed)

| Servicio | Precio | Duración |
|----------|--------|----------|
| Corte | $17.000 | 30 min |
| Corte + Barba | $19.000 | 30 min |
| Barba | $6.000 | 30 min |
| Corte niño | $15.000 | 30 min |

## Comisiones

Regla base: 60% barbero / 40% barbería. Configurable por barbero,
sucursal o fecha específica (ej: 80/20 los domingos). El porcentaje
se snapshot-ea al completar la cita — cambios futuros no alteran el historial.
