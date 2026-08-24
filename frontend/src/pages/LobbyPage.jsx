import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const PHOTO_INTERVAL = 6000;
const GALLERY_DURATION = 45000;
const CALENDAR_DURATION = 20000;
const REFRESH_INTERVAL = 60000;

const PLACEHOLDERS = [
  { id: "p1", image_url: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900", caption: "Degradado clásico", barber_name: "Nova Barber", service_name: "Corte" },
  { id: "p2", image_url: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900", caption: "Fade con diseño", barber_name: "Nova Barber", service_name: "Corte + Barba" },
  { id: "p3", image_url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900", caption: "Texturizado premium", barber_name: "Nova Barber", service_name: "Corte" },
  { id: "p4", image_url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900", caption: "Corte ejecutivo", barber_name: "Nova Barber", service_name: "Corte + Barba" },
  { id: "p5", image_url: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900", caption: "Skin fade moderno", barber_name: "Nova Barber", service_name: "Corte" },
];

export default function LobbyPage() {
  const [mode, setMode] = useState("gallery");
  const [photoIdx, setPhotoIdx] = useState(0);
  const [gallery, setGallery] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [branchName, setBranchName] = useState("NOVA Barber Shop");
  const [clock, setClock] = useState("");
  const [hoursWindow, setHoursWindow] = useState(2);
  const [showConfig, setShowConfig] = useState(false);

  const modeRef = useRef(null);
  const photoRef = useRef(null);

  // Photos to display (real gallery or placeholders)
  const displayPhotos = gallery.length > 0 ? gallery : PLACEHOLDERS;
  const totalPhotos = displayPhotos.length;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const br = await fetch(`${API}/branches`).then(r => r.json()).catch(() => []);
      if (br.length > 0) {
        setBranchName(br[0].name);
        const today = new Date().toISOString().slice(0, 10);
        const [gal, cal] = await Promise.all([
          fetch(`${API}/gallery?branch_id=${br[0].id}&limit=20`).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`${API}/branches/${br[0].id}/calendar?date=${today}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        setGallery(gal);
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
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Photo rotation — uses totalPhotos which includes placeholders
  useEffect(() => {
    if (mode !== "gallery" || totalPhotos === 0) return;
    clearInterval(photoRef.current);
    photoRef.current = setInterval(() => {
      setPhotoIdx(prev => (prev + 1) % totalPhotos);
    }, PHOTO_INTERVAL);
    return () => clearInterval(photoRef.current);
  }, [mode, totalPhotos]);

  // Mode rotation
  useEffect(() => {
    clearTimeout(modeRef.current);
    const dur = mode === "gallery" ? GALLERY_DURATION : CALENDAR_DURATION;
    modeRef.current = setTimeout(() => {
      setMode(m => m === "gallery" ? "calendar" : "gallery");
      setPhotoIdx(0);
    }, dur);
    return () => clearTimeout(modeRef.current);
  }, [mode]);

  // Filter calendar slots to only show next N hours
  const filterSlots = (cal) => {
    if (!cal || !cal.time_labels || !cal.chairs) return cal;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = currentMinutes + hoursWindow * 60;

    const filteredIndices = [];
    const filteredLabels = [];
    cal.time_labels.forEach((t, i) => {
      const [h, m] = t.split(":").map(Number);
      const slotMin = h * 60 + m;
      if (slotMin >= currentMinutes - 30 && slotMin < endMinutes) {
        filteredIndices.push(i);
        filteredLabels.push(t);
      }
    });

    if (filteredLabels.length === 0) return null;

    const filteredChairs = cal.chairs.map(ch => ({
      ...ch,
      slots: filteredIndices.map(i => ch.slots[i]).filter(Boolean),
    }));

    const totalSlots = filteredLabels.length * filteredChairs.length;
    const bookedSlots = filteredChairs.reduce((s, ch) => s + ch.slots.filter(sl => sl.status !== "free").length, 0);

    return {
      ...cal,
      time_labels: filteredLabels,
      chairs: filteredChairs,
      total_slots: totalSlots,
      booked_slots: bookedSlots,
      free_slots: totalSlots - bookedSlots,
      occupancy_pct: totalSlots > 0 ? Math.round(bookedSlots / totalSlots * 100) : 0,
    };
  };

  const filteredCal = filterSlots(calendar);
  const safeIdx = totalPhotos > 0 ? photoIdx % totalPhotos : 0;
  const currentPhoto = displayPhotos[safeIdx];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-nova-bg-deep text-nova-offwhite select-none">
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
          {/* Config button */}
          <button onClick={() => setShowConfig(!showConfig)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/40 hover:border-nova-gold/40 hover:text-nova-gold-light text-xs">⚙</button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="absolute right-4 top-16 z-30 rounded-nova border border-white/15 bg-nova-bg-matte p-4 shadow-lg">
          <div className="mb-2 font-sans text-xs font-medium text-nova-offwhite/60">Mostrar próximas horas</div>
          <div className="flex gap-2">
            {[2, 4, 6, 8].map(h => (
              <button key={h} onClick={() => { setHoursWindow(h); setShowConfig(false); }}
                className={cn("rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors",
                  hoursWindow === h ? "border-nova-gold bg-nova-gold/15 text-nova-gold-light" : "border-white/15 text-nova-offwhite/50")}>
                {h}h
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== GALLERY VIEW ===== */}
      <div className={cn("absolute inset-0 transition-opacity duration-700", mode === "gallery" ? "opacity-100" : "opacity-0 pointer-events-none")}>
        {/* All photos stacked, only one visible */}
        {displayPhotos.map((p, i) => (
          <img key={p.id} src={p.image_url} alt={p.caption || ""}
            className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000", i === safeIdx ? "opacity-100" : "opacity-0")}
            loading="lazy" />
        ))}

        {/* Caption overlay */}
        <div className="absolute inset-x-0 bottom-16 z-10 bg-gradient-to-t from-nova-bg-deep/85 to-transparent px-6 pb-4 pt-16">
          <h2 className="font-display text-2xl font-bold">{currentPhoto?.caption || branchName}</h2>
          {currentPhoto?.barber_name && <p className="mt-1 text-sm text-nova-offwhite/60">{currentPhoto.barber_name}</p>}
          {currentPhoto?.service_name && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-nova-gold/30 bg-nova-gold/15 px-3 py-1 text-xs text-nova-gold-light">✂ {currentPhoto.service_name}</span>
          )}
        </div>

        {/* Counter */}
        <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2 font-display text-xs text-nova-offwhite/20 [writing-mode:vertical-lr]">
          {safeIdx + 1} / {totalPhotos}
        </div>

        {/* Thumbnail strip */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex gap-1.5 overflow-x-auto bg-nova-bg-deep/95 px-6 py-2.5">
          {displayPhotos.map((p, i) => (
            <img key={p.id} src={p.image_url} alt=""
              className={cn("h-12 w-12 flex-none rounded-lg object-cover transition-all",
                i === safeIdx ? "border-2 border-nova-gold opacity-100" : "border-2 border-transparent opacity-40")} />
          ))}
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-[72px] left-1/2 z-10 flex -translate-x-1/2 gap-1">
          {displayPhotos.map((_, i) => (
            <div key={i} className={cn("h-1 rounded-full transition-all duration-300", i === safeIdx ? "w-4 bg-nova-gold-light" : "w-1 bg-nova-offwhite/20")} />
          ))}
        </div>
      </div>

      {/* ===== CALENDAR VIEW ===== */}
      <div className={cn("absolute inset-0 overflow-y-auto px-6 pb-8 pt-16 transition-opacity duration-700", mode === "calendar" ? "opacity-100" : "opacity-0 pointer-events-none")}>
        {filteredCal ? (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">📅 Disponibilidad — {branchName}</h2>
              <span className="rounded-full border border-white/10 bg-nova-bg-matte px-2.5 py-1 font-sans text-[11px] text-nova-offwhite/50">Próximas {hoursWindow}h</span>
            </div>
            <div className="mb-3 font-sans text-xs text-nova-offwhite/40">Actualizado en vivo · {clock}</div>

            <div className="mb-3 grid grid-cols-4 gap-2">
              {[
                { v: `${filteredCal.occupancy_pct}%`, l: "Ocupación", c: filteredCal.occupancy_pct > 70 ? "text-red-400" : filteredCal.occupancy_pct > 40 ? "text-nova-gold-light" : "text-green-400" },
                { v: filteredCal.booked_slots, l: "Reservados", c: "text-nova-gold-light" },
                { v: filteredCal.free_slots, l: "Disponibles", c: "text-green-400" },
                { v: filteredCal.chairs?.length || 0, l: "Sillas", c: "" },
              ].map(({ v, l, c }) => (
                <div key={l} className="rounded-lg border border-white/10 bg-nova-bg-matte px-3 py-2 text-center">
                  <div className={cn("font-display text-lg font-semibold", c)}>{v}</div>
                  <div className="text-[10px] text-nova-offwhite/40">{l}</div>
                </div>
              ))}
            </div>

            <div className="mb-3 flex h-1.5 overflow-hidden rounded-full">
              <div className={cn("transition-all", filteredCal.occupancy_pct > 70 ? "bg-red-400" : filteredCal.occupancy_pct > 40 ? "bg-nova-gold" : "bg-green-400")} style={{ width: `${filteredCal.occupancy_pct}%` }} />
              <div className="flex-1 bg-white/5" />
            </div>

            <div className="mb-3 flex gap-3 text-[10px] text-nova-offwhite/40">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded border border-white/15" /> Libre</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-nova-gold/25" /> Reservado</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-green-400/25" /> Completado</span>
            </div>

            <div className="overflow-x-auto rounded-nova border border-white/10">
              <div className="grid text-[11px]" style={{ gridTemplateColumns: `48px ${"1fr ".repeat(filteredCal.chairs?.length || 0)}` }}>
                <div className="border-b border-r border-white/10 bg-nova-bg-matte p-2 text-center text-xs font-semibold">Hora</div>
                {filteredCal.chairs?.map(ch => (
                  <div key={ch.chair_id} className="border-b border-white/10 bg-nova-bg-matte p-2 text-center">
                    <div className="text-xs font-semibold">{ch.chair_label}</div>
                    <div className="text-[9px] text-nova-offwhite/35">{ch.barber_name?.split(" ")[0] || "—"}</div>
                  </div>
                ))}
                {filteredCal.time_labels?.map((t, ti) => (
                  <div key={t} className="contents">
                    <div className="flex items-center border-r border-white/10 px-1 text-nova-offwhite/35 font-mono">{t}</div>
                    {filteredCal.chairs?.map(ch => {
                      const slot = ch.slots?.[ti];
                      const st = slot?.status || "free";
                      return (
                        <div key={`${ch.chair_id}-${t}`} className={cn("border border-white/[0.06] p-1 min-h-[32px] flex flex-col justify-center",
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
            <p className="mt-4 text-center text-xs text-nova-offwhite/25">Reserva en línea · nova-barber-shop.vercel.app</p>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 text-3xl">📅</div>
              <div className="font-sans text-sm text-nova-offwhite/40">Sin franjas disponibles en las próximas {hoursWindow} horas</div>
            </div>
          </div>
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
