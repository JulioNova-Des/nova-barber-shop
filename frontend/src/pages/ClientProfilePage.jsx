import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function ClientProfilePage({ user, token, onLogout, onNewBooking }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({});
  const [pwMsg, setPwMsg] = useState(null);
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/appointments/me/history`, { headers: H })
      .then(r => r.ok ? r.json() : []).then(setHistory).catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const changePassword = async () => {
    setPwMsg(null);
    if (!pwForm.current || !pwForm.next) { setPwMsg({ type: "error", text: "Completa ambos campos." }); return; }
    if (pwForm.next.length < 6) { setPwMsg({ type: "error", text: "Mínimo 6 caracteres." }); return; }
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST", headers: H,
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      });
      if (res.ok) { setPwMsg({ type: "ok", text: "✅ Contraseña actualizada." }); setPwForm({}); setShowPw(false); }
      else { const e = await res.json(); setPwMsg({ type: "error", text: e.detail || "Error" }); }
    } catch (e) { setPwMsg({ type: "error", text: "Error de conexión" }); }
  };

  const statusLabel = (s) => {
    if (s === "scheduled") return <span className="rounded-full border border-nova-gold/40 bg-nova-gold/10 px-2 py-0.5 text-[10px] font-medium text-nova-gold-light">Agendada</span>;
    if (s === "attended") return <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">Atendida</span>;
    if (s === "completed") return <span className="rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[10px] font-medium text-green-300">✓ Completada</span>;
    if (s === "no_show") return <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300">No asistió</span>;
    if (s === "cancelled") return <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-nova-offwhite/40">Cancelada</span>;
    return null;
  };

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo-nova.jpg" alt="NOVA" className="h-8 w-8 rounded-full border border-nova-gold/30 object-cover" />
            <div><div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">BARBER</span></div></div>
          </div>
          <button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60">Cerrar sesión</button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {/* Profile card */}
        <div className="mb-6 rounded-nova border border-white/10 bg-nova-bg-matte p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-nova-gold/15 font-display text-lg font-bold text-nova-gold-light">
              {user.full_name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-display text-base font-semibold">{user.full_name}</div>
              <div className="font-sans text-xs text-nova-offwhite/50">📱 {user.phone}</div>
              {user.email && <div className="font-sans text-xs text-nova-offwhite/50">📧 {user.email}</div>}
            </div>
          </div>

          <div className="mt-4 flex gap-2 border-t border-white/5 pt-3">
            <button onClick={onNewBooking} className="flex-1 rounded-nova bg-nova-gold-gradient py-2.5 font-display text-xs font-semibold uppercase text-nova-bg-deep hover:brightness-110">
              ✂ Nueva reserva
            </button>
            <button onClick={() => setShowPw(!showPw)} className="rounded-nova border border-white/15 px-4 py-2.5 font-sans text-xs text-nova-offwhite/60 hover:border-nova-gold/30">
              🔑 Cambiar contraseña
            </button>
          </div>

          {showPw && (
            <div className="mt-4 rounded-nova border border-white/10 bg-nova-bg-main p-4">
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Contraseña actual</label>
                  <input type="password" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-matte px-3 text-sm text-nova-offwhite" value={pwForm.current || ""} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} /></div>
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Nueva contraseña</label>
                  <input type="password" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-matte px-3 text-sm text-nova-offwhite" value={pwForm.next || ""} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} /></div>
              </div>
              {pwMsg && <div className={cn("mb-3 rounded-nova border p-2 text-center font-sans text-xs", pwMsg.type === "ok" ? "border-green-400/30 bg-green-400/5 text-green-300" : "border-red-500/30 bg-red-500/5 text-red-300")}>{pwMsg.text}</div>}
              <button onClick={changePassword} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Guardar</button>
            </div>
          )}
        </div>

        {/* History */}
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/60">Historial de citas</h3>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>
        ) : history.length === 0 ? (
          <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center">
            <div className="mb-2 text-2xl">✂</div>
            <div className="font-sans text-sm text-nova-offwhite/50">Aún no tienes citas</div>
            <button onClick={onNewBooking} className="mt-3 rounded-nova bg-nova-gold-gradient px-5 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Reservar ahora</button>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(a => (
              <div key={a.id} className="rounded-nova border border-white/10 bg-nova-bg-matte p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display text-sm font-semibold">{a.service_name}</span>
                  {statusLabel(a.status)}
                </div>
                <div className="font-sans text-xs text-nova-offwhite/50">
                  {new Date(a.start_time).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })} · {a.start_time.slice(11, 16)} – {a.end_time.slice(11, 16)}
                </div>
                <div className="font-sans text-xs text-nova-offwhite/40">{a.barber_name} · {a.branch_name}</div>
                {a.price && <div className="mt-1 font-sans text-xs text-nova-gold-light">{COP(a.price)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
