import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    setMode(initialMode);
    setMessage(null);
  }, [initialMode]);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage(null);
    setSearchParams({ mode: nextMode });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (mode === "sign-up") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: displayName.trim() || undefined } },
        });

        if (error) throw error;

        if (data.session) {
          navigate("/app");
          return;
        }

        setMessage("Check your email to confirm your account, then come back to sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="terminal-form-heading">
        <p className="terminal-kicker">{mode === "sign-in" ? "WELCOME BACK" : "CREATE YOUR ROOM"}</p>
        <h1>{mode === "sign-in" ? "Return to focus." : "Start your space."}</h1>
        <p>{mode === "sign-in" ? "Pick up where you left off." : "Save your rooms, sessions, sound presets and progress."}</p>
      </div>

      <div className="terminal-tabs" role="tablist" aria-label="Authentication mode">
        <button className={mode === "sign-in" ? "is-active" : ""} type="button" onClick={() => changeMode("sign-in")}>Sign in</button>
        <button className={mode === "sign-up" ? "is-active" : ""} type="button" onClick={() => changeMode("sign-up")}>Create account</button>
      </div>

      <form className="terminal-form" onSubmit={handleSubmit}>
        {mode === "sign-up" ? (
          <label>
            <span>Display name <i>optional</i></span>
            <input autoComplete="name" type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
          </label>
        ) : null}

        <label>
          <span>Email</span>
          <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
        </label>

        <label>
          <span>Password</span>
          <input
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "sign-up" ? "At least 6 characters" : "Your password"}
            minLength={6}
            required
          />
        </label>

        {mode === "sign-up" ? (
          <label>
            <span>Confirm password</span>
            <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" minLength={6} required />
          </label>
        ) : null}

        <button className="terminal-submit" type="submit" disabled={submitting}>
          {submitting ? "Working…" : mode === "sign-in" ? "Enter FocusRoom" : "Create account"}
        </button>
      </form>

      {message ? <p className="terminal-message">{message}</p> : null}
    </div>
  );
}
