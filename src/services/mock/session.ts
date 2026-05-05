import type { OrganizationMember, ShopMembership, UserProfile } from "../../types/auth";
import type { Organization, Shop } from "../../types/organization";
import type { AccessSnapshot } from "../../lib/access";

/**
 * Données de démo locales — l’app utilise désormais Supabase pour la session et
 * le snapshot d’accès ; ce fichier peut servir de référence pour des tests ou du
 * hors-ligne ultérieur.
 */

/** Utilisateur courant (démo) — non utilisé par l’app connectée. */
export const mockCurrentUser: UserProfile = {
  id: "user-demo-1",
  displayName: "Camille Martin",
  email: "camille@demo.bakergest.test",
};

export const mockOrganizations: Organization[] = [
  { id: "org-1", name: "Boulangerie Martin" },
];

export const mockShops: Shop[] = [
  { id: "shop-labo", organizationId: "org-1", name: "Labo — centre-ville" },
  { id: "shop-pdv", organizationId: "org-1", name: "Point de vente — gare" },
];

/** Vide en démo : droits uniquement via affectations boutique (voir ci-dessous). */
export const mockOrganizationMembers: OrganizationMember[] = [];

/**
 * Même salarié, postes différents selon la boutique — le sélecteur change les
 * entrées de menu (ex. mercuriale visible au labo, pas au point de vente).
 */
export const mockShopMemberships: ShopMembership[] = [
  {
    userId: mockCurrentUser.id,
    organizationId: "org-1",
    shopId: "shop-labo",
    shopRole: "lab_manager",
    status: "active",
  },
  {
    userId: mockCurrentUser.id,
    organizationId: "org-1",
    shopId: "shop-pdv",
    shopRole: "worker_sales",
    status: "active",
  },
];

export function getAccessSnapshot(): AccessSnapshot {
  return {
    user: mockCurrentUser,
    organizations: mockOrganizations,
    shops: mockShops,
    organizationMembers: mockOrganizationMembers,
    shopMemberships: mockShopMemberships,
  };
}
