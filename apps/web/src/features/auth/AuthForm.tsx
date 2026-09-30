import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        setMessage(
          data.session
            ? "Account created."
            : "Account created. Check your email to confirm your address.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <p className="eyebrow">FOCUSROOM / ACCOUNT</p>
      <h1 id="auth-title">
        {mode === "sign-in" ? "Return to your room." : "Create your room."}
      </h1>
      <p className="lede">
        Authentication is deliberately plain for now. The visual system comes after the
        product foundation is stable.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting
            ? "Working…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {message ? <p className="status-message">{message}</p> : null}

      <button
        className="text-button"
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setMessage(null);
        }}
      >
        {mode === "sign-in"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
