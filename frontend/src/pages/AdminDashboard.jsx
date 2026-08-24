import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function AdminDashboard({ user, token, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Shared state
  const [dashboard, setDashboard] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [rules, setRules] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, st, sv, br, rl, pd] = await Promise.all([
        fetch(`${API}/admin/dashboard`, { headers: H }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/admin/staff`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/services?only_active=false`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/branches?only_active=false`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/commissions`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/cashier/pending`, { headers: H }).then(r => r.ok ? r.json() : []),
      ]);
      setDashboard(d); setStaff(st); setServices(sv); setBranches(br); setRules(rl); setPending(pd);
      if (br.length > 0) {
        const ch = await fetch(`${API}/branches/${br[0].id}/chairs`, { headers: H }).then(r => r.ok ? r.json() : []);
        setChairs(ch);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const confirmPayment = async (id) => {
    await fetch(`${API}/cashier/${id}/confirm`, { method: "POST", headers: H });
    load();
  };

  // --- Forms ---
  const [showForm, setShowForm] = useState(null);
  const [form, setForm] = useState({});

  const createStaff = async () => {
    const res = await fetch(`${API}/admin/staff`, { method: "POST", headers: H, body: JSON.stringify(form) });
    if (res.ok) { const data = await res.json(); alert(`Creado: ${data.user.full_name}\nContraseña temporal: ${data.temporary_password}`); setShowForm(null); setForm({}); load(); }
    else { const e = await res.json(); alert(e.detail || "Error"); }
  };

  const createService = async () => {
    const res = await fetch(`${API}/services`, { method: "POST", headers: H, body: JSON.stringify({ ...form, price: parseInt(form.price), duration_minutes: parseInt(form.duration_minutes || 30) }) });
    if (res.ok) { setShowForm(null); setForm({}); load(); }
    else { const e = await res.json(); alert(e.detail || "Error"); }
  };

  const saveCommission = async () => {
    const body = { barber_pct: parseInt(form.barber_pct), note: form.note || null, barber_id: form.barber_id ? parseInt(form.barber_id) : null, applies_on: form.applies_on || null };
    const res = await fetch(`${API}/commissions`, { method: "POST", headers: H, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(null); setForm({}); load(); }
    else { const e = await res.json(); alert(e.detail || "Error"); }
  };

  const TABS = [["dashboard", "📊 Dashboard"], ["pending", "💰 Cobros"], ["staff", "👥 Staff"], ["services", "✂ Servicios"], ["commissions", "% Comisiones"]];

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <div>
            <div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">ADMIN</span></div>
            <div className="font-sans text-[11px] text-nova-offwhite/50">{user.full_name}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60 hover:border-nova-gold/50">↻</button>
            <button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60">Salir</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-5 pb-2">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn(
              "shrink-0 rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors",
              tab === k ? "border border-nova-gold bg-nova-gold/10 text-nova-gold-light" : "border border-white/10 text-nova-offwhite/50"
            )}>{l}{k === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>}

        {!loading && tab === "dashboard" && dashboard && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { v: COP(dashboard.total_gross), l: "Bruto total", c: "" },
                { v: COP(dashboard.total_barber), l: "Barberos", c: "text-nova-gold-light" },
                { v: COP(dashboard.total_shop), l: "Barbería", c: "text-green-400" },
                { v: dashboard.completed_count, l: "Completadas", c: "" },
              ].map(({ v, l, c }) => (
                <div key={l} className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                  <div className={cn("font-display text-lg font-bold", c)}>{v}</div>
                  <div className="font-sans text-[11px] text-nova-offwhite/40">{l}</div>
                </div>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                <div className="font-display text-lg font-bold">{dashboard.scheduled_count}</div>
                <div className="font-sans text-[11px] text-nova-offwhite/40">Agendadas</div>
              </div>
              <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                <div className="font-display text-lg font-bold text-red-400">{dashboard.no_show_count}</div>
                <div className="font-sans text-[11px] text-nova-offwhite/40">No-shows</div>
              </div>
              <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3">
                <div className="font-display text-lg font-bold">{Math.round(dashboard.no_show_rate * 100)}%</div>
                <div className="font-sans text-[11px] text-nova-offwhite/40">Tasa no-show</div>
              </div>
            </div>

            {dashboard.top_barbers?.length > 0 && (
              <>
                <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Ranking barberos</div>
                <div className="mb-4 rounded-nova border border-white/10 bg-nova-bg-matte">
                  {dashboard.top_barbers.map((b, i) => (
                    <div key={b.barber_id} className={cn("flex items-center gap-3 px-4 py-3", i < dashboard.top_barbers.length - 1 && "border-b border-white/5")}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nova-gold/10 font-display text-xs font-bold text-nova-gold-light">
                        {b.barber_name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="font-sans text-sm font-medium">{b.barber_name}</div>
                        <div className="font-sans text-[11px] text-nova-offwhite/40">{b.completed_count} citas · {b.avg_pct}% promedio</div>
                      </div>
                      <div className="text-right">
                        <div className="font-sans text-sm font-semibold text-nova-gold-light">{COP(b.barber_total)}</div>
                        <div className="font-sans text-[10px] text-nova-offwhite/30">de {COP(b.gross_revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {dashboard.revenue_by_service?.length > 0 && (
              <>
                <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Por servicio</div>
                <div className="rounded-nova border border-white/10 bg-nova-bg-matte">
                  {dashboard.revenue_by_service.map((s, i) => (
                    <div key={s.service_id} className={cn("flex items-center justify-between px-4 py-3", i < dashboard.revenue_by_service.length - 1 && "border-b border-white/5")}>
                      <span className="font-sans text-sm">{s.service_name} <span className="text-nova-offwhite/40">×{s.completed_count}</span></span>
                      <span className="font-sans text-sm font-medium">{COP(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!loading && tab === "pending" && (
          <>
            <h3 className="mb-3 font-display text-sm font-bold">Pendientes de cobro ({pending.length})</h3>
            {pending.length === 0 ? (
              <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center font-sans text-sm text-green-300">✓ Todo cobrado</div>
            ) : pending.map(p => (
              <div key={p.appointment_id} className="mb-3 rounded-nova border border-amber-400/20 bg-nova-bg-matte p-4">
                <div className="mb-1 flex justify-between"><span className="font-display text-sm font-semibold">{p.start_time} · {p.service_name}</span><span className="font-display font-bold text-nova-gold-light">{COP(p.service_price)}</span></div>
                <div className="mb-2 font-sans text-xs text-nova-offwhite/50">{p.client_name} · {p.barber_name} · {p.chair_label}</div>
                <button onClick={() => confirmPayment(p.appointment_id)} className="w-full rounded-nova bg-nova-gold-gradient py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">💰 Confirmar pago</button>
              </div>
            ))}
          </>
        )}

        {!loading && tab === "staff" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">Equipo ({staff.length})</h3>
              <button onClick={() => { setShowForm("staff"); setForm({ role: "barber" }); }} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Agregar</button>
            </div>
            {staff.map(s => (
              <div key={s.id} className="mb-2 flex items-center gap-3 rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nova-gold/10 font-display text-xs font-bold text-nova-gold-light">
                  {s.full_name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="font-sans text-sm font-medium">{s.full_name}</div>
                  <div className="font-sans text-[11px] text-nova-offwhite/40">{s.role === "barber" ? `Barbero · ${s.branch_name} · ${s.chair_label}` : "Cajero/a"} · {s.phone}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", s.is_active ? "bg-green-400/10 text-green-300 border border-green-400/30" : "bg-red-400/10 text-red-300 border border-red-400/30")}>
                  {s.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))}
            {showForm === "staff" && (
              <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
                <h4 className="mb-3 font-display text-sm font-semibold">Nuevo integrante</h4>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Nombre</label><input className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.full_name || ""} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Teléfono</label><input className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Rol</label>
                    <select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="barber">Barbero</option><option value="cashier">Cajero/a</option>
                    </select>
                  </div>
                  {form.role === "barber" && branches.length > 0 && (
                    <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Silla</label>
                      <select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.chair_id || ""} onChange={e => setForm({ ...form, chair_id: e.target.value, branch_id: branches[0].id })}>
                        <option value="">Seleccionar...</option>
                        {chairs.map(c => <option key={c.id} value={c.id}>{c.label}{c.barber_name ? ` (${c.barber_name})` : " — libre"}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={createStaff} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Crear</button>
                  <button onClick={() => { setShowForm(null); setForm({}); }} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && tab === "services" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">Servicios ({services.length})</h3>
              <button onClick={() => { setShowForm("service"); setForm({ duration_minutes: 30 }); }} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Agregar</button>
            </div>
            {services.map(s => (
              <div key={s.id} className="mb-2 flex items-center justify-between rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
                <div><div className="font-sans text-sm font-medium">{s.name}</div><div className="font-sans text-[11px] text-nova-offwhite/40">{s.duration_minutes} min</div></div>
                <span className="font-display text-sm font-semibold text-nova-gold-light">{COP(s.price)}</span>
              </div>
            ))}
            {showForm === "service" && (
              <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
                <h4 className="mb-3 font-display text-sm font-semibold">Nuevo servicio</h4>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Nombre</label><input className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Precio (COP)</label><input type="number" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.price || ""} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Minutos</label><input type="number" step="30" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.duration_minutes || 30} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createService} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Crear</button>
                  <button onClick={() => { setShowForm(null); setForm({}); }} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && tab === "commissions" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">Reglas de comisión</h3>
              <button onClick={() => { setShowForm("commission"); setForm({ barber_pct: 60 }); }} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Regla</button>
            </div>
            {rules.map(r => (
              <div key={r.id} className="mb-2 flex items-center justify-between rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
                <div>
                  <div className="font-sans text-sm font-medium">{r.barber_name || r.branch_name || "Global"}</div>
                  <div className="font-sans text-[11px] text-nova-offwhite/40">{r.applies_on ? `Solo ${r.applies_on}` : "Siempre"}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-nova-gold/30 bg-nova-gold/10 px-2 py-0.5 text-xs font-semibold text-nova-gold-light">{r.barber_pct}%</span>
                  <span className="text-xs text-nova-offwhite/40">/</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-nova-offwhite/50">{r.shop_pct}%</span>
                </div>
              </div>
            ))}
            {showForm === "commission" && (
              <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
                <h4 className="mb-3 font-display text-sm font-semibold">Nueva regla</h4>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Barbero (vacío = todos)</label>
                    <select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.barber_id || ""} onChange={e => setForm({ ...form, barber_id: e.target.value || null })}>
                      <option value="">Todos (global)</option>
                      {staff.filter(s => s.role === "barber").map(s => <option key={s.barber_id} value={s.barber_id}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Fecha específica (vacío = siempre)</label><input type="date" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.applies_on || ""} onChange={e => setForm({ ...form, applies_on: e.target.value || null })} /></div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">% Barbero</label><input type="number" min="0" max="100" className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.barber_pct} onChange={e => setForm({ ...form, barber_pct: e.target.value })} /></div>
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Nota</label><input className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" placeholder="Ej: Domingo especial" value={form.note || ""} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                </div>
                <div className="mb-3 flex h-2 overflow-hidden rounded-full"><div className="bg-gradient-to-r from-nova-gold to-nova-gold-light" style={{ width: `${form.barber_pct}%` }} /><div className="flex-1 bg-white/5" /></div>
                <div className="mb-4 flex justify-between text-[10px] text-nova-offwhite/40"><span>Barbero {form.barber_pct}%</span><span>Barbería {100 - (form.barber_pct || 0)}%</span></div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[50,60,65,70,80].map(v => <button key={v} onClick={() => setForm({...form, barber_pct: v})} className={cn("rounded-full border px-3 py-1 text-xs", parseInt(form.barber_pct)===v ? "border-nova-gold bg-nova-gold/15 text-nova-gold-light" : "border-white/15 text-nova-offwhite/50")}>{v}/{100-v}</button>)}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveCommission} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Guardar</button>
                  <button onClick={() => { setShowForm(null); setForm({}); }} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
