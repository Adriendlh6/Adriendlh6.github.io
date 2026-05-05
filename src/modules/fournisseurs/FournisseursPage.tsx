import { useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Card } from "../../components/Card";
import { mockSuppliers } from "../../services/mock/suppliers";

/**
 * Liste des fournisseurs (données fictives).
 */
export function FournisseursPage() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const selectedSupplier = mockSuppliers.find((s) => s.id === selectedSupplierId) ?? null;

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
          Fournisseurs
        </h1>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)" }}>
          Annuaire simplifié — plus tard : contacts, conditions, historique.
        </p>
      </header>

      <Card title={`${mockSuppliers.length} fournisseurs`}>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {mockSuppliers.map((s, index) => (
            <li
              key={s.id}
              onClick={() => setSelectedSupplierId(s.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedSupplierId(s.id);
                }
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "1rem",
                alignItems: "baseline",
                padding: "0.85rem 0",
                borderTop: index === 0 ? "none" : "1px solid var(--border-subtle)",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  {s.category} · {s.city}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {s.phone}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <BottomSheet
        isOpen={Boolean(selectedSupplier)}
        title={selectedSupplier ? selectedSupplier.name : "Fournisseur"}
        onClose={() => setSelectedSupplierId(null)}
      >
        {selectedSupplier && (
          <div style={{ display: "grid", gap: "0.65rem", color: "var(--text-secondary)" }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--text-primary)" }}>Catégorie :</strong>{" "}
              {selectedSupplier.category}
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--text-primary)" }}>Ville :</strong>{" "}
              {selectedSupplier.city}
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--text-primary)" }}>Téléphone :</strong>{" "}
              {selectedSupplier.phone}
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
