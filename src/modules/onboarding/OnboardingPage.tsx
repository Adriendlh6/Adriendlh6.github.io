import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import type { ShopRole } from "../../types/auth";

export function OnboardingPage() {
  const { user, loading, configured } = useAuth();
  const navigate = useNavigate();
  const [alreadyOnboarded, setAlreadyOnboarded] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !configured) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count, error: qErr } = await supabase
        .from("shop_memberships")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active");
      if (cancelled) {
        return;
      }
      if (!qErr && (count ?? 0) > 0) {
        setAlreadyOnboarded(true);
      } else {
        setAlreadyOnboarded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, configured]);

  if (!configured) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (loading || (user && alreadyOnboarded === null)) {
    return (
      <div style={shell}>
        <p style={{ color: "var(--text-muted)" }}>Chargement…</p>
      </div>
    );
  }

  if (alreadyOnboarded === true) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit (e: FormEvent) {
    e.preventDefault();
    if (!user) {
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: displayName.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (profileErr) {
      setSubmitting(false);
      setError(profileErr.message);
      return;
    }

    const { data: orgRow, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: organizationName.trim(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (orgErr || !orgRow) {
      setSubmitting(false);
      setError(orgErr?.message ?? "Création organisation impossible");
      return;
    }

    const organizationId = orgRow.id as string;

    const { data: shopRow, error: shopErr } = await supabase
      .from("shops")
      .insert({
        organization_id: organizationId,
        name: shopName.trim(),
      })
      .select("id")
      .single();

    if (shopErr || !shopRow) {
      setSubmitting(false);
      setError(shopErr?.message ?? "Création boutique impossible");
      return;
    }

    const shopId = shopRow.id as string;

    const ownerRole: ShopRole = "owner";

    const { error: memErr } = await supabase.from("shop_memberships").insert({
      user_id: user.id,
      organization_id: organizationId,
      shop_id: shopId,
      shop_role: ownerRole,
      status: "active",
    });

    setSubmitting(false);

    if (memErr) {
      setError(memErr.message);
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <div style={shell}>
      <div style={card}>
        <h1 style={title}>Configurer votre espace</h1>
        <p style={muted}>
          Créez votre organisation et votre première boutique. Vous serez affecté·e
          comme propriétaire (owner) sur cette boutique.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} style={{ marginTop: "1.25rem" }}>
          <label style={label}>
            Nom affiché
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex. Camille Martin"
              style={input}
            />
          </label>
          <label style={label}>
            Nom de l’organisation
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Ex. Boulangerie Martin"
              style={input}
            />
          </label>
          <label style={label}>
            Première boutique / labo / point de vente
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Ex. Labo centre-ville"
              style={input}
            />
          </label>
          {error && (
            <p style={{ color: "#b91c1c", fontSize: "0.875rem", margin: "0.75rem 0 0" }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} style={button}>
            {submitting ? "Enregistrement…" : "Terminer"}
          </button>
        </form>
      </div>
    </div>
  );
}

const shell: CSSProperties = {
  minHeight: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  background: "var(--bg-page)",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 440,
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  padding: "2rem",
};

const title: CSSProperties = {
  margin: 0,
  fontSize: "1.35rem",
  fontWeight: 700,
};

const muted: CSSProperties = {
  margin: "0.35rem 0 0",
  fontSize: "0.9rem",
  color: "var(--text-secondary)",
};

const label: CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "0.85rem",
};

const input: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  padding: "0.55rem 0.65rem",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-subtle)",
  font: "inherit",
  boxSizing: "border-box",
};

const button: CSSProperties = {
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
