import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Routes nécessitant une session Supabase.
 */
export function ProtectedRoute() {
  const { user, loading, configured } = useAuth();

  if (!configured) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          color: "var(--text-secondary)",
        }}
      >
        Variables Supabase manquantes — voir <code>.env.example</code>.
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Chargement de la session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
