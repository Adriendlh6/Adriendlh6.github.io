import type { ExternalRole, OrganizationRole, ShopRole } from "../types/auth";

/** Liste centralisée des permissions (module.action). */
export const PERMISSION_KEYS = [
  "dashboard.read",
  "suppliers.read",
  "suppliers.write",
  "mercurial.read",
  "mercurial.write",
  "users.invite",
  "users.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const ALL: PermissionKey[] = [...PERMISSION_KEYS];

/** Permissions par défaut selon le rôle organisationnel. */
export const organizationRoleTemplate: Record<OrganizationRole, PermissionKey[]> = {
  owner: ALL,
  admin: ALL,
  accountant_internal: ["dashboard.read", "suppliers.read", "mercurial.read"],
  viewer: ["dashboard.read", "suppliers.read", "mercurial.read"],
};

/** Permissions par défaut selon le rôle boutique. */
export const shopRoleTemplate: Record<ShopRole, PermissionKey[]> = {
  owner: ALL,
  shop_manager: ALL,
  lab_manager: [
    "dashboard.read",
    "suppliers.read",
    "mercurial.read",
    "mercurial.write",
  ],
  worker_production: ["dashboard.read", "mercurial.read"],
  worker_sales: ["dashboard.read", "suppliers.read"],
  apprentice: ["dashboard.read", "mercurial.read"],
};

/** Préparatoire — portail comptable futur. */
export const externalRoleTemplate: Record<ExternalRole, PermissionKey[]> = {
  accountant_external: [],
};

export type RoleTemplate = {
  organizationRoleTemplate: typeof organizationRoleTemplate;
  shopRoleTemplate: typeof shopRoleTemplate;
  externalRoleTemplate: typeof externalRoleTemplate;
};

export const roleTemplate: RoleTemplate = {
  organizationRoleTemplate,
  shopRoleTemplate,
  externalRoleTemplate,
};

export function permissionSetHas(
  set: ReadonlySet<PermissionKey>,
  permission: PermissionKey,
): boolean {
  return set.has(permission);
}
