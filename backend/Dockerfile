# Dockerfile — NOVA Barber Shop backend
# Usá este Dockerfile si preferís deploy con Docker (Fly.io, Railway, etc.)
# En Render no es necesario — Render detecta Python automáticamente.

FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema para psycopg y bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render inyecta $PORT; otros proveedores pueden requerir un default
ENV PORT=8000

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
