import { Navigate, Route, Routes } from "react-router-dom";
import { AuthenticatedHome } from "./features/auth/AuthenticatedHome";
import { useAuth } from "./features/auth/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="app-loading">
        <span className="brand-wordmark">FOCUSROOM</span>
        <span className="loading-dot" aria-hidden="true" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth?mode=sign-in" replace />;
  }

  return <AuthenticatedHome />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/app" element={<ProtectedApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
