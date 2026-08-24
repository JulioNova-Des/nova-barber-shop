import { useState } from "react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Credenciales inválidas");
      }
      const data = await res.json();
      localStorage.setItem("nova_token", data.access_token);
      localStorage.setItem("nova_user", JSON.stringify(data.user));
      onLogin(data.user, data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo-nova.jpg" alt="NOVA" className="mx-auto mb-4 h-20 w-20 rounded-full border border-nova-gold/30 object-cover" />
          <h1 className="font-display text-xl font-bold text-nova-offwhite">Iniciar sesión</h1>
          <p className="mt-1 font-sans text-sm text-nova-offwhite/50">Barberos, cajeros y admin</p>
        </div>

        <div className="mb-4">
          <label className="mb-1 block font-sans text-xs text-nova-offwhite/60">Teléfono o email</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Ej: 322423455"
            className="h-11 w-full rounded-nova border border-white/15 bg-nova-bg-main px-4 font-sans text-nova-offwhite placeholder:text-nova-offwhite/30 focus:outline-none focus:ring-2 focus:ring-nova-gold-light"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block font-sans text-xs text-nova-offwhite/60">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            className="h-11 w-full rounded-nova border border-white/15 bg-nova-bg-main px-4 font-sans text-nova-offwhite placeholder:text-nova-offwhite/30 focus:outline-none focus:ring-2 focus:ring-nova-gold-light"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-nova border border-red-500/30 bg-red-500/5 p-3 text-center font-sans text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !identifier || !password}
          className={cn(
            "h-12 w-full rounded-nova bg-nova-gold-gradient font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep",
            "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
          )}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p className="mt-6 text-center font-sans text-xs text-nova-offwhite/30">
          Solo personal de NOVA Barber Shop
        </p>
      </form>
    </div>
  );
}
