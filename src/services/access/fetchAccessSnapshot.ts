import type { User } from "@supabase/supabase-js";
import type { AccessSnapshot } from "../../lib/access";
import type {
  OrganizationMember,
  ShopMembership,
  ShopMembershipStatus,
  ShopRole,
  UserProfile,
} from "../../types/auth";
import type { Organization, Shop } from "../../types/organization";
import { supabase } from "../../lib/supabaseClient";

function isShopRole (value: string): value is ShopRole {
  return (
    value === "owner" ||
    value === "shop_manager" ||
    value === "lab_manager" ||
    value === "worker_production" ||
    value === "worker_sales" ||
    value === "apprentice"
  );
}

function isMembershipStatus (value: string): value is ShopMembershipStatus {
  return (
    value === "pending" ||
    value === "active" ||
    value === "suspended" ||
    value === "revoked"
  );
}

export async function fetchAccessSnapshot(
  authUser: User,
): Promise<{ snapshot: AccessSnapshot; error: Error | null }> {
  const userId = authUser.id;
  const email = authUser.email ?? "";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return {
      snapshot: emptySnapshot(authUser, null),
      error: new Error(profileError.message),
    };
  }

  const { data: memRows, error: memError } = await supabase
    .from("shop_memberships")
    .select("user_id, organization_id, shop_id, shop_role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (memError) {
    return {
      snapshot: emptySnapshot(authUser, profile?.display_name ?? null),
      error: new Error(memError.message),
    };
  }

  const membershipsRaw = memRows ?? [];

  const displayName =
    profile?.display_name ??
    (typeof authUser.user_metadata?.display_name === "string"
      ? authUser.user_metadata.display_name
      : null) ??
    email.split("@")[0] ??
    "Utilisateur";

  const profileRow: UserProfile = {
    id: userId,
    displayName,
    email,
  };

  if (membershipsRaw.length === 0) {
    return {
      snapshot: {
        user: profileRow,
        organizations: [],
        shops: [],
        organizationMembers: [],
        shopMemberships: [],
      },
      error: null,
    };
  }

  const orgIds = [...new Set(membershipsRaw.map((m) => m.organization_id as string))];

  const { data: orgRows, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  if (orgError) {
    return {
      snapshot: {
        user: profileRow,
        organizations: [],
        shops: [],
        organizationMembers: [],
        shopMemberships: [],
      },
      error: new Error(orgError.message),
    };
  }

  const { data: shopRows, error: shopError } = await supabase
    .from("shops")
    .select("id, organization_id, name")
    .in("organization_id", orgIds);

  if (shopError) {
    return {
      snapshot: {
        user: profileRow,
        organizations: [],
        shops: [],
        organizationMembers: [],
        shopMemberships: [],
      },
      error: new Error(shopError.message),
    };
  }

  const organizations: Organization[] = (orgRows ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
  }));

  const shops: Shop[] = (shopRows ?? []).map((s) => ({
    id: s.id as string,
    organizationId: s.organization_id as string,
    name: s.name as string,
  }));

  const shopMemberships: ShopMembership[] = membershipsRaw.map((m) => {
    const role = m.shop_role as string;
    const st = m.status as string;
    return {
      userId: m.user_id as string,
      organizationId: m.organization_id as string,
      shopId: m.shop_id as string,
      shopRole: isShopRole(role) ? role : "apprentice",
      status: isMembershipStatus(st) ? st : "active",
    };
  });

  const organizationMembers: OrganizationMember[] = [];
  for (const orgId of orgIds) {
    const isOwner = membershipsRaw.some(
      (m) => m.organization_id === orgId && m.shop_role === "owner",
    );
    if (isOwner) {
      organizationMembers.push({
        userId,
        organizationId: orgId,
        role: "owner",
      });
    }
  }

  return {
    snapshot: {
      user: profileRow,
      organizations,
      shops,
      organizationMembers,
      shopMemberships,
    },
    error: null,
  };
}

function emptySnapshot (authUser: User, displayName: string | null): AccessSnapshot {
  const email = authUser.email ?? "";
  return {
    user: {
      id: authUser.id,
      displayName: displayName ?? email.split("@")[0] ?? "Utilisateur",
      email,
    },
    organizations: [],
    shops: [],
    organizationMembers: [],
    shopMemberships: [],
  };
}
