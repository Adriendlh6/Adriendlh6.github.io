import { useTheme } from "../../contexts/ThemeContext";
import { useAccess } from "../../contexts/AccessContext";
import { Card } from "../../components/Card";

export function ComptePage() {
  const { snapshot } = useAccess();
  const {
    lightVariant,
    setLightVariant,
    darkMode,
    setDarkMode,
    isDarkEffective,
    lightVariantOptions,
    darkModeOptions,
  } = useTheme();
  const initials = snapshot.user.displayName
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <header style={{ marginBottom: "1.75rem" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Mon compte
        </h1>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)" }}>
          Espace personnel et préférences d’affichage.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
        <Card title="Photo utilisateur" subtitle="Aperçu profil (upload à venir)">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "999px",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              {initials || "U"}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{snapshot.user.displayName}</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                {snapshot.user.email}
              </div>
              <button
                type="button"
                style={{
                  marginTop: "0.5rem",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-page)",
                  padding: "0.35rem 0.6rem",
                  cursor: "not-allowed",
                  color: "var(--text-muted)",
                }}
                title="Upload photo prévu dans une prochaine étape"
              >
                Changer la photo (bientôt)
              </button>
            </div>
          </div>
        </Card>

        <Card title="Infos perso">
          <dl style={{ margin: 0, display: "grid", gap: "0.4rem" }}>
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Nom</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{snapshot.user.displayName}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Email</dt>
              <dd style={{ margin: 0 }}>{snapshot.user.email}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Mes données">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            Cette zone accueillera l’export de données, l’historique personnel et les
            options de gestion de compte.
          </p>
        </Card>

        <Card title="Gestion des couleurs" subtitle="Thème visuel de l’application">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Variante claire</span>
              <select
                value={lightVariant}
                onChange={(e) => setLightVariant(e.target.value as typeof lightVariant)}
                style={{
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-page)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  padding: "0.55rem 0.65rem",
                }}
              >
                {lightVariantOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Mode sombre</span>
              <select
                value={darkMode}
                onChange={(e) => setDarkMode(e.target.value as typeof darkMode)}
                style={{
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-page)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  padding: "0.55rem 0.65rem",
                }}
              >
                {darkModeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              {darkMode === "auto"
                ? `Sombre actif automatiquement selon le système (${isDarkEffective ? "actif" : "inactif"}).`
                : isDarkEffective
                  ? "Sombre activé manuellement."
                  : "Sombre désactivé manuellement."}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
