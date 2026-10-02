import { Navigate, Link, useSearchParams } from "react-router-dom";
import { AtmosphereLayer, FocusMark, type Room } from "../components/AtmosphereLayer";
import { AuthForm } from "../features/auth/AuthForm";
import { useAuth } from "../features/auth/AuthContext";
import "./atmosphere.css";

function resolveRoom(value: string | null): Room {
  if (value === "night-train" || value === "orbital-lab" || value === "cozy-cafe") {
    return value;
  }

  if (value === "rain-city") return value;

  const saved = window.localStorage.getItem("focusroom-room");
  if (saved === "night-train" || saved === "orbital-lab" || saved === "cozy-cafe") {
    return saved;
  }

  return "rain-city";
}

export function AuthPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const requestedMode = params.get("mode");
  const mode = requestedMode === "sign-up" ? "sign-up" : "sign-in";
  const room = resolveRoom(params.get("room"));

  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <main className={`auth-alive-page landing-alive--${room}`}>
      <AtmosphereLayer room={room} rainIntensity={room === "rain-city" ? 0.28 : 0} />

      <header className="auth-topbar">
        <Link className="alive-brand" to="/">
          <FocusMark />
          <span>FOCUSROOM</span>
        </Link>
        <Link to="/">Back to experience</Link>
      </header>

      <section className="auth-visual" aria-hidden="true">
        <div className="auth-focus-frame">
          <span /><span /><span /><span />
        </div>
        <div className="auth-word">FOCUS</div>
        <div className="auth-visual-copy">
          <p className="micro-label">QUIET INTENSITY</p>
          <h2>Make space<br />for attention.</h2>
          <p>Return to the same atmosphere, sounds and focus history you left behind.</p>
        </div>
      </section>

      <section className="auth-panel-new">
        <AuthForm initialMode={mode} />
      </section>
    </main>
  );
}
