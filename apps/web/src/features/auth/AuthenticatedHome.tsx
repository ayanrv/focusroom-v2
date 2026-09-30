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
    <main className="shell">
      <header className="masthead">
        <span>FOCUSROOM</span>
        <button className="text-button" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <section className="foundation-panel">
        <p className="eyebrow">FOUNDATION / CONNECTED</p>
        <h1>The room starts here.</h1>
        <p className="lede">
          You are authenticated with Supabase, the API validates your session, and your
          FocusRoom profile is stored through Prisma in PostgreSQL.
        </p>

        <dl>
          <div>
            <dt>Signed in as</dt>
            <dd>{user?.email ?? "Unknown user"}</dd>
          </div>
          <div>
            <dt>API profile</dt>
            <dd>{error ? error : me ? "Connected" : "Checking…"}</dd>
          </div>
        </dl>

        <p className="next-note">
          Next product milestone: Focus Session domain → timestamp timer → central audio
          engine → Rainy Library.
        </p>
      </section>
    </main>
  );
}
