import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// InputField FUERA del componente para evitar re-mount en cada render
function AuthInput({ label, value, onChange, type = "text", placeholder = "", icon = null, ...props }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="mb-4">
      <label className="mb-1 block font-sans text-xs text-nova-offwhite/60">{label}</label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nova-offwhite/40">{icon}</span>}
        <input
          type={isPassword && showPw ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            "h-11 w-full rounded-nova border border-white/15 bg-nova-bg-main font-sans text-nova-offwhite placeholder:text-nova-offwhite/30 focus:outline-none focus:ring-2 focus:ring-nova-gold-light",
            icon ? "pl-9" : "px-4",
            isPassword ? "pr-10" : "pr-4"
          )}
          {...props}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-nova-offwhite/40 hover:text-nova-offwhite/60">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClientAuthPage({ onLogin, onGuest }) {
  const [mode, setMode] = useState("choice");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
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
    if (!fullName.trim() || !phone.trim() || !regPassword.trim()) { setError("Nombre, teléfono y contraseña son obligatorios."); return; }
    if (regPassword.length < 4) { setError("La contraseña debe tener al menos 4 caracteres."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim(), email: email.trim() || null, password: regPassword }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Error al registrar"); }
      const data = await res.json();
      localStorage.setItem("nova_token", data.access_token);
      localStorage.setItem("nova_user", JSON.stringify(data.user));
      onLogin(data.user, data.access_token);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (mode === "choice") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm text-center">
          <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-20 w-20 rounded-full border border-nova-gold/30 object-cover" />
          <h1 className="font-display text-xl font-bold text-nova-offwhite">¿Cómo deseas reservar?</h1>
          <p className="mt-1 mb-6 font-sans text-sm text-nova-offwhite/50">Elige una opción para continuar</p>
          <button onClick={() => { setMode("login"); setError(null); }}
            className="mb-3 flex w-full items-center gap-3 rounded-nova border border-nova-gold/30 bg-nova-gold/5 p-4 text-left hover:bg-nova-gold/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nova-gold/15 text-nova-gold-light">👤</div>
            <div><div className="font-display text-sm font-semibold text-nova-offwhite">Tengo cuenta</div><div className="font-sans text-xs text-nova-offwhite/50">Inicia sesión con tu teléfono</div></div>
          </button>
          <button onClick={() => { setMode("register"); setError(null); }}
            className="mb-3 flex w-full items-center gap-3 rounded-nova border border-white/15 bg-white/[0.02] p-4 text-left hover:border-nova-gold/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-nova-offwhite/60">✨</div>
            <div><div className="font-display text-sm font-semibold text-nova-offwhite">Crear cuenta</div><div className="font-sans text-xs text-nova-offwhite/50">Guarda tu historial y reserva más rápido</div></div>
          </button>
          <button onClick={onGuest}
            className="flex w-full items-center gap-3 rounded-nova border border-white/10 bg-transparent p-4 text-left hover:border-white/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-nova-offwhite/40">🚀</div>
            <div><div className="font-display text-sm font-semibold text-nova-offwhite/80">Continuar como invitado</div><div className="font-sans text-xs text-nova-offwhite/40">Solo nombre y teléfono, sin cuenta</div></div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-16 w-16 rounded-full border border-nova-gold/30 object-cover" />
            <h1 className="font-display text-xl font-bold">Iniciar sesión</h1>
          </div>
          <AuthInput label="Teléfono o email" value={identifier} onChange={setIdentifier} placeholder="Ej: 300 123 4567" icon="📱" />
          <AuthInput label="Contraseña" value={password} onChange={setPassword} type="password" placeholder="Tu contraseña" icon="🔒" />
          {error && <div className="mb-4 rounded-nova border border-red-500/30 bg-red-500/5 p-3 text-center font-sans text-sm text-red-300">{error}</div>}
          <button onClick={handleLogin} disabled={loading || !identifier || !password}
            className="mb-3 h-12 w-full rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed">
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <div className="flex justify-between">
            <button onClick={() => { setMode("recovery"); setError(null); }} className="font-sans text-xs text-nova-gold-light hover:underline">¿Olvidaste tu contraseña?</button>
            <button onClick={() => { setMode("register"); setError(null); }} className="font-sans text-xs text-nova-offwhite/50 hover:text-nova-offwhite">Crear cuenta</button>
          </div>
          <button onClick={() => { setMode("choice"); setError(null); }} className="mt-6 block w-full text-center font-sans text-xs text-nova-offwhite/30 hover:text-nova-offwhite/50">← Volver</button>
        </div>
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-16 w-16 rounded-full border border-nova-gold/30 object-cover" />
            <h1 className="font-display text-xl font-bold">Crear tu cuenta</h1>
            <p className="mt-1 font-sans text-sm text-nova-offwhite/50">Reserva más rápido y guarda tu historial</p>
          </div>
          <AuthInput label="Nombre completo *" value={fullName} onChange={setFullName} placeholder="Ej: Andrés Gómez" icon="👤" />
          <AuthInput label="Teléfono *" value={phone} onChange={setPhone} placeholder="Ej: 300 123 4567" icon="📱" inputMode="tel" />
          <AuthInput label="Email (opcional)" value={email} onChange={setEmail} placeholder="Ej: tu@email.com" icon="📧" type="email" />
          <AuthInput label="Contraseña * (mínimo 4 caracteres)" value={regPassword} onChange={setRegPassword} placeholder="Crea tu contraseña" icon="🔒" type="password" />
          {error && <div className="mb-4 rounded-nova border border-red-500/30 bg-red-500/5 p-3 text-center font-sans text-sm text-red-300">{error}</div>}
          <button onClick={handleRegister} disabled={loading}
            className="mb-3 h-12 w-full rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110 disabled:opacity-30">
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
          <div className="flex justify-between">
            <button onClick={() => { setMode("login"); setError(null); }} className="font-sans text-xs text-nova-offwhite/50 hover:text-nova-offwhite">Ya tengo cuenta</button>
            <button onClick={onGuest} className="font-sans text-xs text-nova-offwhite/40 hover:text-nova-offwhite/60">Seguir como invitado</button>
          </div>
          <button onClick={() => { setMode("choice"); setError(null); }} className="mt-6 block w-full text-center font-sans text-xs text-nova-offwhite/30 hover:text-nova-offwhite/50">← Volver</button>
        </div>
      </div>
    );
  }

  const [recoverPhone, setRecoverPhone] = useState("");
  const [recoverResult, setRecoverResult] = useState(null);

  const handleRecover = async () => {
    if (!recoverPhone.trim()) { setError("Ingresa tu número de teléfono."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/recover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: recoverPhone.trim() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Error"); }
      const data = await res.json();
      setRecoverResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // RECOVERY
  return (
    <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
      <div className="w-full max-w-sm text-center">
        <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-16 w-16 rounded-full border border-nova-gold/30 object-cover" />
        <h1 className="font-display text-xl font-bold mb-2">Recuperar contraseña</h1>

        {!recoverResult ? (<>
          <p className="mb-4 font-sans text-sm text-nova-offwhite/50">Ingresa el teléfono con el que te registraste y te asignaremos una nueva contraseña.</p>
          <AuthInput label="Teléfono registrado" value={recoverPhone} onChange={setRecoverPhone} placeholder="Ej: 300 123 4567" icon="📱" />
          {error && <div className="mb-4 rounded-nova border border-red-500/30 bg-red-500/5 p-3 text-center font-sans text-sm text-red-300">{error}</div>}
          <button onClick={handleRecover} disabled={loading || !recoverPhone.trim()}
            className="mb-4 h-12 w-full rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110 disabled:opacity-30">
            {loading ? "Procesando…" : "Recuperar contraseña"}
          </button>
        </>) : (
          <div className="mb-6 rounded-nova border border-green-400/30 bg-green-400/5 p-5">
            <div className="font-sans text-sm text-green-300 mb-3">✅ {recoverResult.message}</div>
            <div className="rounded-nova border border-nova-gold/30 bg-nova-bg-matte p-4">
              <div className="font-sans text-xs text-nova-offwhite/50 mb-1">Tu nueva contraseña es:</div>
              <div className="font-display text-2xl font-bold text-nova-gold-light tracking-wider">{recoverResult.new_password}</div>
            </div>
            <p className="mt-3 font-sans text-xs text-nova-offwhite/40">Úsala para iniciar sesión. Te recomendamos cambiarla después desde tu perfil.</p>
          </div>
        )}

        <button onClick={() => { setMode("login"); setRecoverResult(null); setRecoverPhone(""); setError(null); }} className="font-sans text-xs text-nova-offwhite/50 hover:text-nova-offwhite">← Volver al login</button>
      </div>
    </div>
  );
}
