/**
 * Organization = entreprise cliente Bakergest.
 * Shop = boutique, labo ou point de vente rattaché à une Organization.
 */

export type Organization = {
  id: string;
  name: string;
};

export type Shop = {
  id: string;
  organizationId: string;
  name: string;
};

/** Préparatoire V2 — pas d’UI ni workflow en V1. */
export type AccountantLinkCode = {
  id: string;
  accountantUserId: string;
  code: string;
};

/** Préparatoire V2 — pas d’UI ni workflow en V1. */
export type AccountantShopLink = {
  id: string;
  accountantUserId: string;
  shopId: string;
  status: "pending" | "active" | "revoked";
};
