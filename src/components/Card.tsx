import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  children: ReactNode;
  /** Texte secondaire sous le titre */
  subtitle?: string;
};

/**
 * Carte blanche standard pour le contenu SaaS.
 */
export function Card({ title, subtitle, children }: CardProps) {
  return (
    <section
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: "1.25rem 1.5rem",
      }}
    >
      {(title || subtitle) && (
        <header style={{ marginBottom: title || subtitle ? "1rem" : 0 }}>
          {title && (
            <h2
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}
            >
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
