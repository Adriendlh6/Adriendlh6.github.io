import type { DashboardMetric } from "../../types";

/** Données fictives pour le tableau de bord */
export const mockDashboardMetrics: DashboardMetric[] = [
  {
    id: "1",
    label: "Commandes du jour",
    value: "12",
    hint: "dont 3 en livraison",
  },
  {
    id: "2",
    label: "Lignes mercuriale",
    value: "48",
    hint: "ingrédients suivis",
  },
  {
    id: "3",
    label: "Fournisseurs actifs",
    value: "9",
  },
  {
    id: "4",
    label: "Alertes stock",
    value: "2",
    hint: "à vérifier",
  },
];
