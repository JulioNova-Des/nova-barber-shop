import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import BookingStepBranchService from "@/components/booking/BookingStepBranchService";
import BookingStepDateTime from "@/components/booking/BookingStepDateTime";
import BookingStepConfirm from "@/components/booking/BookingStepConfirm";
import LoginPage from "@/pages/LoginPage";
import BarberDashboard from "@/pages/BarberDashboard";
import CashierDashboard from "@/pages/CashierDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import LobbyPage from "@/pages/LobbyPage";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function HomePage() {
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-nova-bg-deep px-6 text-center">
      <img src="/logo-nova.jpg" alt="NOVA" className="mb-6 h-40 w-40 rounded-full border-2 border-nova-gold/30 object-cover shadow-nova-gold" />
      <h1 className="font-display text-sm uppercase tracking-[0.25em] text-nova-champagne">Sistema de Reservas</h1>
      <p className="mt-2 max-w-sm font-sans text-sm text-nova-offwhite/50">
        Agenda tu cita en línea. Elige sucursal, servicio, fecha y hora — sin esperas.
      </p>
      <button onClick={() => nav("/reservar")} className="mt-8 rounded-nova bg-nova-gold-gradient px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110">
        Reservar ahora
      </button>
      <button onClick={() => nav("/staff")} className="mt-4 rounded-nova border border-white/15 px-6 py-3 font-sans text-xs text-nova-offwhite/50 hover:border-nova-gold/30 hover:text-nova-offwhite/80">
        Acceso barberos y staff
      </button>
    </div>
  );
}

function BookingPage() {
  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [booking, setBooking] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`${API}/branches`).then(r => r.json()).then(setBranches).catch(() => {});
    fetch(`${API}/services`).then(r => r.json()).then(setServices).catch(() => {});
    const token = localStorage.getItem("nova_token");
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null).then(setUser).catch(() => {});
    }
  }, []);

  if (step === 1) return (
    <BookingStepBranchService branches={branches} services={services}
      onContinue={({ branchId, serviceId }) => {
        const branch = branches.find(b => b.id === branchId);
        const service = services.find(s => s.id === serviceId);
        setBooking(prev => ({ ...prev, branchId, serviceId, branchName: branch?.name, serviceName: service?.name, price: service?.price, durationMinutes: service?.duration_minutes }));
        setStep(2);
      }}
    />
  );
  if (step === 2) return (
    <BookingStepDateTime branchId={booking.branchId} serviceId={booking.serviceId}
      onBack={() => setStep(1)}
      onContinue={({ date, startTime, endTime, barberId, chairId }) => {
        setBooking(prev => ({ ...prev, date, startTime, endTime, barberId, chairId }));
        setStep(3);
      }}
    />
  );
  return (
    <BookingStepConfirm currentUser={user} branchId={booking.branchId} branchName={booking.branchName}
      serviceId={booking.serviceId} serviceName={booking.serviceName} price={booking.price} durationMinutes={booking.durationMinutes}
      chairId={booking.chairId} chairLabel={`Silla ${booking.chairId}`} barberId={booking.barberId} barberName="Barbero asignado"
      date={booking.date} startTime={booking.startTime} endTime={booking.endTime}
      onBack={() => setStep(2)} onGoToAvailability={() => setStep(2)} />
  );
}

function StaffRouter() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("nova_token");
    const u = localStorage.getItem("nova_user");
    if (t && u) { try { setUser(JSON.parse(u)); setToken(t); } catch (e) {} }
  }, []);

  const handleLogin = (u, t) => { setUser(u); setToken(t); };
  const handleLogout = () => { localStorage.removeItem("nova_token"); localStorage.removeItem("nova_user"); setUser(null); setToken(null); };

  if (!user || !token) return <LoginPage onLogin={handleLogin} />;
  if (user.role === "barber") return <BarberDashboard user={user} token={token} onLogout={handleLogout} />;
  if (user.role === "cashier") return <CashierDashboard user={user} token={token} onLogout={handleLogout} />;
  if (user.role === "admin") return <AdminDashboard user={user} token={token} onLogout={handleLogout} />;
  return <div className="flex min-h-screen items-center justify-center bg-nova-bg-deep text-nova-offwhite">Rol no reconocido</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reservar" element={<BookingPage />} />
        <Route path="/staff" element={<StaffRouter />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
