/** Ingrédient pour la mercuriale (suivi des achats / prix) */
export type Ingredient = {
  id: string;
  name: string;
  category: string;
  unit: string;
  lastPriceEur: number;
  supplierName: string;
  eanMain?: string;
  stock?: number;
  priceTrend?: "up" | "down" | "flat";
  stockStatus: "ok" | "low" | "out";
};
