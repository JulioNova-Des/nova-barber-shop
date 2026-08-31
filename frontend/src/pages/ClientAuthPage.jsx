import { useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ClientAuthPage({ onLogin, onGuest }) {
  const [mode, setMode] = useState("choice"); // choice | login | register | recovery
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recoveryDone, setRecoveryDone] = useState(false);

  const F = (field, value) => setForm({ ...form, [field]: value });

  const handleLogin = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier, password: form.password }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Credenciales inválidas"); }
      const data = await res.json();
      localStorage.setItem("nova_token", data.access_token);
      localStorage.setItem("nova_user", JSON.stringify(data.user));
      onLogin(data.user, data.access_token);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!form.full_name?.trim() || !form.phone?.trim() || !form.password?.trim()) { setError("Todos los campos son obligatorios."); return; }
    if (form.password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email?.trim() || null,
          password: form.password,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Error al registrar"); }
      const data = await res.json();
      localStorage.setItem("nova_token", data.access_token);
      localStorage.setItem("nova_user", JSON.stringify(data.user));
      onLogin(data.user, data.access_token);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const InputField = ({ label, value, onChange, type = "text", placeholder = "", icon = null, ...props }) => (
    <div className="mb-4">
      <label className="mb-1 block font-sans text-xs text-nova-offwhite/60">{label}</label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nova-offwhite/40">{icon}</span>}
        <input type={type} placeholder={placeholder} value={value || ""}
          onChange={e => onChange(e.target.value)}
          className={cn("h-11 w-full rounded-nova border border-white/15 bg-nova-bg-main font-sans text-nova-offwhite placeholder:text-nova-offwhite/30 focus:outline-none focus:ring-2 focus:ring-nova-gold-light", icon ? "pl-9 pr-4" : "px-4")}
          {...props} />
      </div>
    </div>
  );

  // ===== CHOICE =====
  if (mode === "choice") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm text-center">
          <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-20 w-20 rounded-full border border-nova-gold/30 object-cover" />
          <h1 className="font-display text-xl font-bold text-nova-offwhite">¿Cómo deseas reservar?</h1>
          <p className="mt-1 mb-6 font-sans text-sm text-nova-offwhite/50">Elige una opción para continuar</p>

          <button onClick={() => setMode("login")}
            className="mb-3 flex w-full items-center gap-3 rounded-nova border border-nova-gold/30 bg-nova-gold/5 p-4 text-left transition-colors hover:bg-nova-gold/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nova-gold/15 text-nova-gold-light">👤</div>
            <div>
              <div className="font-display text-sm font-semibold text-nova-offwhite">Tengo cuenta</div>
              <div className="font-sans text-xs text-nova-offwhite/50">Inicia sesión con tu teléfono</div>
            </div>
          </button>

          <button onClick={() => setMode("register")}
            className="mb-3 flex w-full items-center gap-3 rounded-nova border border-white/15 bg-white/[0.02] p-4 text-left transition-colors hover:border-nova-gold/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-nova-offwhite/60">✨</div>
            <div>
              <div className="font-display text-sm font-semibold text-nova-offwhite">Crear cuenta</div>
              <div className="font-sans text-xs text-nova-offwhite/50">Guarda tu historial y reserva más rápido</div>
            </div>
          </button>

          <button onClick={onGuest}
            className="flex w-full items-center gap-3 rounded-nova border border-white/10 bg-transparent p-4 text-left transition-colors hover:border-white/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-nova-offwhite/40">🚀</div>
            <div>
              <div className="font-display text-sm font-semibold text-nova-offwhite/80">Continuar como invitado</div>
              <div className="font-sans text-xs text-nova-offwhite/40">Solo nombre y teléfono, sin cuenta</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ===== LOGIN =====
  if (mode === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-16 w-16 rounded-full border border-nova-gold/30 object-cover" />
            <h1 className="font-display text-xl font-bold">Iniciar sesión</h1>
          </div>
          <InputField label="Teléfono o email" value={form.identifier} onChange={v => F("identifier", v)} placeholder="Ej: 300 123 4567" icon="📱" />
          <InputField label="Contraseña" value={form.password} onChange={v => F("password", v)} type="password" placeholder="Tu contraseña" icon="🔒" />

          {error && <div className="mb-4 rounded-nova border border-red-500/30 bg-red-500/5 p-3 text-center font-sans text-sm text-red-300">{error}</div>}

          <button onClick={handleLogin} disabled={loading || !form.identifier || !form.password}
            className="mb-3 h-12 w-full rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed">
            {loading ? "Entrando…" : "Entrar"}
          </button>

          <div className="flex justify-between">
            <button onClick={() => { setMode("recovery"); setError(null); }} className="font-sans text-xs text-nova-gold-light hover:underline">¿Olvidaste tu contraseña?</button>
            <button onClick={() => { setMode("register"); setError(null); setForm({}); }} className="font-sans text-xs text-nova-offwhite/50 hover:text-nova-offwhite">Crear cuenta</button>
          </div>
          <button onClick={() => { setMode("choice"); setError(null); setForm({}); }} className="mt-6 block w-full text-center font-sans text-xs text-nova-offwhite/30 hover:text-nova-offwhite/50">← Volver</button>
        </div>
      </div>
    );
  }

  // ===== REGISTER =====
  if (mode === "register") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-16 w-16 rounded-full border border-nova-gold/30 object-cover" />
            <h1 className="font-display text-xl font-bold">Crear tu cuenta</h1>
            <p className="mt-1 font-sans text-sm text-nova-offwhite/50">Reserva más rápido y guarda tu historial</p>
          </div>
          <InputField label="Nombre completo *" value={form.full_name} onChange={v => F("full_name", v)} placeholder="Ej: Andrés Gómez" icon="👤" />
          <InputField label="Teléfono *" value={form.phone} onChange={v => F("phone", v)} placeholder="Ej: 300 123 4567" icon="📱" inputMode="tel" />
          <InputField label="Email (opcional)" value={form.email} onChange={v => F("email", v)} placeholder="Ej: tu@email.com" icon="📧" type="email" />
          <InputField label="Contraseña * (mínimo 6 caracteres)" value={form.password} onChange={v => F("password", v)} placeholder="Crea tu contraseña" icon="🔒" type="password" />

          {error && <div className="mb-4 rounded-nova border border-red-500/30 bg-red-500/5 p-3 text-center font-sans text-sm text-red-300">{error}</div>}

          <button onClick={handleRegister} disabled={loading}
            className="mb-3 h-12 w-full rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110 disabled:opacity-30">
            {loading ? "Creando…" : "Crear cuenta"}
          </button>

          <div className="flex justify-between">
            <button onClick={() => { setMode("login"); setError(null); setForm({}); }} className="font-sans text-xs text-nova-offwhite/50 hover:text-nova-offwhite">Ya tengo cuenta</button>
            <button onClick={onGuest} className="font-sans text-xs text-nova-offwhite/40 hover:text-nova-offwhite/60">Seguir como invitado</button>
          </div>
          <button onClick={() => { setMode("choice"); setError(null); setForm({}); }} className="mt-6 block w-full text-center font-sans text-xs text-nova-offwhite/30 hover:text-nova-offwhite/50">← Volver</button>
        </div>
      </div>
    );
  }

  // ===== RECOVERY =====
  if (mode === "recovery") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm text-center">
          <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-16 w-16 rounded-full border border-nova-gold/30 object-cover" />
          <h1 className="font-display text-xl font-bold mb-2">Recuperar contraseña</h1>

          <div className="mb-6 rounded-nova border border-white/10 bg-nova-bg-matte p-5">
            <p className="font-sans text-sm text-nova-offwhite/70 leading-relaxed">
              Para recuperar tu contraseña, comunícate con nosotros directamente en <strong className="text-nova-offwhite">Nova Barber Shop</strong>.
            </p>
            <div className="mt-4 space-y-2 text-left font-sans text-sm">
              <div className="flex items-center gap-2 text-nova-offwhite/60">
                <span>📍</span><span>Calle 9 #4-63, Candelaria, Valle</span>
              </div>
              <div className="flex items-center gap-2 text-nova-offwhite/60">
                <span>📱</span><span>Escríbenos o llámanos y te ayudaremos</span>
              </div>
            </div>
            <p className="mt-4 font-sans text-xs text-nova-offwhite/40">
              Te daremos una nueva contraseña temporal para que puedas ingresar.
            </p>
          </div>

          <button onClick={() => { setMode("login"); }} className="font-sans text-xs text-nova-offwhite/50 hover:text-nova-offwhite">← Volver al login</button>
        </div>
      </div>
    );
  }
}
