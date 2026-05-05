import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function LoginPage() {
  const { user, loading, configured, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!configured) {
    return (
      <div style={shell}>
        <div style={card}>
          <h1 style={title}>Configuration requise</h1>
          <p style={muted}>
            Définissez <code>VITE_SUPABASE_URL</code> et{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> dans <code>.env</code>, puis
            redémarrez le serveur de dev.
          </p>
        </div>
      </div>
    );
  }

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit (e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div style={shell}>
      <div style={card}>
        <h1 style={title}>Connexion</h1>
        <p style={muted}>Accédez à votre espace Bakergest.</p>
        <form onSubmit={(e) => void onSubmit(e)} style={{ marginTop: "1.25rem" }}>
          <label style={label}>
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </label>
          <label style={label}>
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
            />
          </label>
          {error && (
            <p style={{ color: "#b91c1c", fontSize: "0.875rem", margin: "0.75rem 0 0" }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting || loading} style={button}>
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p style={{ ...muted, marginTop: "1.25rem" }}>
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  backgroundColor: "var(--bg-page)",
  backgroundImage: "url('/img/login/background.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  padding: "2rem",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "1.35rem",
  fontWeight: 700,
};

const muted: React.CSSProperties = {
  margin: "0.35rem 0 0",
  fontSize: "0.9rem",
  color: "var(--text-secondary)",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "0.85rem",
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  padding: "0.55rem 0.65rem",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-subtle)",
  font: "inherit",
  boxSizing: "border-box",
};

const button: React.CSSProperties = {
  marginTop: "1rem",
  width: "100%",
  padding: "0.65rem",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  font: "inherit",
  cursor: "pointer",
};
