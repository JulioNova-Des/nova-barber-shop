import { useMemo, useState } from "react";
import { MapPin, Scissors, Clock, ChevronRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Paso 1 — Sucursal + Servicio
 * -----------------------------------------------------------------------
 * Primer paso del flujo público de reserva (invitado o cliente). El
 * cruce sucursal + servicio determina qué disponibilidad se consulta
 * en el paso siguiente (sillas / barberos / franjas de 30 min).
 *
 * `branches` y `services` normalmente vienen de:
 *   GET /branches?is_active=true
 *   GET /services?is_active=true
 */
export default function BookingStepBranchService({
  branches = [],
  services = [],
  onContinue,
}) {
  const [branchId, setBranchId] = useState(null);
  const [serviceId, setServiceId] = useState(null);

  const canContinue = branchId && serviceId;

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId]
  );

  const formatCOP = (value) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="min-h-screen bg-nova-bg-main text-nova-offwhite">
      <div className="mx-auto w-full max-w-2xl px-6 py-14">
        {/* Encabezado */}
        <div className="mb-10 space-y-2">
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-nova-gold-light">
            Paso 1 de 3
          </span>
          <h1 className="font-display text-3xl font-bold text-nova-offwhite sm:text-4xl">
            Reserva tu cita
          </h1>
          <p className="font-sans text-sm text-nova-offwhite/60">
            Elige tu sucursal NOVA y el servicio que deseas agendar.
          </p>
        </div>

        {/* Sucursal */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/80">
            <MapPin className="h-4 w-4 text-nova-gold" />
            Sucursal
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {branches.map((branch) => {
              const active = branch.id === branchId;
              return (
                <Card
                  key={branch.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setBranchId(branch.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && setBranchId(branch.id)
                  }
                  className={cn(
                    "cursor-pointer border bg-nova-bg-matte p-4 transition-all duration-200",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-nova-gold-light",
                    active
                      ? "border-nova-gold shadow-nova-gold"
                      : "border-white/10 hover:border-nova-gold/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-base font-semibold text-nova-offwhite">
                        {branch.name}
                      </p>
                      <p className="mt-0.5 font-sans text-xs text-nova-offwhite/50">
                        {branch.address} — {branch.city}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        active
                          ? "border-nova-gold bg-nova-gold text-nova-bg-deep"
                          : "border-white/20"
                      )}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Servicio */}
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-nova-offwhite/80">
            <Scissors className="h-4 w-4 text-nova-gold" />
            Servicio
          </h2>

          <div className="flex flex-col divide-y divide-white/10 overflow-hidden rounded-nova border border-white/10 bg-nova-bg-matte">
            {services.map((service) => {
              const active = service.id === serviceId;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setServiceId(service.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors",
                    "focus:outline-none focus-visible:bg-white/5",
                    active ? "bg-nova-gold/10" : "hover:bg-white/[0.03]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        active
                          ? "border-nova-gold bg-nova-gold text-nova-bg-deep"
                          : "border-white/20"
                      )}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="font-display text-sm font-semibold text-nova-offwhite">
                        {service.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 font-sans text-xs text-nova-offwhite/50">
                        <Clock className="h-3 w-3" />
                        {service.duration_minutes} min
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="shrink-0 border-nova-champagne/40 bg-transparent font-sans text-sm font-medium text-nova-champagne"
                  >
                    {formatCOP(service.price)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </section>

        {/* Resumen + CTA */}
        <div className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-sans text-sm text-nova-offwhite/60">
            {selectedService ? (
              <span>
                Seleccionaste{" "}
                <span className="text-nova-offwhite">{selectedService.name}</span>{" "}
                ·{" "}
                <span className="text-nova-gold-light">
                  {formatCOP(selectedService.price)}
                </span>
              </span>
            ) : (
              "Selecciona sucursal y servicio para continuar."
            )}
          </div>

          <Button
            disabled={!canContinue}
            onClick={() => onContinue?.({ branchId, serviceId })}
            className={cn(
              "group h-12 gap-2 rounded-nova bg-nova-gold-gradient px-6 font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep",
              "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100"
            )}
          >
            Continuar
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
