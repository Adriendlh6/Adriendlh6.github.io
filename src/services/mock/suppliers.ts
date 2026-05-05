import type { Supplier } from "../../types";

/** Données fictives — futur remplacement par requêtes Supabase */
export const mockSuppliers: Supplier[] = [
  {
    id: "sup-1",
    name: "Minoterie Dupont",
    city: "Lille",
    phone: "03 20 00 00 01",
    category: "Farines",
  },
  {
    id: "sup-2",
    name: "Beurrerie des Flandres",
    city: "Dunkerque",
    phone: "03 28 00 00 02",
    category: "Matières grasses",
  },
  {
    id: "sup-3",
    name: "Chocolaterie Artisan",
    city: "Paris",
    phone: "01 42 00 00 03",
    category: "Chocolat & décors",
  },
  {
    id: "sup-4",
    name: "Fruits & Légumes Martin",
    city: "Arras",
    phone: "03 21 00 00 04",
    category: "Frais",
  },
];
