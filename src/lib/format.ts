/**
 * Utilitaires d’affichage réutilisables (montants, dates, etc.).
 */

/** Affiche un montant en euros style français (virgule décimale). */
export function formatEuros(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
