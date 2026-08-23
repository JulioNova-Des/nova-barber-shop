import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, User2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAvailability } from "@/lib/api";

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_VISIBLE = 7;

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function buildDateStrip(startOffset = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: DAYS_VISIBLE }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + startOffset + i);
    return d;
  });
}

/**
 * Paso 2 — Fecha + Hora
 * -----------------------------------------------------------------------
 * Consume GET /availability?branch_id&service_id&date(&barber_id) y
 * pinta la grilla de franjas de 30 min. Si el cliente no fija un
 * barbero, el sistema asigna automáticamente el primer barbero/silla
 * libre para la franja elegida (visible como confirmación).
 */
export default function BookingStepDateTime({
  branchId,
  serviceId,
  preferredBarberId = null,
  onBack,
  onContinue,
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dateStrip = useMemo(() => buildDateStrip(weekOffset * DAYS_VISIBLE), [weekOffset]);

  const [selectedDate, setSelectedDate] = useState(() => toISODate(dateStrip[0]));
  const [barberFilter, setBarberFilter] = useState(preferredBarberId);
  const [selectedSlot, setSelectedSlot] = useState(null); // {start_time, barber}

  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedSlot(null);

    getAvailability({
      branchId,
      serviceId,
      date: selectedDate,
      barberId: barberFilter,
    })
      .then((data) => !cancelled && setAvailability(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [branchId, serviceId, selectedDate, barberFilter]);

  // Barberos distintos vistos en la disponibilidad del día, para el filtro.
  const barbersOfDay = useMemo(() => {
    if (!availability) return [];
    const map = new Map();
    for (const slot of availability.slots) {
      for (const b of slot.available_barbers) {
        map.set(b.barber_id, b.barber_name);
      }
    }
    return Array.from(map, ([barber_id, barber_name]) => ({ barber_id, barber_name }));
  }, [availability]);

  const handlePickSlot = (slot) => {
    if (!slot.available) return;
    // Si ya hay un barbero filtrado, se usa ese; si no, se autoasigna
    // el primero disponible para esa franja.
    const assigned =
      slot.available_barbers.find((b) => b.barber_id === barberFilter) ??
      slot.available_barbers[0];
    setSelectedSlot({ ...slot, assigned });
  };

  const canContinue = Boolean(selectedSlot);

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="mx-auto w-full max-w-2xl px-6 py-14">
        {/* Encabezado */}
        <div className="mb-8 space-y-2">
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-nova-gold-light">
            Paso 2 de 3
          </span>
          <h1 className="font-display text-3xl font-bold text-nova-offwhite sm:text-4xl">
            Elige fecha y hora
          </h1>
          <p className="font-sans text-sm text-nova-offwhite/60">
            Franjas de 30 minutos según disponibilidad real de sillas y barberos.
          </p>
        </div>

        {/* Filtro de barbero */}
        {barbersOfDay.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/80">
              <User2 className="h-4 w-4 text-nova-gold" />
              Barbero
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBarberFilter(null)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 font-sans text-xs font-medium transition-colors",
                  barberFilter === null
                    ? "border-nova-gold bg-nova-gold/15 text-nova-gold-light"
                    : "border-white/15 text-nova-offwhite/60 hover:border-white/30"
                )}
              >
                Cualquiera
              </button>
              {barbersOfDay.map((b) => (
                <button
                  key={b.barber_id}
                  onClick={() => setBarberFilter(b.barber_id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 font-sans text-xs font-medium transition-colors",
                    barberFilter === b.barber_id
                      ? "border-nova-gold bg-nova-gold/15 text-nova-gold-light"
                      : "border-white/15 text-nova-offwhite/60 hover:border-white/30"
                  )}
                >
                  {b.barber_name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Selector de fecha */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/80">
            <Calendar className="h-4 w-4 text-nova-gold" />
            Fecha
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 transition-colors hover:border-nova-gold/50 hover:text-nova-offwhite disabled:opacity-20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="grid flex-1 grid-cols-7 gap-1.5">
              {dateStrip.map((d) => {
                const iso = toISODate(d);
                const active = iso === selectedDate;
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-nova border py-2.5 transition-all",
                      active
                        ? "border-nova-gold bg-nova-gold/10 shadow-nova-gold"
                        : "border-white/10 bg-nova-bg-matte hover:border-nova-gold/40"
                    )}
                  >
                    <span className="font-sans text-[10px] uppercase tracking-wide text-nova-offwhite/50">
                      {WEEKDAY_LABEL[d.getDay()]}
                    </span>
                    <span
                      className={cn(
                        "font-display text-sm font-semibold",
                        active ? "text-nova-gold-light" : "text-nova-offwhite"
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 transition-colors hover:border-nova-gold/50 hover:text-nova-offwhite"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Grilla de horarios */}
        <section className="mb-12">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/80">
            <Clock className="h-4 w-4 text-nova-gold" />
            Hora disponible
          </h2>

          {loading && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-nova border border-white/10 bg-nova-bg-matte"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <Card className="border-red-500/30 bg-red-500/5 p-4 font-sans text-sm text-red-300">
              {error}
            </Card>
          )}

          {!loading && !error && availability && (
            <>
              {availability.slots.length === 0 ? (
                <Card className="border-white/10 bg-nova-bg-matte p-6 text-center font-sans text-sm text-nova-offwhite/60">
                  No hay barberos ni sillas configurados para esta sucursal.
                </Card>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {availability.slots.map((slot) => {
                    const active = selectedSlot?.start_time === slot.start_time;
                    return (
                      <button
                        key={slot.start_time}
                        disabled={!slot.available}
                        onClick={() => handlePickSlot(slot)}
                        className={cn(
                          "rounded-nova border py-2.5 font-sans text-sm font-medium transition-all",
                          !slot.available &&
                            "cursor-not-allowed border-white/5 text-nova-offwhite/20 line-through",
                          slot.available &&
                            !active &&
                            "border-white/10 bg-nova-bg-matte text-nova-offwhite/80 hover:border-nova-gold/50",
                          active &&
                            "border-nova-gold bg-nova-gold-gradient text-nova-bg-deep shadow-nova-gold"
                        )}
                      >
                        {slot.start_time}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Resumen + navegación */}
        <div className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-sans text-sm text-nova-offwhite/60">
            {selectedSlot ? (
              <span>
                <span className="text-nova-offwhite">
                  {selectedSlot.start_time} – {selectedSlot.end_time}
                </span>{" "}
                con{" "}
                <span className="text-nova-gold-light">
                  {selectedSlot.assigned?.barber_name}
                </span>{" "}
                ({selectedSlot.assigned?.chair_label})
              </span>
            ) : (
              "Selecciona una hora disponible para continuar."
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-12 rounded-nova border-white/15 bg-transparent px-5 font-display text-sm font-semibold text-nova-offwhite hover:border-nova-gold/50 hover:bg-white/5"
            >
              Atrás
            </Button>
            <Button
              disabled={!canContinue}
              onClick={() =>
                onContinue?.({
                  date: selectedDate,
                  startTime: selectedSlot.start_time,
                  endTime: selectedSlot.end_time,
                  barberId: selectedSlot.assigned?.barber_id,
                  chairId: selectedSlot.assigned?.chair_id,
                })
              }
              className={cn(
                "h-12 gap-2 rounded-nova bg-nova-gold-gradient px-6 font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep",
                "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100"
              )}
            >
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
