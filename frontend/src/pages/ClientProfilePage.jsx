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
  const [expandedId, setExpandedId] = useState(null);
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/appointments/me/history`, { headers: H })
      .then(r => r.ok ? r.json() : []).then(setHistory).catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const changePassword = async () => {
    setPwMsg(null);
    if (!pwForm.current || !pwForm.next) { setPwMsg({ t: "e", m: "Completa ambos campos." }); return; }
    if (pwForm.next.length < 4) { setPwMsg({ t: "e", m: "Mínimo 4 caracteres." }); return; }
    const res = await fetch(`${API}/auth/change-password`, { method: "POST", headers: H, body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }) });
    if (res.ok) { setPwMsg({ t: "ok", m: "✅ Contraseña actualizada." }); setPwForm({}); setShowPw(false); }
    else { const e = await res.json(); setPwMsg({ t: "e", m: e.detail || "Error" }); }
  };

  const statusBadge = (s) => {
    const map = {
      scheduled: ["Agendada", "border-nova-gold/40 bg-nova-gold/10 text-nova-gold-light"],
      attended: ["Atendida", "border-amber-400/40 bg-amber-400/10 text-amber-300"],
      completed: ["✓ Completada", "border-green-400/40 bg-green-400/10 text-green-300"],
      no_show: ["No asistió", "border-red-400/40 bg-red-400/10 text-red-300"],
      cancelled: ["Cancelada", "border-white/15 text-nova-offwhite/40"],
    };
    const [label, cls] = map[s] || [s, "border-white/15 text-nova-offwhite/40"];
    return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", cls)}>{label}</span>;
  };

  // Separar próximas vs pasadas
  const now = new Date();
  const upcoming = history.filter(a => (a.status === "scheduled" || a.status === "attended") && new Date(a.start_time) >= new Date(now.toISOString().slice(0, 10)));
  const past = history.filter(a => !upcoming.includes(a));

  const formatDate = (iso) => new Date(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo-nova.jpg" alt="NOVA" className="h-8 w-8 rounded-full border border-nova-gold/30 object-cover" />
            <div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">BARBER</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={onNewBooking} className="rounded-nova border border-nova-gold/30 bg-nova-gold/5 px-3 py-1.5 font-sans text-xs text-nova-gold-light">Reservar</button>
            <button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60">Salir</button>
          </div>
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
          <button onClick={() => setShowPw(!showPw)} className="mt-3 rounded-nova border border-white/10 px-3 py-1.5 font-sans text-[11px] text-nova-offwhite/50 hover:border-nova-gold/30">🔑 Cambiar contraseña</button>
          {showPw && (
            <div className="mt-3 rounded-nova border border-white/10 bg-nova-bg-main p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Actual</label><input type="password" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-matte px-3 text-sm text-nova-offwhite" value={pwForm.current || ""} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} /></div>
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Nueva</label><input type="password" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-matte px-3 text-sm text-nova-offwhite" value={pwForm.next || ""} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} /></div>
              </div>
              {pwMsg && <div className={cn("mb-3 rounded-nova border p-2 text-center text-xs", pwMsg.t === "ok" ? "border-green-400/30 text-green-300" : "border-red-500/30 text-red-300")}>{pwMsg.m}</div>}
              <button onClick={changePassword} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Guardar</button>
            </div>
          )}
        </div>

        {/* Upcoming reservations */}
        {upcoming.length > 0 && (<>
          <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-nova-gold-light">📋 Tus próximas citas</h3>
          <div className="mb-6 space-y-3">
            {upcoming.map(a => (
              <div key={a.id} className="rounded-nova border border-nova-gold/20 bg-nova-gold/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display text-base font-semibold">{a.service_name}</div>
                  {statusBadge(a.status)}
                </div>
                <div className="space-y-1.5 font-sans text-sm">
                  <div className="flex gap-2 text-nova-offwhite/80">
                    <span>📅</span>
                    <span>{formatDate(a.start_time)} · {a.start_time.slice(11, 16)} – {a.end_time.slice(11, 16)}</span>
                  </div>
                  <div className="flex gap-2 text-nova-offwhite/60">
                    <span>💈</span>
                    <span>{a.barber_name || "Barbero asignado"}</span>
                  </div>
                  <div className="flex gap-2 text-nova-offwhite/60">
                    <span>📍</span>
                    <span>{a.branch_name || "Nova Barber Shop"} — Calle 9 #4-63, Candelaria</span>
                  </div>
                  {a.price && (
                    <div className="flex gap-2">
                      <span>💰</span>
                      <span className="font-semibold text-nova-gold-light">{COP(a.price)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 rounded border border-dashed border-nova-gold/30 bg-nova-gold/[0.05] px-3 py-2 text-center">
                  <div className="font-sans text-[11px] text-nova-offwhite/50">Reserva #{a.id}</div>
                  <div className="font-sans text-[10px] text-nova-offwhite/30">Presenta esta pantalla al llegar</div>
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* Past history */}
        <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Historial</h3>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>
        ) : past.length === 0 && upcoming.length === 0 ? (
          <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center">
            <div className="mb-2 text-2xl">✂</div>
            <div className="font-sans text-sm text-nova-offwhite/50">Aún no tienes citas</div>
            <button onClick={onNewBooking} className="mt-3 rounded-nova bg-nova-gold-gradient px-5 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Reservar ahora</button>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map(a => (
              <div key={a.id} className="rounded-nova border border-white/10 bg-nova-bg-matte p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-sans text-sm font-medium">{a.service_name}</span>
                    <span className="ml-2 font-sans text-xs text-nova-offwhite/40">{formatDate(a.start_time)} · {a.start_time.slice(11, 16)}</span>
                  </div>
                  {statusBadge(a.status)}
                </div>
                {expandedId === a.id && (
                  <div className="mt-3 space-y-1 border-t border-white/5 pt-3 font-sans text-xs text-nova-offwhite/60">
                    <div>📅 {formatDate(a.start_time)} · {a.start_time.slice(11, 16)} – {a.end_time.slice(11, 16)}</div>
                    <div>💈 {a.barber_name || "—"}</div>
                    <div>📍 {a.branch_name || "Nova Barber Shop"}</div>
                    {a.price && <div>💰 {COP(a.price)}</div>}
                    <div className="text-nova-offwhite/30">Reserva #{a.id}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
