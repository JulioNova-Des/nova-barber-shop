import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import BookingStepBranchService from "@/components/booking/BookingStepBranchService";
import BookingStepDateTime from "@/components/booking/BookingStepDateTime";
import BookingStepConfirm from "@/components/booking/BookingStepConfirm";
import TopNav from "@/components/TopNav";
import LoginPage from "@/pages/LoginPage";
import ClientAuthPage from "@/pages/ClientAuthPage";
import ClientProfilePage from "@/pages/ClientProfilePage";
import BarberDashboard from "@/pages/BarberDashboard";
import CashierDashboard from "@/pages/CashierDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import LobbyPage from "@/pages/LobbyPage";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function VisitTracker() {
  const location = useLocation();
  useEffect(() => { fetch(`${API}/analytics/visit`, { method: "POST" }).catch(() => {}); }, [location.pathname]);
  return null;
}

function getClientUser() {
  try { const u = JSON.parse(localStorage.getItem("nova_user")); return u?.role === "client" ? u : null; } catch { return null; }
}

function HomePage() {
  const nav = useNavigate();
  const [cu, setCu] = useState(getClientUser);
  const logout = () => { localStorage.removeItem("nova_token"); localStorage.removeItem("nova_user"); setCu(null); };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-nova-bg-deep px-6 text-center">
      <img src="/logo-nova.jpg" alt="NOVA" className="mb-6 h-40 w-40 rounded-full border-2 border-nova-gold/30 object-cover shadow-nova-gold" />
      <h1 className="font-display text-sm uppercase tracking-[0.25em] text-nova-champagne">Sistema de Reservas</h1>
      <p className="mt-2 max-w-sm font-sans text-sm text-nova-offwhite/50">Agenda tu cita en línea. Elige servicio, fecha y hora — sin esperas.</p>
      <button onClick={() => nav("/reservar")} className="mt-8 rounded-nova bg-nova-gold-gradient px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide text-nova-bg-deep hover:brightness-110">Reservar ahora</button>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {cu ? (<>
          <button onClick={() => nav("/perfil")} className="rounded-nova border border-nova-gold/30 bg-nova-gold/5 px-5 py-2.5 font-sans text-xs text-nova-gold-light">👤 {cu.full_name}</button>
          <button onClick={logout} className="rounded-nova border border-white/10 px-4 py-2.5 font-sans text-xs text-nova-offwhite/40">Cerrar sesión</button>
        </>) : (
          <button onClick={() => nav("/cuenta")} className="rounded-nova border border-white/15 px-5 py-2.5 font-sans text-xs text-nova-offwhite/50">👤 Iniciar sesión</button>
        )}
        <button onClick={() => nav("/staff")} className="rounded-nova border border-white/10 px-4 py-2.5 font-sans text-xs text-nova-offwhite/30">Staff</button>
      </div>
    </div>
  );
}

function BookingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState("auth");
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [booking, setBooking] = useState({});
  const [clientUser, setClientUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    fetch(`${API}/branches`).then(r => r.json()).then(setBranches).catch(() => {});
    fetch(`${API}/services`).then(r => r.json()).then(setServices).catch(() => {});
    const cu = getClientUser();
    if (cu) { setClientUser(cu); setStep("1"); }
  }, []);

  const handleLogin = (user) => { setClientUser(user); setIsGuest(false); setStep("1"); };
  const handleGuest = () => { setIsGuest(true); setClientUser(null); setStep("1"); };
  const handleLogout = () => { localStorage.removeItem("nova_token"); localStorage.removeItem("nova_user"); setClientUser(null); setIsGuest(false); setStep("auth"); };
  const reset = () => { setBooking({}); setStep("1"); };

  const backToHome = () => nav("/");

  // Auth choice screen
  if (step === "auth") return (
    <div>
      <TopNav title="NOVA BARBER" onBack={backToHome} rightContent={null} />
      <ClientAuthPage onLogin={handleLogin} onGuest={handleGuest} />
    </div>
  );

  // Booking header with login/logout
  const header = (
    <TopNav
      title={<>NOVA <span className="text-nova-gold-light">BARBER</span></>}
      subtitle={isGuest ? "Invitado" : clientUser?.full_name}
      onBack={step === "1" ? backToHome : step === "2" ? () => setStep("1") : step === "3" ? () => setStep("2") : null}
      rightContent={
        <div className="flex items-center gap-2">
          {clientUser && !isGuest ? (
            <button onClick={handleLogout} className="rounded-full border border-white/10 px-2.5 py-1 font-sans text-[11px] text-nova-offwhite/40">Salir</button>
          ) : isGuest ? (
            <button onClick={() => setStep("auth")} className="rounded-full border border-nova-gold/30 bg-nova-gold/5 px-2.5 py-1 font-sans text-[11px] text-nova-gold-light">Iniciar sesión</button>
          ) : null}
        </div>
      }
    />
  );

  if (step === "1") return (<>{header}
    <BookingStepBranchService branches={branches} services={services}
      onContinue={({ branchId, serviceId }) => {
        const branch = branches.find(b => b.id === branchId);
        const service = services.find(s => s.id === serviceId);
        setBooking({ branchId, serviceId, branchName: branch?.name, serviceName: service?.name, price: service?.price, durationMinutes: service?.duration_minutes });
        setStep("2");
      }} />
  </>);

  if (step === "2") return (<>{header}
    <BookingStepDateTime branchId={booking.branchId} serviceId={booking.serviceId}
      onBack={() => setStep("1")}
      onContinue={({ date, startTime, endTime, barberId, chairId }) => {
        setBooking(prev => ({ ...prev, date, startTime, endTime, barberId, chairId }));
        setStep("3");
      }} />
  </>);

  return (<>{header}
    <BookingStepConfirm currentUser={isGuest ? null : clientUser}
      branchId={booking.branchId} branchName={booking.branchName}
      serviceId={booking.serviceId} serviceName={booking.serviceName}
      price={booking.price} durationMinutes={booking.durationMinutes}
      chairId={booking.chairId} chairLabel={`Silla ${booking.chairId}`}
      barberId={booking.barberId} barberName="Barbero asignado"
      date={booking.date} startTime={booking.startTime} endTime={booking.endTime}
      onBack={() => setStep("2")} onGoToAvailability={() => setStep("2")}
      onNewBooking={reset} onGoHome={backToHome} />
  </>);
}

function ClientAccountPage() {
  const nav = useNavigate();
  return (
    <div>
      <TopNav title="Mi cuenta" onBack={() => nav("/")} />
      <ClientAuthPage onLogin={() => nav("/reservar")} onGuest={() => nav("/reservar")} />
    </div>
  );
}

function ClientProfileRouter() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  useEffect(() => {
    const t = localStorage.getItem("nova_token"); const u = localStorage.getItem("nova_user");
    if (t && u) { try { setUser(JSON.parse(u)); setToken(t); } catch {} }
  }, []);
  if (!user || !token) return <Navigate to="/cuenta" />;
  return <ClientProfilePage user={user} token={token}
    onLogout={() => { localStorage.removeItem("nova_token"); localStorage.removeItem("nova_user"); nav("/"); }}
    onNewBooking={() => nav("/reservar")} />;
}

function StaffRouter() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  useEffect(() => {
    const t = localStorage.getItem("nova_token"); const u = localStorage.getItem("nova_user");
    if (t && u) { try { const p = JSON.parse(u); if (p.role !== "client") { setUser(p); setToken(t); } } catch {} }
  }, []);
  const handleLogin = (u, t) => { setUser(u); setToken(t); };
  const handleLogout = () => { localStorage.removeItem("nova_token"); localStorage.removeItem("nova_user"); setUser(null); setToken(null); };

  if (!user || !token) return (
    <div>
      <TopNav title="Staff" onBack={() => nav("/")} />
      <LoginPage onLogin={handleLogin} />
    </div>
  );
  if (user.role === "barber") return <BarberDashboard user={user} token={token} onLogout={handleLogout} onHome={() => nav("/")} />;
  if (user.role === "cashier") return <CashierDashboard user={user} token={token} onLogout={handleLogout} onHome={() => nav("/")} />;
  if (user.role === "admin") return <AdminDashboard user={user} token={token} onLogout={handleLogout} onHome={() => nav("/")} />;
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <VisitTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reservar" element={<BookingPage />} />
        <Route path="/cuenta" element={<ClientAccountPage />} />
        <Route path="/perfil" element={<ClientProfileRouter />} />
        <Route path="/staff" element={<StaffRouter />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
