import type {
  OrganizationMember,
  PermissionScope,
  ShopMembership,
  UserProfile,
} from "../types/auth";
import type { Organization, Shop } from "../types/organization";
import {
  type PermissionKey,
  externalRoleTemplate,
  organizationRoleTemplate,
  permissionSetHas,
  shopRoleTemplate,
} from "./permissions";

export type AccessSnapshot = {
  user: UserProfile;
  organizations: Organization[];
  shops: Shop[];
  organizationMembers: OrganizationMember[];
  shopMemberships: ShopMembership[];
};

function shopById(snapshot: AccessSnapshot, shopId: string): Shop | undefined {
  return snapshot.shops.find((s) => s.id === shopId);
}

/** Permissions effectives au niveau organisation pour un utilisateur. */
function orgPermissionSet(
  snapshot: AccessSnapshot,
  organizationId: string,
): Set<PermissionKey> {
  const set = new Set<PermissionKey>();
  const rows = snapshot.organizationMembers.filter(
    (m) => m.userId === snapshot.user.id && m.organizationId === organizationId,
  );
  for (const m of rows) {
    for (const p of organizationRoleTemplate[m.role]) {
      set.add(p);
    }
  }
  if (snapshot.user.externalRole) {
    for (const p of externalRoleTemplate[snapshot.user.externalRole]) {
      set.add(p);
    }
  }
  return set;
}

/**
 * Permissions pour une boutique : droits org sur cette org + droits issus des
 * affectations boutique actives.
 */
function shopPermissionSet(
  snapshot: AccessSnapshot,
  shopId: string,
): Set<PermissionKey> {
  const shop = shopById(snapshot, shopId);
  if (!shop) {
    return new Set();
  }

  const set = orgPermissionSet(snapshot, shop.organizationId);

  const memberships = snapshot.shopMemberships.filter(
    (m) =>
      m.userId === snapshot.user.id &&
      m.shopId === shopId &&
      m.status === "active",
  );
  for (const m of memberships) {
    for (const p of shopRoleTemplate[m.shopRole]) {
      set.add(p);
    }
  }

  return set;
}

export function can(
  snapshot: AccessSnapshot,
  permission: PermissionKey,
  scope: PermissionScope,
): boolean {
  if ("organizationId" in scope) {
    return permissionSetHas(orgPermissionSet(snapshot, scope.organizationId), permission);
  }

  return permissionSetHas(shopPermissionSet(snapshot, scope.shopId), permission);
}

export function getVisibleShops(snapshot: AccessSnapshot): Shop[] {
  const userId = snapshot.user.id;
  const visible = new Set<string>();

  for (const m of snapshot.organizationMembers) {
    if (m.userId !== userId) {
      continue;
    }
    const orgShops = snapshot.shops.filter((s) => s.organizationId === m.organizationId);
    if (
      m.role === "owner" ||
      m.role === "admin" ||
      m.role === "viewer" ||
      m.role === "accountant_internal"
    ) {
      for (const s of orgShops) {
        visible.add(s.id);
      }
    }
  }

  for (const m of snapshot.shopMemberships) {
    if (m.userId === userId && m.status === "active") {
      visible.add(m.shopId);
    }
  }

  return snapshot.shops.filter((s) => visible.has(s.id));
}
