import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { PermissionKey } from "../lib/permissions";
import { useAccess } from "../contexts/AccessContext";

type ShopRouteProps = {
  permission: PermissionKey;
  children: ReactNode;
};

/**
 * Garde V1 : nécessite une boutique active et la permission sur { shopId }.
 */
export function ShopRoute({ permission, children }: ShopRouteProps) {
  const { activeShopId, can } = useAccess();

  if (!activeShopId) {
    return <Navigate to="/" replace />;
  }

  if (!can(permission, { shopId: activeShopId })) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
