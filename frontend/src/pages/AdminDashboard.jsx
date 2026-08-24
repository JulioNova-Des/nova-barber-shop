import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function AdminDashboard({ user, token, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [dashboard, setDashboard] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [rules, setRules] = useState([]);
  const [pending, setPending] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [calDate, setCalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(null);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, st, sv, br, rl, pd] = await Promise.all([
        fetch(`${API}/admin/dashboard`, { headers: H }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/admin/staff`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/services?only_active=false`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/branches?only_active=false`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/commissions`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/cashier/pending`, { headers: H }).then(r => r.ok ? r.json() : []),
      ]);
      setDashboard(d); setStaff(st); setServices(sv); setBranches(br); setRules(rl); setPending(pd);
      if (br.length > 0) {
        const [ch, cal] = await Promise.all([
          fetch(`${API}/branches/${br[0].id}/chairs`).then(r => r.ok ? r.json() : []),
          fetch(`${API}/branches/${br[0].id}/calendar?date=${calDate}`).then(r => r.ok ? r.json() : null),
        ]);
        setChairs(ch);
        setCalendar(cal);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token, calDate]);

  useEffect(() => { load(); }, [load]);

  const confirmPayment = async (id) => {
    await fetch(`${API}/cashier/${id}/confirm`, { method: "POST", headers: H });
    load();
  };

  // --- Service CRUD ---
  const saveService = async () => {
    const body = { name: form.name, price: parseInt(form.price), duration_minutes: parseInt(form.duration_minutes || 30) };
    const url = editId ? `${API}/services/${editId}` : `${API}/services`;
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: H, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(null); setForm({}); setEditId(null); load(); }
    else { const e = await res.json(); alert(e.detail || "Error"); }
  };

  const deleteService = async (id) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    await fetch(`${API}/services/${id}`, { method: "DELETE", headers: H });
    load();
  };

  const editService = (s) => {
    setEditId(s.id);
    setForm({ name: s.name, price: s.price, duration_minutes: s.duration_minutes });
    setShowForm("service");
  };

  // --- Staff CRUD ---
  const createStaff = async () => {
    const body = { ...form };
    if (form.role === "barber" && branches.length > 0) body.branch_id = branches[0].id;
    const res = await fetch(`${API}/admin/staff`, { method: "POST", headers: H, body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      alert(`✅ ${data.user.full_name} creado\n\nContraseña temporal: ${data.temporary_password}\n\nDásela al empleado para que inicie sesión.`);
      setShowForm(null); setForm({}); load();
    } else { const e = await res.json(); alert(e.detail || "Error"); }
  };

  const resetPassword = async (userId, name) => {
    if (!confirm(`¿Resetear contraseña de ${name}?`)) return;
    const res = await fetch(`${API}/admin/staff/${userId}/reset-password`, { method: "POST", headers: H });
    if (res.ok) {
      const data = await res.json();
      alert(`✅ Nueva contraseña para ${data.full_name}:\n\n${data.new_temporary_password}`);
    }
  };

  // --- Commission ---
  const saveCommission = async () => {
    const body = { barber_pct: parseInt(form.barber_pct), note: form.note || null, barber_id: form.barber_id ? parseInt(form.barber_id) : null, applies_on: form.applies_on || null };
    const url = editId ? `${API}/commissions/${editId}` : `${API}/commissions`;
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: H, body: JSON.stringify(editId ? { barber_pct: body.barber_pct, note: body.note } : body) });
    if (res.ok) { setShowForm(null); setForm({}); setEditId(null); load(); }
    else { const e = await res.json(); alert(e.detail || "Error"); }
  };

  const deleteCommission = async (id) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    await fetch(`${API}/commissions/${id}`, { method: "DELETE", headers: H });
    load();
  };

  const TABS = [["dashboard", "📊 Dashboard"], ["calendar", "📅 Calendario"], ["pending", `💰 Cobros${pending.length > 0 ? ` (${pending.length})` : ""}`], ["staff", "👥 Staff"], ["services", "✂ Servicios"], ["commissions", "% Comisiones"]];

  const InputField = ({ label, value, onChange, type = "text", placeholder = "", ...props }) => (
    <div>
      <label className="mb-1 block text-[11px] text-nova-offwhite/50">{label}</label>
      <input type={type} placeholder={placeholder} className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite placeholder:text-nova-offwhite/30 focus:outline-none focus:ring-1 focus:ring-nova-gold-light" value={value || ""} onChange={e => onChange(e.target.value)} {...props} />
    </div>
  );

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <div><div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">ADMIN</span></div><div className="font-sans text-[11px] text-nova-offwhite/50">{user.full_name}</div></div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60 hover:border-nova-gold/50">↻</button>
            <button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 font-sans text-xs text-nova-offwhite/60">Salir</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-5 pb-2">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setShowForm(null); setEditId(null); }} className={cn("shrink-0 rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors", tab === k ? "border border-nova-gold bg-nova-gold/10 text-nova-gold-light" : "border border-white/10 text-nova-offwhite/50")}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte" />)}</div>}

        {/* ====== DASHBOARD ====== */}
        {!loading && tab === "dashboard" && dashboard && (<>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ v: COP(dashboard.total_gross), l: "Bruto total" }, { v: COP(dashboard.total_barber), l: "Barberos", c: "text-nova-gold-light" }, { v: COP(dashboard.total_shop), l: "Barbería", c: "text-green-400" }, { v: dashboard.completed_count, l: "Completadas" }].map(({ v, l, c }) => (
              <div key={l} className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className={cn("font-display text-lg font-bold", c)}>{v}</div><div className="font-sans text-[11px] text-nova-offwhite/40">{l}</div></div>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold">{dashboard.scheduled_count}</div><div className="font-sans text-[11px] text-nova-offwhite/40">Agendadas</div></div>
            <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold text-red-400">{dashboard.no_show_count}</div><div className="font-sans text-[11px] text-nova-offwhite/40">No-shows</div></div>
            <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold">{Math.round(dashboard.no_show_rate * 100)}%</div><div className="font-sans text-[11px] text-nova-offwhite/40">Tasa no-show</div></div>
          </div>
          {dashboard.top_barbers?.length > 0 && (<>
            <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Ranking barberos</div>
            <div className="mb-4 rounded-nova border border-white/10 bg-nova-bg-matte">
              {dashboard.top_barbers.map((b, i) => (
                <div key={b.barber_id} className={cn("flex items-center gap-3 px-4 py-3", i < dashboard.top_barbers.length - 1 && "border-b border-white/5")}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nova-gold/10 font-display text-xs font-bold text-nova-gold-light">{b.barber_name.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
                  <div className="flex-1"><div className="font-sans text-sm font-medium">{b.barber_name}</div><div className="font-sans text-[11px] text-nova-offwhite/40">{b.completed_count} citas · {b.avg_pct}%</div></div>
                  <div className="text-right"><div className="font-sans text-sm font-semibold text-nova-gold-light">{COP(b.barber_total)}</div><div className="font-sans text-[10px] text-nova-offwhite/30">de {COP(b.gross_revenue)}</div></div>
                </div>
              ))}
            </div>
          </>)}
        </>)}

        {/* ====== CALENDARIO ====== */}
        {!loading && tab === "calendar" && (<>
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => { const d = new Date(calDate); d.setDate(d.getDate() - 1); setCalDate(d.toISOString().slice(0, 10)); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 hover:border-nova-gold/50">←</button>
            <div className="flex-1 text-center">
              <div className="font-display text-sm font-semibold">
                {calDate === new Date().toISOString().slice(0, 10) ? "Hoy" : new Date(calDate + "T12:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div className="font-sans text-[11px] text-nova-offwhite/40">{calDate}</div>
            </div>
            <button onClick={() => { const d = new Date(calDate); d.setDate(d.getDate() + 1); setCalDate(d.toISOString().slice(0, 10)); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 hover:border-nova-gold/50">→</button>
          </div>

          {calendar ? (<>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[
                { v: `${calendar.occupancy_pct}%`, l: "Ocupación", c: calendar.occupancy_pct > 70 ? "text-red-400" : calendar.occupancy_pct > 40 ? "text-nova-gold-light" : "text-green-400" },
                { v: calendar.booked_slots, l: "Reservados", c: "text-nova-gold-light" },
                { v: calendar.free_slots, l: "Disponibles", c: "text-green-400" },
                { v: calendar.chairs?.length || 0, l: "Sillas", c: "" },
              ].map(({ v, l, c }) => (
                <div key={l} className="rounded-nova border border-white/10 bg-nova-bg-matte p-3 text-center">
                  <div className={cn("font-display text-lg font-bold", c)}>{v}</div>
                  <div className="font-sans text-[11px] text-nova-offwhite/40">{l}</div>
                </div>
              ))}
            </div>
            <div className="mb-3 flex h-1.5 overflow-hidden rounded-full">
              <div className={cn("transition-all", calendar.occupancy_pct > 70 ? "bg-red-400" : calendar.occupancy_pct > 40 ? "bg-nova-gold" : "bg-green-400")} style={{ width: `${calendar.occupancy_pct}%` }} />
              <div className="flex-1 bg-white/5" />
            </div>
            <div className="mb-3 flex gap-3 text-[10px] text-nova-offwhite/40">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded border border-white/15" /> Libre</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-nova-gold/25" /> Reservado</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-green-400/25" /> Completado</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-amber-400/25" /> Atendido</span>
            </div>
            <div className="overflow-x-auto rounded-nova border border-white/10">
              <div className="grid text-[11px]" style={{ gridTemplateColumns: `48px ${"1fr ".repeat(calendar.chairs?.length || 0)}` }}>
                <div className="border-b border-r border-white/10 bg-nova-bg-matte p-2 text-center text-xs font-semibold">Hora</div>
                {calendar.chairs?.map(ch => (
                  <div key={ch.chair_id} className="border-b border-white/10 bg-nova-bg-matte p-2 text-center">
                    <div className="text-xs font-semibold">{ch.chair_label}</div>
                    <div className="text-[9px] text-nova-offwhite/35">{ch.barber_name?.split(" ")[0] || "—"}</div>
                  </div>
                ))}
                {calendar.time_labels?.map((t, ti) => (
                  <div key={t} className="contents">
                    <div className="flex items-center border-r border-white/10 px-1 text-nova-offwhite/35 font-mono">{t}</div>
                    {calendar.chairs?.map(ch => {
                      const slot = ch.slots?.[ti];
                      const st = slot?.status || "free";
                      return (
                        <div key={`${ch.chair_id}-${t}`} className={cn("border border-white/[0.06] p-1 min-h-[30px] flex flex-col justify-center",
                          st === "booked" && "border-nova-gold/15 bg-nova-gold/[0.06]",
                          st === "completed" && "border-green-500/15 bg-green-500/[0.05]",
                          st === "attended" && "border-amber-400/15 bg-amber-400/[0.05]")}>
                          {st !== "free" && (<>
                            <div className={cn("text-[10px] font-semibold", st === "booked" ? "text-nova-gold" : st === "completed" ? "text-green-400" : "text-amber-300")}>{slot.service_name}</div>
                            <div className="text-[8px] text-nova-offwhite/25">{slot.client_initials}</div>
                          </>)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>) : (
            <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center font-sans text-sm text-nova-offwhite/40">Sin datos de calendario</div>
          )}
        </>)}

        {/* ====== COBROS ====== */}
        {!loading && tab === "pending" && (<>
          <h3 className="mb-3 font-display text-sm font-bold">Pendientes de cobro ({pending.length})</h3>
          {pending.length === 0 ? <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center font-sans text-sm text-green-300">✓ Todo cobrado</div>
          : pending.map(p => (
            <div key={p.appointment_id} className="mb-3 rounded-nova border border-amber-400/20 bg-nova-bg-matte p-4">
              <div className="mb-1 flex justify-between"><span className="font-display text-sm font-semibold">{p.start_time} · {p.service_name}</span><span className="font-display font-bold text-nova-gold-light">{COP(p.service_price)}</span></div>
              <div className="mb-2 font-sans text-xs text-nova-offwhite/50">{p.client_name} · {p.barber_name} · {p.chair_label}</div>
              <button onClick={() => confirmPayment(p.appointment_id)} className="w-full rounded-nova bg-nova-gold-gradient py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">💰 Confirmar pago</button>
            </div>
          ))}
        </>)}

        {/* ====== STAFF ====== */}
        {!loading && tab === "staff" && (<>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">Equipo ({staff.length})</h3>
            <button onClick={() => { setShowForm("staff"); setForm({ role: "barber" }); setEditId(null); }} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Agregar</button>
          </div>
          {staff.map(s => (
            <div key={s.id} className="mb-2 rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nova-gold/10 font-display text-xs font-bold text-nova-gold-light">{s.full_name.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
                <div className="flex-1">
                  <div className="font-sans text-sm font-medium">{s.full_name}</div>
                  <div className="font-sans text-[11px] text-nova-offwhite/40">{s.role === "barber" ? `Barbero · ${s.branch_name || ""} · ${s.chair_label || ""}` : "Cajero/a"} · {s.phone}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", s.is_active ? "bg-green-400/10 text-green-300 border border-green-400/30" : "bg-red-400/10 text-red-300 border border-red-400/30")}>{s.is_active ? "Activo" : "Inactivo"}</span>
              </div>
              <div className="mt-2 flex gap-2 border-t border-white/5 pt-2">
                <button onClick={() => resetPassword(s.id, s.full_name)} className="rounded border border-white/10 px-2.5 py-1 text-[11px] text-nova-offwhite/50 hover:border-nova-gold/30 hover:text-nova-gold-light">🔑 Reset contraseña</button>
              </div>
            </div>
          ))}
          {showForm === "staff" && (
            <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
              <h4 className="mb-3 font-display text-sm font-semibold">Nuevo integrante</h4>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <InputField label="Nombre" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
                <InputField label="Teléfono" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Rol</label>
                  <select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="barber">Barbero</option><option value="cashier">Cajero/a</option>
                  </select></div>
                {form.role === "barber" && (
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Silla</label>
                    <select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.chair_id || ""} onChange={e => setForm({ ...form, chair_id: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {chairs.map(c => <option key={c.id} value={c.id}>{c.label}{c.barber_name ? ` (${c.barber_name})` : " — libre"}</option>)}
                    </select></div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={createStaff} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Crear</button>
                <button onClick={() => { setShowForm(null); setForm({}); }} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
              </div>
            </div>
          )}
        </>)}

        {/* ====== SERVICIOS ====== */}
        {!loading && tab === "services" && (<>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">Servicios ({services.length})</h3>
            <button onClick={() => { setShowForm("service"); setForm({ duration_minutes: 30 }); setEditId(null); }} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Agregar</button>
          </div>
          {services.map(s => (
            <div key={s.id} className="mb-2 rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
              <div className="flex items-center justify-between">
                <div><div className="font-sans text-sm font-medium">{s.name}</div><div className="font-sans text-[11px] text-nova-offwhite/40">{s.duration_minutes} min{!s.is_active ? " · Inactivo" : ""}</div></div>
                <span className="font-display text-sm font-semibold text-nova-gold-light">{COP(s.price)}</span>
              </div>
              <div className="mt-2 flex gap-2 border-t border-white/5 pt-2">
                <button onClick={() => editService(s)} className="rounded border border-white/10 px-2.5 py-1 text-[11px] text-nova-offwhite/50 hover:border-nova-gold/30 hover:text-nova-gold-light">✏️ Editar</button>
                <button onClick={() => deleteService(s.id)} className="rounded border border-white/10 px-2.5 py-1 text-[11px] text-nova-offwhite/50 hover:border-red-400/30 hover:text-red-300">🗑 Eliminar</button>
              </div>
            </div>
          ))}
          {showForm === "service" && (
            <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
              <h4 className="mb-3 font-display text-sm font-semibold">{editId ? "Editar servicio" : "Nuevo servicio"}</h4>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <InputField label="Nombre" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Ej: Corte premium" />
                <InputField label="Precio (COP)" type="number" value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="17000" />
                <InputField label="Minutos" type="number" value={form.duration_minutes} onChange={v => setForm({ ...form, duration_minutes: v })} step="30" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveService} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">{editId ? "Guardar" : "Crear"}</button>
                <button onClick={() => { setShowForm(null); setForm({}); setEditId(null); }} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
              </div>
            </div>
          )}
        </>)}

        {/* ====== COMISIONES ====== */}
        {!loading && tab === "commissions" && (<>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">Reglas de comisión</h3>
            <button onClick={() => { setShowForm("commission"); setForm({ barber_pct: 60 }); setEditId(null); }} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Regla</button>
          </div>
          {rules.map(r => (
            <div key={r.id} className="mb-2 rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
              <div className="flex items-center justify-between">
                <div><div className="font-sans text-sm font-medium">{r.barber_name || r.branch_name || "Global"}</div><div className="font-sans text-[11px] text-nova-offwhite/40">{r.applies_on ? `Solo ${r.applies_on}` : "Siempre"}{r.note ? ` · ${r.note}` : ""}</div></div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-nova-gold/30 bg-nova-gold/10 px-2 py-0.5 text-xs font-semibold text-nova-gold-light">{r.barber_pct}%</span>
                  <span className="text-xs text-nova-offwhite/40">/</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-nova-offwhite/50">{r.shop_pct}%</span>
                </div>
              </div>
              <div className="mt-2 flex gap-2 border-t border-white/5 pt-2">
                <button onClick={() => { setEditId(r.id); setForm({ barber_pct: r.barber_pct, note: r.note }); setShowForm("commission"); }} className="rounded border border-white/10 px-2.5 py-1 text-[11px] text-nova-offwhite/50 hover:border-nova-gold/30 hover:text-nova-gold-light">✏️ Editar</button>
                <button onClick={() => deleteCommission(r.id)} className="rounded border border-white/10 px-2.5 py-1 text-[11px] text-nova-offwhite/50 hover:border-red-400/30 hover:text-red-300">🗑 Eliminar</button>
              </div>
            </div>
          ))}
          {showForm === "commission" && (
            <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
              <h4 className="mb-3 font-display text-sm font-semibold">{editId ? "Editar regla" : "Nueva regla"}</h4>
              {!editId && (
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Barbero (vacío = todos)</label>
                    <select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.barber_id || ""} onChange={e => setForm({ ...form, barber_id: e.target.value || null })}>
                      <option value="">Todos (global)</option>
                      {staff.filter(s => s.role === "barber").map(s => <option key={s.barber_id} value={s.barber_id}>{s.full_name}</option>)}
                    </select></div>
                  <InputField label="Fecha específica (vacío = siempre)" type="date" value={form.applies_on} onChange={v => setForm({ ...form, applies_on: v || null })} />
                </div>
              )}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <InputField label="% Barbero" type="number" value={form.barber_pct} onChange={v => setForm({ ...form, barber_pct: v })} min="0" max="100" />
                <InputField label="Nota" value={form.note} onChange={v => setForm({ ...form, note: v })} placeholder="Ej: Domingo festivo" />
              </div>
              <div className="mb-3 flex h-2 overflow-hidden rounded-full"><div className="bg-gradient-to-r from-nova-gold to-nova-gold-light" style={{ width: `${form.barber_pct}%` }} /><div className="flex-1 bg-white/5" /></div>
              <div className="mb-4 flex justify-between text-[10px] text-nova-offwhite/40"><span>Barbero {form.barber_pct}%</span><span>Barbería {100 - (form.barber_pct || 0)}%</span></div>
              <div className="mb-4 flex flex-wrap gap-2">
                {[50,60,65,70,80].map(v => <button key={v} onClick={() => setForm({...form, barber_pct: v})} className={cn("rounded-full border px-3 py-1 text-xs", parseInt(form.barber_pct)===v ? "border-nova-gold bg-nova-gold/15 text-nova-gold-light" : "border-white/15 text-nova-offwhite/50")}>{v}/{100-v}</button>)}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCommission} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">{editId ? "Guardar" : "Crear"}</button>
                <button onClick={() => { setShowForm(null); setForm({}); setEditId(null); }} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
              </div>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
