import { useState } from "react";
import {
  CalendarCheck,
  User2,
  Phone,
  Scissors,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createAppointment } from "@/lib/api";

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const formatLongDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/**
 * Paso 3 — Confirmación
 * -----------------------------------------------------------------------
 * Resume la selección de los pasos 1 y 2 y crea la cita.
 *
 * - Si `currentUser` viene definido (cliente logueado), se reserva a su
 *   nombre y NO se piden datos adicionales.
 * - Si no hay `currentUser`, se muestra el formulario de invitado
 *   (Nombre + WhatsApp), obligatorio para poder confirmar.
 */
export default function BookingStepConfirm({
  currentUser = null, // { id, full_name, phone } | null
  branchId,
  branchName,
  serviceId,
  serviceName,
  price,
  durationMinutes,
  chairId,
  chairLabel,
  barberId,
  barberName,
  date, // "YYYY-MM-DD"
  startTime, // "HH:MM"
  endTime, // "HH:MM"
  onBack,
  onGoToAvailability, // callback para volver al paso 2 si el slot ya no está libre
}) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // respuesta del backend

  const isGuest = !currentUser;
  const guestValid = guestName.trim().length >= 2 && guestPhone.trim().length >= 7;
  const canSubmit = isGuest ? guestValid : true;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    setConflict(false);
    try {
      const startIso = `${date}T${startTime}:00`;
      const result = await createAppointment({
        branchId,
        serviceId,
        chairId,
        barberId,
        startTime: startIso,
        guestName: isGuest ? guestName.trim() : undefined,
        guestPhone: isGuest ? guestPhone.trim() : undefined,
      });
      setConfirmed(result);
    } catch (err) {
      if (err.status === 409) {
        setConflict(true);
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Vista de éxito -----------------------------------------------
  if (confirmed) {
    return (
      <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center px-6 py-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-nova-gold-gradient">
            <CheckCircle2 className="h-8 w-8 text-nova-bg-deep" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-3xl font-bold">¡Cita confirmada!</h1>
          <p className="mt-2 font-sans text-sm text-nova-offwhite/60">
            Te esperamos en {confirmed.branch_name}. Código de reserva{" "}
            <span className="text-nova-gold-light">#{confirmed.id}</span>.
          </p>

          <Card className="mt-8 w-full space-y-3 border-white/10 bg-nova-bg-matte p-6 text-left font-sans text-sm">
            <SummaryRow icon={Scissors} label="Servicio" value={confirmed.service_name} />
            <SummaryRow
              icon={CalendarCheck}
              label="Fecha y hora"
              value={`${formatLongDate(date)} · ${confirmed.start_time.slice(11, 16)}`}
            />
            <SummaryRow icon={User2} label="Barbero" value={confirmed.barber_name ?? "—"} />
            <SummaryRow icon={MapPin} label="Sucursal" value={confirmed.branch_name} />
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-nova-offwhite/60">Total</span>
              <span className="font-display text-base font-semibold text-nova-gold-light">
                {formatCOP(confirmed.price)}
              </span>
            </div>
          </Card>

          <p className="mt-6 font-sans text-xs text-nova-offwhite/40">
            Enviamos la confirmación por WhatsApp a {confirmed.client_phone}.
          </p>
        </div>
      </div>
    );
  }

  // --- Vista de confirmación / formulario -----------------------------
  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="mx-auto w-full max-w-2xl px-6 py-14">
        <div className="mb-8 space-y-2">
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-nova-gold-light">
            Paso 3 de 3
          </span>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Confirma tu cita</h1>
          <p className="font-sans text-sm text-nova-offwhite/60">
            Revisa los detalles antes de reservar tu turno en NOVA.
          </p>
        </div>

        {/* Resumen de la reserva */}
        <Card className="mb-8 space-y-4 border-white/10 bg-nova-bg-matte p-6 font-sans text-sm">
          <SummaryRow icon={MapPin} label="Sucursal" value={branchName} />
          <SummaryRow icon={Scissors} label="Servicio" value={`${serviceName} · ${durationMinutes} min`} />
          <SummaryRow icon={CalendarCheck} label="Fecha" value={formatLongDate(date)} />
          <SummaryRow icon={Clock} label="Hora" value={`${startTime} – ${endTime}`} />
          <SummaryRow icon={User2} label="Barbero" value={`${barberName} (${chairLabel})`} />
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-nova-offwhite/60">Total a pagar en sucursal</span>
            <span className="font-display text-lg font-semibold text-nova-gold-light">
              {formatCOP(price)}
            </span>
          </div>
        </Card>

        {/* Identidad: cliente logueado vs invitado */}
        {isGuest ? (
          <section className="mb-8">
            <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/80">
              Tus datos
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="guest-name" className="font-sans text-xs text-nova-offwhite/60">
                  Nombre completo
                </Label>
                <div className="relative">
                  <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nova-offwhite/40" />
                  <Input
                    id="guest-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ej: Andrés Gómez"
                    className="h-11 rounded-nova border-white/15 bg-nova-bg-main pl-9 font-sans text-nova-offwhite placeholder:text-nova-offwhite/30 focus-visible:ring-nova-gold-light"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone" className="font-sans text-xs text-nova-offwhite/60">
                  WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nova-offwhite/40" />
                  <Input
                    id="guest-phone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Ej: +57 300 000 0000"
                    inputMode="tel"
                    className="h-11 rounded-nova border-white/15 bg-nova-bg-main pl-9 font-sans text-nova-offwhite placeholder:text-nova-offwhite/30 focus-visible:ring-nova-gold-light"
                  />
                </div>
              </div>
              <p className="font-sans text-xs text-nova-offwhite/40">
                Usamos tu WhatsApp solo para confirmar y recordarte la cita.
              </p>
            </div>
          </section>
        ) : (
          <Card className="mb-8 flex items-center gap-3 border-nova-gold/20 bg-nova-gold/5 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nova-gold/15 text-nova-gold-light">
              <User2 className="h-4 w-4" />
            </div>
            <p className="font-sans text-sm text-nova-offwhite/80">
              Reservando como{" "}
              <span className="text-nova-offwhite">{currentUser.full_name}</span> ·{" "}
              {currentUser.phone}
            </p>
          </Card>
        )}

        {/* Errores */}
        {conflict && (
          <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="font-sans text-sm text-amber-200">
              Ese horario ya no está disponible — probablemente otra persona lo tomó
              mientras confirmabas.{" "}
              <button
                onClick={onGoToAvailability}
                className="font-medium text-nova-gold-light underline underline-offset-2"
              >
                Elegir otra hora
              </button>
            </div>
          </Card>
        )}
        {error && (
          <Card className="mb-6 border-red-500/30 bg-red-500/5 p-4 font-sans text-sm text-red-300">
            {error}
          </Card>
        )}

        {/* Navegación */}
        <div className="flex gap-3 border-t border-white/10 pt-6">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={submitting}
            className="h-12 rounded-nova border-white/15 bg-transparent px-5 font-display text-sm font-semibold text-nova-offwhite hover:border-nova-gold/50 hover:bg-white/5"
          >
            Atrás
          </Button>
          <Button
            disabled={!canSubmit || submitting}
            onClick={handleConfirm}
            className={cn(
              "h-12 flex-1 gap-2 rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep",
              "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100"
            )}
          >
            {submitting ? "Confirmando…" : "Confirmar reserva"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-nova-gold" />
      <span className="w-24 shrink-0 text-nova-offwhite/50">{label}</span>
      <span className="text-nova-offwhite">{value}</span>
    </div>
  );
}
