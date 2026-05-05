import { Card } from "../../components/Card";
import { mockDashboardMetrics } from "../../services/mock/dashboardMetrics";

/**
 * Page d'accueil : vue synthétique (métriques fictives).
 */
export function DashboardPage() {
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
          Tableau de bord
        </h1>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)" }}>
          Aperçu rapide de l’activité — données locales pour la maquette.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {mockDashboardMetrics.map((m) => (
          <Card key={m.id} title={m.label}>
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {m.value}
            </div>
            {m.hint && (
              <p
                style={{
                  margin: "0.5rem 0 0",
                  fontSize: "0.8125rem",
                  color: "var(--text-muted)",
                }}
              >
                {m.hint}
              </p>
            )}
          </Card>
        ))}
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <Card
          title="Prochaines étapes produit"
          subtitle="Ce bloc sert d’exemple de carte pleine largeur."
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.15rem",
              color: "var(--text-secondary)",
              fontSize: "0.9375rem",
            }}
          >
            <li>Brancher Supabase et remplacer les mocks dans `src/services`.</li>
            <li>Ajouter les modules métier (recettes, stocks, devis…).</li>
            <li>Préparer les rôles utilisateurs quand l’authentification sera prête.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
