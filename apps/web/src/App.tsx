import { AuthenticatedHome } from "./features/auth/AuthenticatedHome";
import { AuthForm } from "./features/auth/AuthForm";
import { useAuth } from "./features/auth/AuthContext";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="shell">
        <p className="eyebrow">FOCUSROOM</p>
        <p>Opening your room…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <AuthForm />
      </main>
    );
  }

  return <AuthenticatedHome />;
}

export default App;
