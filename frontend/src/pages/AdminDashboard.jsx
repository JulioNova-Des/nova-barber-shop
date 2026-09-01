import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { COP, Inp, FormWrap, ItemCard, Btn, AddBtn, SectionHeader, CalendarGrid, SlotDetailModal } from "@/components/admin/AdminUI";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminDashboard({ user, token, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [teamSub, setTeamSub] = useState("members");
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
  const [visits, setVisits] = useState(null);
  const [pettyCash, setPettyCash] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(null);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [slotDetail, setSlotDetail] = useState(null);
  const [payMethod, setPayMethod] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, st, sv, br, rl, pd, vi, pc] = await Promise.all([
        fetch(`${API}/admin/dashboard`, { headers: H }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/admin/staff`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/services?only_active=false`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/branches?only_active=false`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/commissions`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/cashier/pending`, { headers: H }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/analytics/visits`, { headers: H }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/petty-cash`, { headers: H }).then(r => r.ok ? r.json() : []),
      ]);
      setDashboard(d); setStaff(st); setServices(sv); setBranches(br); setRules(rl); setPending(pd); setVisits(vi); setPettyCash(pc);
      if (br.length > 0) {
        const [ch, cal] = await Promise.all([
          fetch(`${API}/branches/${br[0].id}/chairs`).then(r => r.ok ? r.json() : []),
          fetch(`${API}/branches/${br[0].id}/calendar?date=${calDate}`).then(r => r.ok ? r.json() : null),
        ]);
        setChairs(ch); setCalendar(cal);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token, calDate]);

  useEffect(() => { load(); }, [load]);
  const closeForm = () => { setShowForm(null); setForm({}); setEditId(null); };

  // API helpers
  const api = async (method, url, body) => { const r = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); return r; };

  // Confirm payment with method
  const confirmPayment = async (id) => {
    const method = payMethod[id] || "efectivo";
    await api("POST", `${API}/cashier/${id}/confirm`, { payment_method: method });
    load();
  };

  // Service CRUD
  const saveService = async () => {
    const body = { name: form.name, price: parseInt(form.price), duration_minutes: parseInt(form.duration_minutes || 30) };
    const r = editId ? await api("PATCH", `${API}/services/${editId}`, body) : await api("POST", `${API}/services`, body);
    if (r.ok) { closeForm(); load(); } else { const e = await r.json(); alert(e.detail); }
  };

  // Branch CRUD
  const saveBranch = async () => {
    const body = { name: form.name, address: form.address, city: form.city, phone: form.phone || null };
    const r = editId ? await api("PATCH", `${API}/branches/${editId}`, body) : await api("POST", `${API}/branches`, body);
    if (r.ok) { closeForm(); load(); } else { const e = await r.json(); alert(e.detail); }
  };

  // Chair CRUD
  const saveChair = async () => {
    const brId = form.branch_id || branches[0]?.id;
    const r = editId ? await api("PATCH", `${API}/branches/${brId}/chairs/${editId}`, { label: form.label }) : await api("POST", `${API}/branches/${brId}/chairs`, { label: form.label });
    if (r.ok) { closeForm(); load(); } else { const e = await r.json(); alert(e.detail); }
  };

  // Staff CRUD
  const createStaff = async () => {
    const body = { ...form }; if (form.role === "barber" && branches.length > 0) body.branch_id = branches[0].id;
    const r = await api("POST", `${API}/admin/staff`, body);
    if (r.ok) { const d = await r.json(); alert(`✅ ${d.user.full_name}\nContraseña: ${d.temporary_password}`); closeForm(); load(); }
    else { const e = await r.json(); alert(e.detail); }
  };
  const resetPw = async (id, name) => { if (!confirm(`¿Resetear contraseña de ${name}?`)) return; const r = await api("POST", `${API}/admin/staff/${id}/reset-password`); if (r.ok) { const d = await r.json(); alert(`Nueva pw: ${d.new_temporary_password}`); } };

  // Commission CRUD
  const saveCommission = async () => {
    const body = { barber_pct: parseInt(form.barber_pct), note: form.note || null, barber_id: form.barber_id ? parseInt(form.barber_id) : null, applies_on: form.applies_on || null };
    const r = editId ? await api("PATCH", `${API}/commissions/${editId}`, { barber_pct: body.barber_pct, note: body.note }) : await api("POST", `${API}/commissions`, body);
    if (r.ok) { closeForm(); load(); } else { const e = await r.json(); alert(e.detail); }
  };

  // Petty Cash CRUD
  const savePettyCash = async () => {
    const body = { date: form.date, description: form.description, amount: parseInt(form.amount) };
    const r = editId ? await api("PATCH", `${API}/petty-cash/${editId}`, body) : await api("POST", `${API}/petty-cash`, body);
    if (r.ok) { closeForm(); load(); } else { const e = await r.json(); alert(e.detail); }
  };

  const TABS = [["dashboard","📊 Resumen"],["calendar","📅 Calendario"],["pending",`💰 Cobros${pending.length?` (${pending.length})`:""}`],["team","🏢 Team"],["services","✂ Servicios"],["commissions","% Comisiones"],["petty","🧾 Caja menor"],["visits","👁 Visitas"]];

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <div><div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">ADMIN</span></div><div className="text-[11px] text-nova-offwhite/50">{user.full_name}</div></div>
          <div className="flex gap-2"><button onClick={load} className="rounded-nova border border-white/15 px-3 py-1.5 text-xs text-nova-offwhite/60">↻</button><button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 text-xs text-nova-offwhite/60">Salir</button></div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-5 pb-2">
          {TABS.map(([k,l])=><button key={k} onClick={()=>{setTab(k);closeForm();}} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",tab===k?"border border-nova-gold bg-nova-gold/10 text-nova-gold-light":"border border-white/10 text-nova-offwhite/50")}>{l}</button>)}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {loading && <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte"/>)}</div>}

        {/* ===== DASHBOARD ===== */}
        {!loading && tab==="dashboard" && dashboard && (<>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{v:COP(dashboard.total_gross),l:"Bruto"},{v:COP(dashboard.total_barber),l:"Barberos",c:"text-nova-gold-light"},{v:COP(dashboard.total_shop),l:"Barbería",c:"text-green-400"},{v:dashboard.completed_count,l:"Completadas"}].map(({v,l,c})=>
              <div key={l} className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className={cn("font-display text-lg font-bold",c)}>{v}</div><div className="text-[11px] text-nova-offwhite/40">{l}</div></div>
            )}
          </div>
          {visits && <div className="mb-4 grid grid-cols-2 gap-3"><div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold text-nova-champagne">{visits.today}</div><div className="text-[11px] text-nova-offwhite/40">Visitas hoy</div></div><div className="rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold text-nova-champagne">{visits.this_month}</div><div className="text-[11px] text-nova-offwhite/40">Visitas este mes</div></div></div>}
          {dashboard.top_barbers?.length > 0 && (<><div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-nova-offwhite/60">Ranking barberos</div><div className="rounded-nova border border-white/10 bg-nova-bg-matte">{dashboard.top_barbers.map((b,i)=><div key={b.barber_id} className={cn("flex items-center gap-3 px-4 py-3",i<dashboard.top_barbers.length-1&&"border-b border-white/5")}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nova-gold/10 font-display text-xs font-bold text-nova-gold-light">{b.barber_name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div><div className="flex-1"><div className="text-sm font-medium">{b.barber_name}</div><div className="text-[11px] text-nova-offwhite/40">{b.completed_count} citas</div></div><div className="font-semibold text-nova-gold-light">{COP(b.barber_total)}</div></div>)}</div></>)}
        </>)}

        {/* ===== CALENDAR ===== */}
        {!loading && tab==="calendar" && (<>
          <div className="mb-4 flex items-center gap-3">
            <button onClick={()=>{const d=new Date(calDate);d.setDate(d.getDate()-1);setCalDate(d.toISOString().slice(0,10));}} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60">←</button>
            <div className="flex-1 text-center"><div className="font-display text-sm font-semibold">{calDate===new Date().toISOString().slice(0,10)?"Hoy":new Date(calDate+"T12:00").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</div></div>
            <button onClick={()=>{const d=new Date(calDate);d.setDate(d.getDate()+1);setCalDate(d.toISOString().slice(0,10));}} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60">→</button>
          </div>
          <CalendarGrid calendar={calendar} onSlotClick={(sl,ch,t)=>setSlotDetail({slot:sl,chair:ch,time:t})} />
          {slotDetail && <SlotDetailModal slot={slotDetail.slot} chair={slotDetail.chair} time={slotDetail.time} onClose={()=>setSlotDetail(null)} />}
        </>)}

        {/* ===== COBROS ===== */}
        {!loading && tab==="pending" && (<>
          <SectionHeader title="Pendientes de cobro" count={pending.length} />
          {pending.length===0?<div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center text-green-300">✓ Todo cobrado</div>
          :pending.map(p=><div key={p.appointment_id} className="mb-3 rounded-nova border border-amber-400/20 bg-nova-bg-matte p-4">
            <div className="mb-1 flex justify-between"><span className="font-display text-sm font-semibold">{p.start_time} · {p.service_name}</span><span className="font-display font-bold text-nova-gold-light">{COP(p.service_price)}</span></div>
            <div className="mb-3 text-xs text-nova-offwhite/50">{p.client_name} · {p.barber_name} · {p.chair_label}</div>
            <div className="flex gap-2 mb-2">
              {["efectivo","transferencia"].map(m=><button key={m} onClick={()=>setPayMethod({...payMethod,[p.appointment_id]:m})} className={cn("flex-1 rounded-nova border py-1.5 text-xs font-medium capitalize",(payMethod[p.appointment_id]||"efectivo")===m?"border-nova-gold bg-nova-gold/15 text-nova-gold-light":"border-white/10 text-nova-offwhite/50")}>{m==="efectivo"?"💵 Efectivo":"📱 Transferencia"}</button>)}
            </div>
            <button onClick={()=>confirmPayment(p.appointment_id)} className="w-full rounded-nova bg-nova-gold-gradient py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Confirmar pago</button>
          </div>)}
        </>)}

        {/* ===== TEAM ===== */}
        {!loading && tab==="team" && (<>
          <div className="mb-4 flex gap-2">
            {[["members","👥 Barberos y Roles"],["locations","🏪 Sedes y Sillas"]].map(([k,l])=>
              <button key={k} onClick={()=>{setTeamSub(k);closeForm();}} className={cn("rounded-full px-4 py-1.5 text-xs font-medium",teamSub===k?"border border-nova-gold bg-nova-gold/10 text-nova-gold-light":"border border-white/10 text-nova-offwhite/50")}>{l}</button>
            )}
          </div>

          {teamSub==="members" && (<>
            <SectionHeader title="Equipo" count={staff.length} actionLabel="+ Agregar" onAction={()=>{setShowForm("staff");setForm({role:"barber"});}} />
            {staff.map(s=><ItemCard key={s.id} actions={<><Btn onClick={()=>resetPw(s.id,s.full_name)}>🔑 Reset pw</Btn></>}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nova-gold/10 font-display text-xs font-bold text-nova-gold-light">{s.full_name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                <div className="flex-1"><div className="text-sm font-medium">{s.full_name}</div><div className="text-[11px] text-nova-offwhite/40">{s.role==="barber"?`Barbero · ${s.branch_name||""} · ${s.chair_label||""}`:"Cajero/a"} · {s.phone}</div></div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px]",s.is_active?"text-green-300 border border-green-400/30":"text-red-300 border border-red-400/30")}>{s.is_active?"Activo":"Inactivo"}</span>
              </div>
            </ItemCard>)}
            {showForm==="staff" && <FormWrap title="Nuevo integrante" onSave={createStaff} onCancel={closeForm}>
              <div className="grid grid-cols-2 gap-3 mb-3"><Inp label="Nombre" value={form.full_name} onChange={v=>setForm({...form,full_name:v})}/><Inp label="Teléfono" value={form.phone} onChange={v=>setForm({...form,phone:v})}/></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Rol</label><select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="barber">Barbero</option><option value="cashier">Cajero/a</option></select></div>
              {form.role==="barber"&&<div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Silla</label><select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.chair_id||""} onChange={e=>setForm({...form,chair_id:e.target.value})}><option value="">Seleccionar...</option>{chairs.map(c=><option key={c.id} value={c.id}>{c.label}{c.barber_name?` (${c.barber_name})`:""}</option>)}</select></div>}</div>
            </FormWrap>}
          </>)}

          {teamSub==="locations" && (<>
            <SectionHeader title="Sucursales" count={branches.length} actionLabel="+ Sucursal" onAction={()=>{setShowForm("branch");setForm({});}} />
            {branches.map(b=>(
              <div key={b.id} className="mb-4 rounded-nova border border-white/10 bg-nova-bg-matte p-4">
                <div className="flex justify-between mb-2">
                  <div><div className="text-sm font-semibold">{b.name}</div><div className="text-[11px] text-nova-offwhite/40">{b.address}, {b.city}</div></div>
                  <div className="flex gap-1"><Btn onClick={()=>{setEditId(b.id);setForm({name:b.name,address:b.address,city:b.city,phone:b.phone});setShowForm("branch");}}>✏️</Btn><Btn onClick={()=>{if(confirm("¿Desactivar?"))api("DELETE",`${API}/branches/${b.id}`).then(load)}} danger>🗑</Btn></div>
                </div>
                <div className="text-[11px] text-nova-offwhite/50 mb-2">{chairs.filter(c=>c.branch_id===b.id).length} sillas</div>
                <div className="space-y-1.5">
                  {chairs.filter(c=>c.branch_id===b.id).map(c=>(
                    <div key={c.id} className="flex items-center justify-between rounded border border-white/5 bg-nova-bg-main px-3 py-2">
                      <div><span className="text-xs font-medium">{c.label}</span>{c.barber_name && <span className="ml-2 text-[11px] text-nova-gold-light">{c.barber_name}</span>}{!c.barber_name && <span className="ml-2 text-[11px] text-nova-offwhite/30">Disponible</span>}</div>
                      <div className="flex gap-1"><Btn onClick={()=>{setEditId(c.id);setForm({label:c.label,branch_id:c.branch_id});setShowForm("chair");}}>✏️</Btn><Btn onClick={()=>{if(confirm("¿Desactivar silla?"))api("DELETE",`${API}/branches/${c.branch_id}/chairs/${c.id}`).then(load)}} danger>🗑</Btn></div>
                    </div>
                  ))}
                  <button onClick={()=>{setShowForm("chair");setForm({branch_id:b.id});setEditId(null);}} className="w-full rounded border border-dashed border-white/15 py-1.5 text-[11px] text-nova-offwhite/40 hover:border-nova-gold/30 hover:text-nova-gold-light">+ Agregar silla</button>
                </div>
              </div>
            ))}
            {showForm==="branch" && <FormWrap title={editId?"Editar sucursal":"Nueva sucursal"} onSave={saveBranch} onCancel={closeForm}>
              <div className="grid grid-cols-2 gap-3"><Inp label="Nombre" value={form.name} onChange={v=>setForm({...form,name:v})} placeholder="NOVA..."/><Inp label="Teléfono" value={form.phone} onChange={v=>setForm({...form,phone:v})}/></div>
              <div className="grid grid-cols-2 gap-3 mt-3"><Inp label="Dirección" value={form.address} onChange={v=>setForm({...form,address:v})}/><Inp label="Ciudad" value={form.city} onChange={v=>setForm({...form,city:v})}/></div>
            </FormWrap>}
            {showForm==="chair" && <FormWrap title={editId?"Editar silla":"Nueva silla"} onSave={saveChair} onCancel={closeForm}>
              <Inp label="Nombre" value={form.label} onChange={v=>setForm({...form,label:v})} placeholder="Ej: Silla 4"/>
            </FormWrap>}
          </>)}
        </>)}

        {/* ===== SERVICIOS ===== */}
        {!loading && tab==="services" && (<>
          <SectionHeader title="Servicios" count={services.length} actionLabel="+ Agregar" onAction={()=>{setShowForm("service");setForm({duration_minutes:30});}} />
          {services.map(s=><ItemCard key={s.id} actions={<><Btn onClick={()=>{setEditId(s.id);setForm({name:s.name,price:s.price,duration_minutes:s.duration_minutes});setShowForm("service");}}>✏️ Editar</Btn><Btn onClick={()=>{if(confirm("¿Eliminar?"))api("DELETE",`${API}/services/${s.id}`).then(load)}} danger>🗑 Eliminar</Btn></>}>
            <div className="flex justify-between"><div><div className="text-sm font-medium">{s.name}</div><div className="text-[11px] text-nova-offwhite/40">{s.duration_minutes} min</div></div><span className="font-display text-sm font-semibold text-nova-gold-light">{COP(s.price)}</span></div>
          </ItemCard>)}
          {showForm==="service" && <FormWrap title={editId?"Editar":"Nuevo servicio"} onSave={saveService} onCancel={closeForm}>
            <div className="grid grid-cols-3 gap-3"><Inp label="Nombre" value={form.name} onChange={v=>setForm({...form,name:v})}/><Inp label="Precio" type="number" value={form.price} onChange={v=>setForm({...form,price:v})}/><Inp label="Min" type="number" value={form.duration_minutes} onChange={v=>setForm({...form,duration_minutes:v})} step="30"/></div>
          </FormWrap>}
        </>)}

        {/* ===== COMISIONES ===== */}
        {!loading && tab==="commissions" && (<>
          <SectionHeader title="Comisiones" actionLabel="+ Regla" onAction={()=>{setShowForm("commission");setForm({barber_pct:60});}} />
          {rules.map(r=><ItemCard key={r.id} actions={<><Btn onClick={()=>{setEditId(r.id);setForm({barber_pct:r.barber_pct,note:r.note});setShowForm("commission");}}>✏️</Btn><Btn onClick={()=>{if(confirm("¿Eliminar?"))api("DELETE",`${API}/commissions/${r.id}`).then(load)}} danger>🗑</Btn></>}>
            <div className="flex justify-between"><div><div className="text-sm font-medium">{r.barber_name||"Global"}</div><div className="text-[11px] text-nova-offwhite/40">{r.applies_on||"Siempre"}{r.note?` · ${r.note}`:""}</div></div>
            <div className="flex gap-1"><span className="rounded-full border border-nova-gold/30 bg-nova-gold/10 px-2 py-0.5 text-xs font-semibold text-nova-gold-light">{r.barber_pct}%</span><span className="text-xs text-nova-offwhite/30">/</span><span className="text-xs text-nova-offwhite/40">{r.shop_pct}%</span></div></div>
          </ItemCard>)}
          {showForm==="commission" && <FormWrap title={editId?"Editar":"Nueva regla"} onSave={saveCommission} onCancel={closeForm}>
            {!editId&&<div className="grid grid-cols-2 gap-3 mb-3"><div><label className="mb-1 block text-[11px] text-nova-offwhite/50">Barbero</label><select className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite" value={form.barber_id||""} onChange={e=>setForm({...form,barber_id:e.target.value||null})}><option value="">Todos</option>{staff.filter(s=>s.role==="barber").map(s=><option key={s.barber_id} value={s.barber_id}>{s.full_name}</option>)}</select></div><Inp label="Fecha" type="date" value={form.applies_on} onChange={v=>setForm({...form,applies_on:v||null})}/></div>}
            <div className="grid grid-cols-2 gap-3"><Inp label="% Barbero" type="number" value={form.barber_pct} onChange={v=>setForm({...form,barber_pct:v})} min="0" max="100"/><Inp label="Nota" value={form.note} onChange={v=>setForm({...form,note:v})}/></div>
            <div className="mt-3 mb-3 flex flex-wrap gap-2">{[50,60,65,70,80].map(v=><button key={v} onClick={()=>setForm({...form,barber_pct:v})} className={cn("rounded-full border px-3 py-1 text-xs",parseInt(form.barber_pct)===v?"border-nova-gold bg-nova-gold/15 text-nova-gold-light":"border-white/15 text-nova-offwhite/50")}>{v}/{100-v}</button>)}</div>
          </FormWrap>}
        </>)}

        {/* ===== CAJA MENOR ===== */}
        {!loading && tab==="petty" && (<>
          <SectionHeader title="Caja menor" count={pettyCash.length} actionLabel="+ Gasto" onAction={()=>{setShowForm("petty");setForm({date:new Date().toISOString().slice(0,10)});}} />
          {pettyCash.length > 0 && <div className="mb-4 rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold text-red-400">{COP(pettyCash.reduce((s,p)=>s+p.amount,0))}</div><div className="text-[11px] text-nova-offwhite/40">Total gastos este mes</div></div>}
          {pettyCash.map(p=><ItemCard key={p.id} actions={<><Btn onClick={()=>{setEditId(p.id);setForm({date:p.date,description:p.description,amount:p.amount});setShowForm("petty");}}>✏️ Editar</Btn><Btn onClick={()=>{if(confirm("¿Eliminar?"))api("DELETE",`${API}/petty-cash/${p.id}`).then(load)}} danger>🗑</Btn></>}>
            <div className="flex justify-between"><div><div className="text-sm font-medium">{p.description}</div><div className="text-[11px] text-nova-offwhite/40">{p.date} · por {p.created_by_name}</div></div>
            <span className="font-display text-sm font-semibold text-red-400">{COP(p.amount)}</span></div>
          </ItemCard>)}
          {showForm==="petty" && <FormWrap title={editId?"Editar gasto":"Nuevo gasto"} onSave={savePettyCash} onCancel={closeForm}>
            <div className="grid grid-cols-3 gap-3"><Inp label="Fecha" type="date" value={form.date} onChange={v=>setForm({...form,date:v})}/><Inp label="Descripción" value={form.description} onChange={v=>setForm({...form,description:v})} placeholder="Ej: Agua, toallas"/><Inp label="Monto (COP)" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})}/></div>
          </FormWrap>}
        </>)}

        {/* ===== VISITAS ===== */}
        {!loading && tab==="visits" && visits && (<>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-4"><div className="font-display text-2xl font-bold text-nova-champagne">{visits.today}</div><div className="text-[11px] text-nova-offwhite/40">Hoy</div></div>
            <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-4"><div className="font-display text-2xl font-bold text-nova-champagne">{visits.this_month}</div><div className="text-[11px] text-nova-offwhite/40">Este mes</div></div>
          </div>
          {visits.history?.map(m=><div key={`${m.year}-${m.month}`} className="mb-3 rounded-nova border border-white/10 bg-nova-bg-matte p-4">
            <div className="flex justify-between mb-2"><span className="font-display text-sm font-semibold">{m.month_label}</span><span className="font-display text-sm font-bold text-nova-champagne">{m.total}</span></div>
            <div className="flex gap-[2px] h-8 items-end">{m.days.map(d=>{const max=Math.max(...m.days.map(x=>x.count),1);return <div key={d.date} title={`${d.date}: ${d.count}`} className="flex-1 rounded-t bg-nova-gold/40 hover:bg-nova-gold/70 cursor-default" style={{height:`${Math.max(d.count/max*100,4)}%`}}/>;})}</div>
          </div>)}
        </>)}
      </div>
    </div>
  );
}
