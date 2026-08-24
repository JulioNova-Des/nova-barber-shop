import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

const PHOTO_INTERVAL = 6000;
const GALLERY_DURATION = 45000;
const CALENDAR_DURATION = 20000;
const REFRESH_INTERVAL = 60000;

export default function LobbyPage() {
  const [mode, setMode] = useState("gallery");
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [branches, setBranches] = useState([]);
  const [clock, setClock] = useState("");
  const modeTimer = useRef(null);
  const photoTimer = useRef(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const br = await fetch(`${API}/branches`).then(r => r.json());
      setBranches(br);
      if (br.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const [gal, cal] = await Promise.all([
          fetch(`${API}/gallery?branch_id=${br[0].id}&limit=20`).then(r => r.ok ? r.json() : []),
          fetch(`${API}/branches/${br[0].id}/calendar?date=${today}`).then(r => r.ok ? r.json() : null),
        ]);
        setPhotos(gal);
        setCalendar(cal);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const id = setInterval(fetchData, REFRESH_INTERVAL); return () => clearInterval(id); }, [fetchData]);

  // Clock
  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) + " · " +
      new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
    );
    tick(); const id = setInterval(tick, 10000); return () => clearInterval(id);
  }, []);

  // Photo rotation
  useEffect(() => {
    if (mode !== "gallery" || photos.length === 0) return;
    photoTimer.current = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), PHOTO_INTERVAL);
    return () => clearInterval(photoTimer.current);
  }, [mode, photos.length]);

  // Mode rotation
  useEffect(() => {
    const dur = mode === "gallery" ? GALLERY_DURATION : CALENDAR_DURATION;
    modeTimer.current = setTimeout(() => setMode(m => m === "gallery" ? "calendar" : "gallery"), dur);
    return () => clearTimeout(modeTimer.current);
  }, [mode]);

  const currentPhoto = photos[photoIdx] || null;
  const branchName = branches[0]?.name || "NOVA Barber Shop";

  // Placeholder images if gallery is empty
  const placeholders = [
    "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900",
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900",
    "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900",
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900",
    "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900",
  ];
  const displayPhotos = photos.length > 0 ? photos : placeholders.map((url, i) => ({ id: i, image_url: url, caption: "Nova Barber Shop", barber_name: "", service_name: "" }));
  const displayPhoto = displayPhotos[photoIdx % displayPhotos.length];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-nova-bg-deep text-nova-offwhite">
      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-nova-bg-deep/90 to-transparent px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/logo-nova.jpg" alt="NOVA" className="h-10 w-10 rounded-full border border-nova-gold/30 object-cover" />
          <div className="font-display text-base font-bold tracking-wider">NOVA <span className="text-nova-gold-light">BARBER SHOP</span></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" /> EN VIVO
          </div>
          <span className="font-sans text-xs text-nova-offwhite/40">{clock}</span>
        </div>
      </div>

      {/* Gallery */}
      <div className={cn("absolute inset-0 transition-opacity duration-700", mode === "gallery" ? "opacity-100" : "opacity-0 pointer-events-none")}>
        {displayPhotos.map((p, i) => (
          <img key={p.id} src={p.image_url} alt={p.caption || ""} className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000", i === (photoIdx % displayPhotos.length) ? "opacity-100" : "opacity-0")} loading="lazy" />
        ))}
        {displayPhoto && (
          <div className="absolute inset-x-0 bottom-16 z-10 bg-gradient-to-t from-nova-bg-deep/85 to-transparent px-6 pb-4 pt-16">
            <h2 className="font-display text-2xl font-bold">{displayPhoto.caption || branchName}</h2>
            {displayPhoto.barber_name && <p className="mt-1 text-sm text-nova-offwhite/60">{displayPhoto.barber_name}</p>}
            {displayPhoto.service_name && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-nova-gold/30 bg-nova-gold/15 px-3 py-1 text-xs text-nova-gold-light">✂ {displayPhoto.service_name}</span>
            )}
          </div>
        )}
        <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2 font-display text-xs text-nova-offwhite/20 [writing-mode:vertical-lr]">
          {(photoIdx % displayPhotos.length) + 1} / {displayPhotos.length}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 flex gap-1.5 overflow-x-auto bg-nova-bg-deep/95 px-6 py-2.5">
          {displayPhotos.map((p, i) => (
            <img key={p.id} src={p.image_url} alt="" onClick={() => setPhotoIdx(i)}
              className={cn("h-12 w-12 flex-none cursor-pointer rounded-lg object-cover transition-all",
                i === (photoIdx % displayPhotos.length) ? "border-2 border-nova-gold opacity-100" : "border-2 border-transparent opacity-40")} />
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className={cn("absolute inset-0 overflow-y-auto px-6 pb-8 pt-16 transition-opacity duration-700", mode === "calendar" ? "opacity-100" : "opacity-0 pointer-events-none")}>
        {calendar && (
          <>
            <h2 className="mb-3 font-display text-base font-semibold">📅 Disponibilidad hoy — {branchName}</h2>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[
                { v: `${calendar.occupancy_pct}%`, l: "Ocupación", c: calendar.occupancy_pct > 70 ? "text-red-400" : calendar.occupancy_pct > 40 ? "text-nova-gold-light" : "text-green-400" },
                { v: calendar.booked_slots, l: "Reservados", c: "text-nova-gold-light" },
                { v: calendar.free_slots, l: "Disponibles", c: "text-green-400" },
                { v: calendar.chairs?.length || 0, l: "Sillas", c: "" },
              ].map(({ v, l, c }) => (
                <div key={l} className="rounded-lg border border-white/10 bg-nova-bg-matte px-3 py-2 text-center">
                  <div className={cn("font-display text-lg font-semibold", c)}>{v}</div>
                  <div className="text-[10px] text-nova-offwhite/40">{l}</div>
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
            </div>
            <div className="overflow-x-auto rounded-nova border border-white/10">
              <div className="grid text-[10px]" style={{ gridTemplateColumns: `48px ${"1fr ".repeat(calendar.chairs?.length || 0)}` }}>
                <div className="border-b border-r border-white/10 bg-nova-bg-matte p-1.5 text-center text-xs font-semibold">Hora</div>
                {calendar.chairs?.map(ch => (
                  <div key={ch.chair_id} className="border-b border-white/10 bg-nova-bg-matte p-1.5 text-center">
                    <div className="text-xs font-semibold">{ch.chair_label}</div>
                    <div className="text-[9px] text-nova-offwhite/35">{ch.barber_name?.split(" ")[0] || "—"}</div>
                  </div>
                ))}
                {calendar.time_labels?.map((t, ti) => (
                  <div key={t} className="contents">
                    <div className="flex items-center border-r border-white/10 px-1 text-nova-offwhite/35">{t}</div>
                    {calendar.chairs?.map(ch => {
                      const slot = ch.slots?.[ti];
                      const st = slot?.status || "free";
                      return (
                        <div key={`${ch.chair_id}-${t}`} className={cn("border border-white/[0.06] p-0.5",
                          st === "booked" && "border-nova-gold/15 bg-nova-gold/[0.06]",
                          st === "completed" && "border-green-500/15 bg-green-500/[0.05]")}>
                          {st !== "free" && (<>
                            <div className={cn("text-[9px] font-semibold", st === "booked" ? "text-nova-gold" : "text-green-400")}>{slot.service_name}</div>
                            <div className="text-[8px] text-nova-offwhite/25">{slot.client_initials}</div>
                          </>)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-nova-offwhite/25">Reserva en línea · novabarbershop.com</p>
          </>
        )}
      </div>

      {/* Mode pills */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {["gallery", "calendar"].map(m => (
          <button key={m} onClick={() => setMode(m)} className={cn("h-2 rounded-full transition-all", mode === m ? "w-6 bg-nova-gold-light" : "w-2 bg-nova-offwhite/25")} />
        ))}
      </div>
    </div>
  );
}
