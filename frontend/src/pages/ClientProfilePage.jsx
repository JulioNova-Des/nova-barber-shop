import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function ClientProfilePage({ user, token, onLogout, onNewBooking }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [showPw, setShowPw] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
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
    if (!pwCurrent || !pwNext) { setPwMsg({ t: "e", m: "Completa ambos campos." }); return; }
    if (pwNext.length < 4) { setPwMsg({ t: "e", m: "Mínimo 4 caracteres." }); return; }
    const res = await fetch(`${API}/auth/change-password`, { method: "POST", headers: H, body: JSON.stringify({ current_password: pwCurrent, new_password: pwNext }) });
    if (res.ok) { setPwMsg({ t: "ok", m: "✅ Contraseña actualizada." }); setPwCurrent(""); setPwNext(""); setShowPw(false); }
    else { const e = await res.json(); setPwMsg({ t: "e", m: e.detail || "Error" }); }
  };

  const badge = (s) => {
    const map = {
      scheduled: ["📅 Programada", "border-nova-gold/40 bg-nova-gold/10 text-nova-gold-light"],
      attended: ["⏳ Atendida", "border-amber-400/40 bg-amber-400/10 text-amber-300"],
      completed: ["✅ Completada", "border-green-400/40 bg-green-400/10 text-green-300"],
      no_show: ["❌ No asistió", "border-red-400/40 bg-red-400/10 text-red-300"],
      cancelled: ["🚫 Cancelada", "border-white/15 text-nova-offwhite/40"],
    };
    const [label, cls] = map[s] || [s, "border-white/15 text-nova-offwhite/40"];
    return <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-medium", cls)}>{label}</span>;
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const fmtShort = (iso) => new Date(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });

  // Separate by category
  const now = new Date();
  const upcoming = history.filter(a => ["scheduled", "attended"].includes(a.status) && new Date(a.start_time) >= new Date(now.toISOString().slice(0, 10)));
  const completed = history.filter(a => a.status === "completed");
  const cancelled = history.filter(a => a.status === "cancelled" || a.status === "no_show");

  const TABS = [
    ["upcoming", `📅 Programadas (${upcoming.length})`],
    ["completed", `✅ Historial (${completed.length})`],
    ["cancelled", `🚫 Canceladas (${cancelled.length})`],
  ];

  const currentList = tab === "upcoming" ? upcoming : tab === "completed" ? completed : cancelled;

  const renderAppointment = (a, expanded) => (
    <div key={a.id} className={cn(
      "rounded-nova border bg-nova-bg-matte p-4 cursor-pointer transition-colors",
      a.status === "scheduled" ? "border-nova-gold/20" : "border-white/10",
    )} onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-display text-sm font-semibold">{a.service_name}</div>
        {badge(a.status)}
      </div>
      <div className="font-sans text-xs text-nova-offwhite/60">
        {fmtShort(a.start_time)} · {a.start_time.slice(11, 16)} – {a.end_time.slice(11, 16)}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <div className="flex gap-2 font-sans text-sm text-nova-offwhite/80">
            <span>📅</span><span>{fmtDate(a.start_time)}</span>
          </div>
          <div className="flex gap-2 font-sans text-sm text-nova-offwhite/80">
            <span>🕐</span><span>{a.start_time.slice(11, 16)} – {a.end_time.slice(11, 16)}</span>
          </div>
          <div className="flex gap-2 font-sans text-sm text-nova-offwhite/60">
            <span>💈</span><span>{a.barber_name || "Barbero asignado"}</span>
          </div>
          <div className="flex gap-2 font-sans text-sm text-nova-offwhite/60">
            <span>📍</span><span>{a.branch_name || "Nova Barber Shop"} — Calle 5 #4-63, Candelaria</span>
          </div>
          {a.price && (
            <div className="flex gap-2 font-sans text-sm">
              <span>💰</span><span className="font-semibold text-nova-gold-light">{COP(a.price)}</span>
            </div>
          )}
          {a.status === "scheduled" && (
            <div className="mt-2 rounded border border-dashed border-nova-gold/30 bg-nova-gold/[0.05] px-3 py-2 text-center">
              <div className="font-display text-xs text-nova-gold-light">Reserva #{a.id}</div>
              <div className="font-sans text-[10px] text-nova-offwhite/30">Presenta esta pantalla al llegar</div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <a href="/"><img src="/logo-nova.jpg" alt="NOVA" className="h-8 w-8 rounded-full border border-nova-gold/30 object-cover" /></a>
            <div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">BARBER</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={onNewBooking} className="rounded-nova border border-nova-gold/30 bg-nova-gold/5 px-3 py-1.5 font-sans text-xs text-nova-gold-light">✂ Reservar</button>
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
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Actual</label><input type="password" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-matte px-3 text-sm text-nova-offwhite" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} /></div>
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Nueva</label><input type="password" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-matte px-3 text-sm text-nova-offwhite" value={pwNext} onChange={e => setPwNext(e.target.value)} /></div>
              </div>
              {pwMsg && <div className={cn("mb-3 rounded-nova border p-2 text-center text-xs", pwMsg.t === "ok" ? "border-green-400/30 text-green-300" : "border-red-500/30 text-red-300")}>{pwMsg.m}</div>}
              <button onClick={changePassword} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Guardar</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn(
              "shrink-0 rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors",
              tab === k ? "border border-nova-gold bg-nova-gold/10 text-nova-gold-light" : "border border-white/10 text-nova-offwhite/50"
            )}>{l}</button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>
        ) : currentList.length === 0 ? (
          <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center">
            {tab === "upcoming" ? (<>
              <div className="mb-2 text-2xl">✂</div>
              <div className="font-sans text-sm text-nova-offwhite/50">No tienes citas programadas</div>
              <button onClick={onNewBooking} className="mt-3 rounded-nova bg-nova-gold-gradient px-5 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Reservar ahora</button>
            </>) : (
              <div className="font-sans text-sm text-nova-offwhite/40">
                {tab === "completed" ? "Aún no tienes citas completadas" : "No tienes citas canceladas"}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map(a => renderAppointment(a, expandedId === a.id))}
          </div>
        )}
      </div>
    </div>
  );
}
