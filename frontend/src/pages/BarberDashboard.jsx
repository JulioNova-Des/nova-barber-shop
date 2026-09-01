import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function BarberDashboard({ user, token, onLogout }) {
  const [tab, setTab] = useState("agenda");
  const [agenda, setAgenda] = useState([]);
  const [balance, setBalance] = useState(null);
  const [balPeriod, setBalPeriod] = useState("today");
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const H = { Authorization: `Bearer ${token}` };

  const fetchAgenda = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/barber/agenda?date=${date}`, { headers: H });
      if (res.ok) setAgenda(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [date, token]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API}/barber/balance`, { headers: H });
      if (res.ok) setBalance(await res.json());
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => { fetchAgenda(); }, [fetchAgenda]);
  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const markAttendance = async (id, status) => {
    try {
      await fetch(`${API}/barber/agenda/${id}/attendance`, {
        method: "POST", headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAgenda();
      fetchBalance();
    } catch (e) { console.error(e); }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;

  const statusBadge = (s, confirmed) => {
    if (s === "scheduled") return <span className="rounded-full border border-nova-gold/40 bg-nova-gold/10 px-2 py-0.5 text-[11px] font-medium text-nova-gold-light">Agendada</span>;
    if (s === "attended") return <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">Atendida · sin cobrar</span>;
    if (s === "completed") return <span className="rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[11px] font-medium text-green-300">✓ Cobrada</span>;
    if (s === "no_show") return <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300">No vino</span>;
    return <span className="text-[11px] text-nova-offwhite/40">{s}</span>;
  };

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div>
            <div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">BARBER</span></div>
            <div className="font-sans text-[11px] text-nova-offwhite/50">{user.full_name} · Barbero</div>
          </div>
          <button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60 hover:border-white/30">Salir</button>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-5 pb-2">
          {[["agenda", "Mi Agenda"], ["balance", "Mi Balance"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn(
              "rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors",
              tab === k ? "border border-nova-gold bg-nova-gold/10 text-nova-gold-light" : "border border-white/10 text-nova-offwhite/50 hover:text-nova-offwhite"
            )}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {tab === "agenda" && (
          <>
            {/* Date nav */}
            <div className="mb-2 flex gap-2">
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
                const tomorrowStr = tmr.toISOString().slice(0, 10);
                return [["Hoy", today], ["Mañana", tomorrowStr]].map(([l, d]) => (
                  <button key={l} onClick={() => setDate(d)} className={cn("rounded-full px-3 py-1 text-xs font-medium", date === d ? "border border-nova-gold bg-nova-gold/10 text-nova-gold-light" : "border border-white/10 text-nova-offwhite/50")}>{l}</button>
                ));
              })()}
            </div>
            <div className="mb-4 flex items-center gap-3">
              <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 hover:border-nova-gold/50">←</button>
              <div className="flex-1 text-center">
                <div className="font-display text-sm font-semibold">{isToday ? "Hoy" : new Date(date + "T12:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="font-sans text-[11px] text-nova-offwhite/40">{date}</div>
              </div>
              <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)); }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 hover:border-nova-gold/50">→</button>
            </div>

            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>
            ) : agenda.length === 0 ? (
              <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center font-sans text-sm text-nova-offwhite/40">Sin citas para este día</div>
            ) : (
              <div className="space-y-3">
                {agenda.map((a) => (
                  <div key={a.appointment_id} className="rounded-nova border border-white/10 bg-nova-bg-matte p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-display text-sm font-semibold">{a.start_time.slice(11, 16)} – {a.end_time.slice(11, 16)}</span>
                      {statusBadge(a.status, a.payment_confirmed)}
                    </div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-sans text-sm">{a.client_name}</span>
                      {a.is_guest && <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-nova-offwhite/40">Invitado</span>}
                    </div>
                    <div className="mb-3 font-sans text-xs text-nova-offwhite/50">{a.service_name} · {a.client_phone}</div>

                    {a.status === "scheduled" && (
                      <div className="flex gap-2">
                        <button onClick={() => markAttendance(a.appointment_id, "attended")}
                          className="flex-1 rounded-nova bg-nova-gold-gradient px-3 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep hover:brightness-110">
                          ✓ Marcar atendido
                        </button>
                        <button onClick={() => markAttendance(a.appointment_id, "no_show")}
                          className="rounded-nova border border-red-400/30 px-3 py-2 font-display text-xs font-semibold uppercase text-red-300 hover:bg-red-500/10">
                          No vino
                        </button>
                      </div>
                    )}

                    {a.status === "completed" && a.barber_amount && (
                      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 font-sans text-xs">
                        <span className="text-nova-offwhite/50">Mi parte ({a.barber_pct_snapshot}%)</span>
                        <span className="font-semibold text-nova-gold-light">{COP(a.barber_amount)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "balance" && balance && (
          <>
            <div className="mb-4 flex gap-2">
              {[["today", "Hoy"], ["week", "Semana"], ["month", "Mes"]].map(([k, l]) => (
                <button key={k} onClick={() => setBalPeriod(k)} className={cn(
                  "rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors",
                  balPeriod === k ? "border border-nova-gold bg-nova-gold/10 text-nova-gold-light" : "border border-white/10 text-nova-offwhite/50"
                )}>{l}</button>
              ))}
            </div>

            {(() => {
              const data = balPeriod === "today" ? balance.today : balPeriod === "week" ? balance.current_week : balance.current_month;
              const gross = data.gross_revenue || 0;
              const barber = balPeriod === "today" ? data.barber_total : data.barber_total;
              const shop = balPeriod === "today" ? data.shop_total : data.shop_total;
              const count = data.completed_count || 0;
              const pct = gross > 0 ? Math.round(barber / gross * 100) : 0;
              return (
                <>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                      <div className="font-display text-lg font-bold text-nova-gold-light">{COP(barber)}</div>
                      <div className="font-sans text-[11px] text-nova-offwhite/40">Mi ganancia</div>
                    </div>
                    <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                      <div className="font-display text-lg font-bold">{COP(gross)}</div>
                      <div className="font-sans text-[11px] text-nova-offwhite/40">Bruto</div>
                    </div>
                    <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                      <div className="font-display text-lg font-bold">{count}</div>
                      <div className="font-sans text-[11px] text-nova-offwhite/40">Servicios</div>
                    </div>
                  </div>

                  {pct > 0 && (
                    <>
                      <div className="mb-1 flex h-1.5 overflow-hidden rounded-full">
                        <div className="bg-gradient-to-r from-nova-gold to-nova-gold-light" style={{ width: `${pct}%` }} />
                        <div className="flex-1 bg-white/5" />
                      </div>
                      <div className="mb-6 flex justify-between font-sans text-[10px] text-nova-offwhite/40">
                        <span>Yo {pct}%</span><span>Barbería {100 - pct}%</span>
                      </div>
                    </>
                  )}

                  {/* Line items for today */}
                  {balPeriod === "today" && balance.today_items?.length > 0 && (
                    <>
                      <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Detalle de hoy</div>
                      <div className="rounded-nova border border-white/10 bg-nova-bg-matte">
                        {balance.today_items.map((item, i) => (
                          <div key={i} className={cn("flex items-center gap-3 px-4 py-3", i < balance.today_items.length - 1 && "border-b border-white/5")}>
                            <span className="w-12 shrink-0 font-sans text-xs text-nova-offwhite/40">{item.time}</span>
                            <div className="flex-1">
                              <div className="font-sans text-sm">{item.client_name}</div>
                              <div className="font-sans text-[11px] text-nova-offwhite/40">{item.service_name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-sans text-xs text-nova-offwhite/50">{item.barber_pct}%</div>
                              <div className="font-sans text-sm font-semibold text-nova-gold-light">{COP(item.barber_amount)}</div>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                          <span className="font-sans text-xs text-nova-offwhite/50">{balance.today_items.length} servicios</span>
                          <span className="font-display text-sm font-bold text-nova-gold-light">{COP(barber)}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Monthly breakdown */}
                  {balPeriod === "month" && balance.current_month?.by_service?.length > 0 && (
                    <>
                      <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Por servicio</div>
                      <div className="rounded-nova border border-white/10 bg-nova-bg-matte">
                        {balance.current_month.by_service.map((s, i) => (
                          <div key={i} className={cn("flex items-center justify-between px-4 py-3", i < balance.current_month.by_service.length - 1 && "border-b border-white/5")}>
                            <span className="font-sans text-sm">{s.service_name} <span className="text-nova-offwhite/40">×{s.count}</span></span>
                            <span className="font-sans text-sm font-semibold text-nova-gold-light">{COP(s.barber_total)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
