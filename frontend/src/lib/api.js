const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("nova_token"); // ver nota en useAuth.js
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Consulta la disponibilidad de franjas de 30 min para una sucursal +
 * servicio + fecha, opcionalmente filtrada por barbero habitual.
 *
 * @param {{branchId:number, serviceId:number, date:string, barberId?:number}} params
 * @returns {Promise<{
 *   branch_id:number, service_id:number, date:string,
 *   duration_minutes:number, slot_minutes:number,
 *   slots: Array<{start_time:string,end_time:string,available:boolean,
 *     available_barbers:Array<{barber_id:number,barber_name:string,chair_id:number,chair_label:string}>}>
 * }>}
 */
export async function getAvailability({ branchId, serviceId, date, barberId }) {
  const params = new URLSearchParams({
    branch_id: branchId,
    service_id: serviceId,
    date,
  });
  if (barberId) params.set("barber_id", barberId);

  const res = await fetch(`${BASE_URL}/availability?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "No se pudo cargar la disponibilidad.");
  }
  return res.json();
}

/**
 * Crea la cita (paso 3). Si hay sesión de cliente registrado, el token
 * se envía automáticamente y el backend ignora guest_name/guest_phone;
 * si no hay sesión, ambos campos son obligatorios.
 *
 * @param {{
 *   branchId:number, serviceId:number, chairId:number, barberId:number,
 *   startTime:string, guestName?:string, guestPhone?:string
 * }} params
 */
export async function createAppointment({
  branchId,
  serviceId,
  chairId,
  barberId,
  startTime,
  guestName,
  guestPhone,
}) {
  const res = await fetch(`${BASE_URL}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      branch_id: branchId,
      service_id: serviceId,
      chair_id: chairId,
      barber_id: barberId,
      start_time: startTime,
      guest_name: guestName || undefined,
      guest_phone: guestPhone || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.detail ?? "No se pudo crear la reserva.");
    error.status = res.status; // 409 = slot ya ocupado
    throw error;
  }
  return res.json();
}
