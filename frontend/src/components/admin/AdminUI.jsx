import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export function Inp({ label, value, onChange, type = "text", ...p }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div>
      <label className="mb-1 block text-[11px] text-nova-offwhite/50">{label}</label>
      <div className="relative">
        <input type={isPw && show ? "text" : type}
          className="h-10 w-full rounded-nova border border-white/15 bg-nova-bg-main px-3 text-sm text-nova-offwhite placeholder:text-nova-offwhite/30 focus:outline-none focus:ring-1 focus:ring-nova-gold-light pr-9"
          value={value || ""} onChange={e => onChange(e.target.value)} {...p} />
        {isPw && <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nova-offwhite/40">{show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
      </div>
    </div>
  );
}

export function FormWrap({ title, onSave, onCancel, saveLabel = "Guardar", children }) {
  return (
    <div className="mt-4 rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
      <h4 className="mb-3 font-display text-sm font-semibold">{title}</h4>
      {children}
      <div className="flex gap-2 mt-3">
        <button onClick={onSave} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">{saveLabel}</button>
        <button onClick={onCancel} className="rounded-nova border border-white/15 px-4 py-2 text-xs text-nova-offwhite/60">Cancelar</button>
      </div>
    </div>
  );
}

export function ItemCard({ children, actions }) {
  return (
    <div className="mb-2 rounded-nova border border-white/10 bg-nova-bg-matte px-4 py-3">
      {children}
      {actions && <div className="mt-2 flex gap-2 border-t border-white/5 pt-2">{actions}</div>}
    </div>
  );
}

export function Btn({ onClick, children, danger }) {
  return <button onClick={onClick} className={cn("rounded border border-white/10 px-2.5 py-1 text-[11px] text-nova-offwhite/50 hover:text-nova-gold-light", danger && "hover:border-red-400/30 hover:text-red-300")}>{children}</button>;
}

export function AddBtn({ onClick, label }) {
  return <button onClick={onClick} className="rounded-nova bg-nova-gold-gradient px-4 py-2 font-display text-xs font-semibold uppercase text-nova-bg-deep">{label}</button>;
}

export function SectionHeader({ title, count, actionLabel, onAction }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-display text-sm font-bold">{title}{count != null ? ` (${count})` : ""}</h3>
      {actionLabel && <AddBtn onClick={onAction} label={actionLabel} />}
    </div>
  );
}

export function CalendarGrid({ calendar, onSlotClick }) {
  if (!calendar) return <div className="rounded-nova border border-white/10 bg-nova-bg-matte p-8 text-center text-sm text-nova-offwhite/40">Sin datos</div>;
  return (
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
              const sl = ch.slots?.[ti]; const st = sl?.status || "free";
              return (
                <div key={`${ch.chair_id}-${t}`} onClick={() => st !== "free" && onSlotClick?.(sl, ch, t)}
                  className={cn("border border-white/[0.06] p-1 min-h-[30px] flex flex-col justify-center",
                    st !== "free" && "cursor-pointer hover:brightness-125",
                    st === "booked" && "border-nova-gold/15 bg-nova-gold/[0.06]",
                    st === "completed" && "border-green-500/15 bg-green-500/[0.05]",
                    st === "attended" && "border-amber-400/15 bg-amber-400/[0.05]")}>
                  {st !== "free" && (<>
                    <div className={cn("text-[10px] font-semibold", st === "booked" ? "text-nova-gold" : st === "completed" ? "text-green-400" : "text-amber-300")}>{sl.service_name}</div>
                    <div className="text-[8px] text-nova-offwhite/25">{sl.client_initials}</div>
                  </>)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SlotDetailModal({ slot, chair, time, onClose }) {
  if (!slot) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-nova border border-white/15 bg-nova-bg-matte p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Detalle de reserva</h3>
          <button onClick={onClose} className="text-nova-offwhite/40 hover:text-nova-offwhite">✕</button>
        </div>
        <div className="space-y-2 font-sans text-sm">
          <Row label="Hora" value={time} />
          <Row label="Silla" value={`${chair?.chair_label} — ${chair?.barber_name || "—"}`} />
          <Row label="Servicio" value={slot.service_name} />
          <Row label="Cliente" value={slot.client_name || slot.client_initials} />
          {slot.client_phone && <Row label="Teléfono" value={slot.client_phone} />}
          <Row label="Estado" value={slot.status === "booked" ? "Agendada" : slot.status === "attended" ? "Atendida" : slot.status === "completed" ? "Completada" : slot.status} />
          {slot.payment_method && <Row label="Pago" value={slot.payment_method} />}
          {slot.barber_amount && <Row label="Comisión barbero" value={COP(slot.barber_amount)} />}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-nova border border-white/15 py-2 text-xs text-nova-offwhite/60">Cerrar</button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-white/5">
      <span className="text-nova-offwhite/50">{label}</span>
      <span className="text-nova-offwhite font-medium">{value}</span>
    </div>
  );
}
