/** Rôles au niveau organisation (entreprise cliente). */
export type OrganizationRole = "owner" | "admin" | "accountant_internal" | "viewer";

/**
 * Rôles au niveau boutique / labo / point de vente.
 *
 * `owner` ici est une simplification V1 pour le premier espace artisan ; à terme,
 * « propriétaire » devrait très probablement être modélisé comme rôle Organization
 * (ex. table organization_members), pas comme ShopRole.
 */
export type ShopRole =
  | "owner"
  | "shop_manager"
  | "lab_manager"
  | "worker_production"
  | "worker_sales"
  | "apprentice";

/** Rôle externe (futur portail comptable) — préparatoire uniquement en V1. */
export type ExternalRole = "accountant_external";

export type ShopMembershipStatus = "pending" | "active" | "suspended" | "revoked";

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  /** Rôle externe éventuel ; pas utilisé en V1 côté UI. */
  externalRole?: ExternalRole;
};

/** Membre d’une organisation avec un rôle organisationnel. */
export type OrganizationMember = {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
};

/**
 * Affectation boutique : un même salarié peut avoir des postes différents
 * selon la boutique.
 */
export type ShopMembership = {
  userId: string;
  /**
   * Duplique la boutique parente (`shops.organization_id`) en V1 pour simplifier
   * les requêtes et les policies.
   * TODO(V2): garantir la cohérence (CHECK / trigger) ou supprimer la duplication.
   */
  organizationId: string;
  shopId: string;
  shopRole: ShopRole;
  status: ShopMembershipStatus;
};

/** Scope explicite pour can(permission, scope). */
export type OrganizationScope = { organizationId: string };
export type ShopScope = { shopId: string };
export type PermissionScope = OrganizationScope | ShopScope;
