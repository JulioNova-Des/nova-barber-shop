const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("nova_token");
  const user = localStorage.getItem("nova_user");
  // Solo enviar token si es un cliente (no staff)
  if (token && user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed.role === "client") return { Authorization: `Bearer ${token}` };
    } catch (e) {}
  }
  return {};
}

export async function getAvailability({ branchId, serviceId, date, barberId }) {
  const params = new URLSearchParams({ branch_id: branchId, service_id: serviceId, date });
  if (barberId) params.set("barber_id", barberId);
  const res = await fetch(`${BASE_URL}/availability?${params.toString()}`);
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail ?? "Error de disponibilidad."); }
  return res.json();
}

export async function createAppointment({ branchId, serviceId, chairId, barberId, startTime, guestName, guestPhone }) {
  const res = await fetch(`${BASE_URL}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      branch_id: branchId, service_id: serviceId, chair_id: chairId,
      barber_id: barberId, start_time: startTime,
      guest_name: guestName || undefined, guest_phone: guestPhone || undefined,
    }),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); const e = new Error(b.detail ?? "Error al reservar."); e.status = res.status; throw e; }
  return res.json();
}
