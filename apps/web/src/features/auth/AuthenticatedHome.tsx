import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "./AuthContext";

type MeResponse = {
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export function AuthenticatedHome() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>("/me")
      .then(setMe)
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load profile.");
      });
  }, []);

  return (
    <main className="app-shell-dark">
      <header className="app-shell-dark__nav">
        <a className="brand-lockup" href="/">
          <span className="brand-mark">FR</span>
          <span className="brand-copy">
            <b>FOCUSROOM</b>
            <small>WORKSPACE</small>
          </span>
        </a>
        <button className="terminal-back button-reset" type="button" onClick={() => void signOut()}>
          SIGN OUT
        </button>
      </header>

      <section className="app-placeholder-dark">
        <p className="terminal-kicker">ACCOUNT LINK // VERIFIED</p>
        <h1>Workspace online.</h1>
        <p>
          Authentication and the API boundary are connected. The full workspace will be
          built here next: sessions, timer, audio engine, and interactive spaces.
        </p>

        <div className="app-status-grid">
          <div>
            <small>IDENTITY</small>
            <strong>{me?.profile.displayName || user?.email || "CONNECTED"}</strong>
          </div>
          <div>
            <small>API LINK</small>
            <strong>{error ? "ERROR" : me ? "ONLINE" : "CHECKING"}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
