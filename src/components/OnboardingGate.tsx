import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

/**
 * Si l’utilisateur n’a aucune affectation boutique active, redirection vers
 * `/onboarding`. Les routes métier sont des enfants de ce gate.
 */
export function OnboardingGate() {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from("shop_memberships")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active");
      if (cancelled) {
        return;
      }
      if (error) {
        setComplete(false);
      } else {
        setComplete((count ?? 0) > 0);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!ready) {
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
        Vérification du compte…
      </div>
    );
  }

  if (!complete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
