import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function CashierDashboard({ user, token, onLogout }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const H = { Authorization: `Bearer ${token}` };

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/cashier/pending`, { headers: H });
      if (res.ok) setPending(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Auto refresh cada 30 segundos
  useEffect(() => {
    const id = setInterval(fetchPending, 30000);
    return () => clearInterval(id);
  }, [fetchPending]);

  const confirmPayment = async (id) => {
    setConfirming(id);
    try {
      const res = await fetch(`${API}/cashier/${id}/confirm`, { method: "POST", headers: H });
      if (res.ok) {
        const data = await res.json();
        // Mostrar brevemente el resultado
        setPending((prev) => prev.filter((p) => p.appointment_id !== id));
      }
    } catch (e) { console.error(e); }
    setConfirming(null);
  };

  const rejectPayment = async (id) => {
    if (!confirm("¿Devolver esta cita a estado 'agendada'?")) return;
    try {
      await fetch(`${API}/cashier/${id}/reject`, { method: "POST", headers: H });
      fetchPending();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div>
            <div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">CAJA</span></div>
            <div className="font-sans text-[11px] text-nova-offwhite/50">{user.full_name} · Cajero/a</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPending} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60 hover:border-nova-gold/50">↻ Refrescar</button>
            <button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60 hover:border-white/30">Salir</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-lg font-bold">Pendientes de cobro</h2>
          <span className={cn(
            "rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold",
            pending.length > 0 ? "bg-amber-400/15 text-amber-300 border border-amber-400/30" : "bg-green-400/10 text-green-300 border border-green-400/30"
          )}>
            {pending.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>
        ) : pending.length === 0 ? (
          <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-10 text-center">
            <div className="mb-2 text-3xl">✓</div>
            <div className="font-display text-sm font-semibold text-green-300">Todo cobrado</div>
            <div className="mt-1 font-sans text-xs text-nova-offwhite/40">No hay servicios pendientes de cobro</div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.appointment_id} className="rounded-nova border border-amber-400/20 bg-nova-bg-matte p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-sm font-semibold">{p.start_time} · {p.service_name}</span>
                  <span className="font-display text-base font-bold text-nova-gold-light">{COP(p.service_price)}</span>
                </div>
                <div className="mb-1 font-sans text-sm">{p.client_name}
                  {p.is_guest && <span className="ml-2 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-nova-offwhite/40">Invitado</span>}
                </div>
                <div className="mb-3 font-sans text-xs text-nova-offwhite/40">
                  Barbero: {p.barber_name} · {p.chair_label}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => confirmPayment(p.appointment_id)}
                    disabled={confirming === p.appointment_id}
                    className="flex-1 rounded-nova bg-nova-gold-gradient px-3 py-2.5 font-display text-xs font-semibold uppercase text-nova-bg-deep hover:brightness-110 disabled:opacity-50"
                  >
                    {confirming === p.appointment_id ? "Confirmando…" : "💰 Confirmar pago"}
                  </button>
                  <button
                    onClick={() => rejectPayment(p.appointment_id)}
                    className="rounded-nova border border-white/15 px-3 py-2.5 font-sans text-xs text-nova-offwhite/50 hover:border-red-400/30 hover:text-red-300"
                  >
                    Devolver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-center font-sans text-[11px] text-nova-offwhite/25">Se actualiza automáticamente cada 30 segundos</p>
      </div>
    </div>
  );
}
