import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { COP, Inp, FormWrap, ItemCard, Btn, CalendarGrid, SlotDetailModal } from "@/components/admin/AdminUI";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CashierDashboard({ user, token, onLogout, onHome }) {
  const [tab, setTab] = useState("pending");
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [pending, setPending] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [calDate, setCalDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [pettyCash, setPettyCash] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState({});
  const [slotDetail, setSlotDetail] = useState(null);
  const [showForm, setShowForm] = useState(null);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pd, pc] = await Promise.all([
        fetch(`${API}/cashier/pending`, { headers: H }).then(r=>r.ok?r.json():[]),
        fetch(`${API}/petty-cash`, { headers: H }).then(r=>r.ok?r.json():[]),
      ]);
      setPending(pd); setPettyCash(pc);
      const br = await fetch(`${API}/branches`).then(r=>r.json()).catch(()=>[]);
      if (br.length > 0) {
        const cal = await fetch(`${API}/branches/${br[0].id}/calendar?date=${calDate}`).then(r=>r.ok?r.json():null);
        setCalendar(cal);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token, calDate]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{const id=setInterval(load,30000);return()=>clearInterval(id);},[load]);

  const api = async (method, url, body) => await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const confirmPayment = async (id) => { await api("POST", `${API}/cashier/${id}/confirm`, { payment_method: payMethod[id] || "efectivo" }); load(); };
  const closeForm = () => { setShowForm(null); setForm({}); setEditId(null); };
  const savePetty = async () => {
    const body = { date: form.date, description: form.description, amount: parseInt(form.amount) };
    const r = editId ? await api("PATCH", `${API}/petty-cash/${editId}`, body) : await api("POST", `${API}/petty-cash`, body);
    if (r.ok) { closeForm(); load(); }
  };

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div><div className="font-display text-sm font-bold">NOVA <span className="text-nova-gold-light">CAJA</span></div><div className="text-[11px] text-nova-offwhite/50">{user.full_name}</div></div>
          <div className="flex gap-2">{onHome && <button onClick={onHome} className="rounded-nova border border-white/15 px-3 py-1.5 text-xs text-nova-offwhite/60">🏠</button>}<button onClick={load} className="rounded-nova border border-white/15 px-3 py-1.5 text-xs text-nova-offwhite/60">↻</button><button onClick={onLogout} className="rounded-nova border border-white/15 px-3 py-1.5 text-xs text-nova-offwhite/60">Salir</button></div>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-5 pb-2">
          {[["pending",`💰 Cobros (${pending.length})`],["calendar","📅 Calendario"],["petty","🧾 Caja menor"]].map(([k,l])=>
            <button key={k} onClick={()=>{setTab(k);closeForm();}} className={cn("rounded-full px-3 py-1.5 text-xs font-medium",tab===k?"border border-nova-gold bg-nova-gold/10 text-nova-gold-light":"border border-white/10 text-nova-offwhite/50")}>{l}</button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {tab==="pending" && (<>
          {pending.length===0?<div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center text-green-300">✓ Todo cobrado</div>
          :pending.map(p=><div key={p.appointment_id} className="mb-3 rounded-nova border border-amber-400/20 bg-nova-bg-matte p-4">
            <div className="mb-1 flex justify-between"><span className="font-display text-sm font-semibold">{p.start_time} · {p.service_name}</span><span className="font-display font-bold text-nova-gold-light">{COP(p.service_price)}</span></div>
            <div className="mb-3 text-xs text-nova-offwhite/50">{p.client_name} · {p.client_phone} · {p.barber_name}</div>
            <div className="flex gap-2 mb-2">
              {["efectivo","transferencia"].map(m=><button key={m} onClick={()=>setPayMethod({...payMethod,[p.appointment_id]:m})} className={cn("flex-1 rounded-nova border py-1.5 text-xs font-medium capitalize",(payMethod[p.appointment_id]||"efectivo")===m?"border-nova-gold bg-nova-gold/15 text-nova-gold-light":"border-white/10 text-nova-offwhite/50")}>{m==="efectivo"?"💵 Efectivo":"📱 Transferencia"}</button>)}
            </div>
            <button onClick={()=>confirmPayment(p.appointment_id)} className="w-full rounded-nova bg-nova-gold-gradient py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">Confirmar pago</button>
          </div>)}
        </>)}

        {tab==="calendar" && (<>
          <div className="mb-4 flex items-center gap-3">
            <button onClick={()=>{const d=new Date(calDate);d.setDate(d.getDate()-1);setCalDate(d.toISOString().slice(0,10));}} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60">←</button>
            <div className="flex-1 text-center"><div className="font-display text-sm font-semibold">{calDate===new Date().toISOString().slice(0,10)?"Hoy":new Date(calDate+"T12:00").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</div></div>
            <button onClick={()=>{const d=new Date(calDate);d.setDate(d.getDate()+1);setCalDate(d.toISOString().slice(0,10));}} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60">→</button>
          </div>
          <CalendarGrid calendar={calendar} onSlotClick={(sl,ch,t)=>setSlotDetail({slot:sl,chair:ch,time:t})} />
          {slotDetail && <SlotDetailModal slot={slotDetail.slot} chair={slotDetail.chair} time={slotDetail.time} onClose={()=>setSlotDetail(null)} />}
        </>)}

        {tab==="petty" && (<>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-sm font-bold">Caja menor</h3>
            <button onClick={()=>{setShowForm("petty");setForm({date:new Date().toISOString().slice(0,10)});setEditId(null);}} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">+ Gasto</button></div>
          {pettyCash.length > 0 && <div className="mb-3 rounded-nova border border-white/10 bg-nova-bg-matte p-3"><div className="font-display text-lg font-bold text-red-400">{COP(pettyCash.reduce((s,p)=>s+p.amount,0))}</div><div className="text-[11px] text-nova-offwhite/40">Total este mes</div></div>}
          {pettyCash.map(p=><ItemCard key={p.id} actions={<><Btn onClick={()=>{setEditId(p.id);setForm({date:p.date,description:p.description,amount:p.amount});setShowForm("petty");}}>✏️</Btn><Btn onClick={()=>{if(confirm("¿Eliminar?"))api("DELETE",`${API}/petty-cash/${p.id}`).then(load)}} danger>🗑</Btn></>}>
            <div className="flex justify-between"><div><div className="text-sm font-medium">{p.description}</div><div className="text-[11px] text-nova-offwhite/40">{p.date}</div></div><span className="font-display text-sm font-semibold text-red-400">{COP(p.amount)}</span></div>
          </ItemCard>)}
          {showForm==="petty" && <FormWrap title={editId?"Editar":"Nuevo gasto"} onSave={savePetty} onCancel={closeForm}>
            <div className="grid grid-cols-3 gap-3"><Inp label="Fecha" type="date" value={form.date} onChange={v=>setForm({...form,date:v})}/><Inp label="Descripción" value={form.description} onChange={v=>setForm({...form,description:v})}/><Inp label="Monto" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})}/></div>
          </FormWrap>}
        </>)}
      </div>
    </div>
  );
}
