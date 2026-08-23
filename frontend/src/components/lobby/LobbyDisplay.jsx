import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * LobbyDisplay — Pantalla para la entrada de la barbería
 * ========================================================
 * Rota automáticamente entre dos vistas:
 *   1. Galería de cortes (slideshow con fotos de los barberos)
 *   2. Calendario de disponibilidad (grilla sillas × horarios)
 *
 * Props:
 *   galleryPhotos: Array<{ id, image_url, caption, barber_name, service_name }>
 *   calendarData:  resultado de GET /branches/{id}/calendar
 *   branchName:    nombre de la sucursal
 *
 * Tiempos por defecto:
 *   - Cada foto de la galería: 5 segundos
 *   - Vista galería total: 40 segundos
 *   - Vista calendario: 20 segundos
 *   - Luego vuelve a galería y repite el ciclo
 *
 * Para usarlo en una TV/tablet:
 *   Abrir la URL /lobby/{branchId} a pantalla completa (F11)
 */

const PHOTO_INTERVAL = 5000;
const GALLERY_DURATION = 40000;
const CALENDAR_DURATION = 20000;

export default function LobbyDisplay({
  galleryPhotos = [],
  calendarData = null,
  branchName = "NOVA Barber Shop",
}) {
  const [mode, setMode] = useState("gallery"); // "gallery" | "calendar"
  const [photoIdx, setPhotoIdx] = useState(0);
  const [clock, setClock] = useState("");
  const modeTimer = useRef(null);
  const photoTimer = useRef(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) +
          " · " +
          now.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })
      );
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Photo rotation
  useEffect(() => {
    if (mode !== "gallery" || galleryPhotos.length === 0) return;
    photoTimer.current = setInterval(() => {
      setPhotoIdx((i) => (i + 1) % galleryPhotos.length);
    }, PHOTO_INTERVAL);
    return () => clearInterval(photoTimer.current);
  }, [mode, galleryPhotos.length]);

  // Mode rotation
  useEffect(() => {
    const duration = mode === "gallery" ? GALLERY_DURATION : CALENDAR_DURATION;
    modeTimer.current = setTimeout(() => {
      setMode((m) => (m === "gallery" ? "calendar" : "gallery"));
    }, duration);
    return () => clearTimeout(modeTimer.current);
  }, [mode]);

  const currentPhoto = galleryPhotos[photoIdx] || null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-nova-bg-deep text-nova-offwhite">
      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-nova-bg-deep/90 to-transparent px-6 py-4">
        <div className="font-display text-base font-bold tracking-wider">
          NOVA <span className="text-nova-gold-light">BARBER SHOP</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            EN VIVO
          </div>
          <span className="font-sans text-xs text-nova-offwhite/40">{clock}</span>
        </div>
      </div>

      {/* Gallery view */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          mode === "gallery" ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {galleryPhotos.map((photo, i) => (
          <img
            key={photo.id}
            src={photo.image_url}
            alt={photo.caption}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
              i === photoIdx ? "opacity-100" : "opacity-0"
            )}
          />
        ))}

        {/* Caption overlay */}
        {currentPhoto && (
          <div className="absolute inset-x-0 bottom-16 z-10 bg-gradient-to-t from-nova-bg-deep/85 to-transparent px-6 pb-4 pt-12">
            <h2 className="font-display text-xl font-bold">{currentPhoto.caption}</h2>
            <p className="mt-1 text-sm text-nova-offwhite/60">{currentPhoto.barber_name}</p>
            {currentPhoto.service_name && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-nova-gold/30 bg-nova-gold/15 px-3 py-1 text-xs text-nova-gold-light">
                ✂ {currentPhoto.service_name}
              </span>
            )}
          </div>
        )}

        {/* Photo counter */}
        <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2 font-display text-xs text-nova-offwhite/25 [writing-mode:vertical-lr]">
          {photoIdx + 1} / {galleryPhotos.length}
        </div>

        {/* Thumbnail strip */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex gap-1.5 overflow-x-auto bg-nova-bg-deep/95 px-6 py-2.5">
          {galleryPhotos.map((photo, i) => (
            <img
              key={photo.id}
              src={photo.image_url}
              alt={photo.caption}
              onClick={() => setPhotoIdx(i)}
              className={cn(
                "h-12 w-12 flex-none cursor-pointer rounded-lg object-cover transition-all",
                i === photoIdx
                  ? "border-2 border-nova-gold opacity-100"
                  : "border-2 border-transparent opacity-40 hover:opacity-70"
              )}
            />
          ))}
        </div>
      </div>

      {/* Calendar view */}
      <div
        className={cn(
          "absolute inset-0 overflow-y-auto pt-16 px-6 pb-8 transition-opacity duration-700",
          mode === "calendar" ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {calendarData && (
          <>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
              📅 Disponibilidad hoy — {branchName}
            </h2>

            <div className="mb-3 grid grid-cols-4 gap-2">
              {[
                { v: `${calendarData.occupancy_pct}%`, l: "Ocupación", c: calendarData.occupancy_pct > 70 ? "text-red-400" : calendarData.occupancy_pct > 40 ? "text-nova-gold-light" : "text-green-400" },
                { v: calendarData.booked_slots, l: "Reservados", c: "text-nova-gold-light" },
                { v: calendarData.free_slots, l: "Disponibles", c: "text-green-400" },
                { v: calendarData.chairs?.length || 0, l: "Sillas", c: "text-nova-offwhite" },
              ].map(({ v, l, c }) => (
                <div key={l} className="rounded-lg border border-white/10 bg-nova-bg-matte px-3 py-2.5 text-center">
                  <div className={cn("font-display text-lg font-semibold", c)}>{v}</div>
                  <div className="text-[10px] text-nova-offwhite/40">{l}</div>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="overflow-x-auto rounded-nova border border-white/10">
              <div
                className="grid text-[10px]"
                style={{
                  gridTemplateColumns: `46px ${"1fr ".repeat(calendarData.chairs?.length || 0)}`,
                }}
              >
                <div className="border-b border-r border-white/10 bg-nova-bg-matte p-1.5 text-center text-xs font-semibold">
                  Hora
                </div>
                {calendarData.chairs?.map((ch) => (
                  <div key={ch.chair_id} className="border-b border-white/10 bg-nova-bg-matte p-1.5 text-center">
                    <div className="text-xs font-semibold">{ch.chair_label}</div>
                    <div className="text-[9px] text-nova-offwhite/35">{ch.barber_name?.split(" ")[0]}</div>
                  </div>
                ))}

                {calendarData.time_labels?.map((t, ti) => (
                  <>
                    <div key={`t-${t}`} className="flex items-center border-r border-white/10 px-1 text-nova-offwhite/35">
                      {t}
                    </div>
                    {calendarData.chairs?.map((ch) => {
                      const slot = ch.slots?.[ti];
                      const st = slot?.status || "free";
                      return (
                        <div
                          key={`${ch.chair_id}-${t}`}
                          className={cn(
                            "border border-white/[0.06] p-0.5",
                            st === "booked" && "border-nova-gold/15 bg-nova-gold/[0.06]",
                            st === "completed" && "border-green-500/15 bg-green-500/[0.05]"
                          )}
                        >
                          {st !== "free" && (
                            <>
                              <div className={cn("text-[9px] font-semibold", st === "booked" ? "text-nova-gold" : "text-green-400")}>
                                {slot.service_name}
                              </div>
                              <div className="text-[8px] text-nova-offwhite/25">{slot.client_initials}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-nova-offwhite/25">
              Reserva en línea · novabarbershop.com
            </p>
          </>
        )}
      </div>

      {/* Mode pills */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {["gallery", "calendar"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "h-2 rounded-full transition-all",
              mode === m ? "w-6 bg-nova-gold-light" : "w-2 bg-nova-offwhite/25"
            )}
          />
        ))}
      </div>
    </div>
  );
}
