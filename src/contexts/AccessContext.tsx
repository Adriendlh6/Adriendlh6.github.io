import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PermissionScope } from "../types/auth";
import { can as canEval, getVisibleShops, type AccessSnapshot } from "../lib/access";
import type { PermissionKey } from "../lib/permissions";
import type { Shop } from "../types/organization";
import { useAuth } from "./AuthContext";
import { fetchAccessSnapshot } from "../services/access/fetchAccessSnapshot";

type AccessContextValue = {
  snapshot: AccessSnapshot;
  activeShopId: string | null;
  setActiveShopId: (id: string) => void;
  visibleShops: Shop[];
  activeShop: Shop | null;
  can: (permission: PermissionKey, scope: PermissionScope) => boolean;
  accessLoading: boolean;
  accessError: string | null;
  refreshAccess: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

type AccessProviderProps = {
  children: ReactNode;
};

export function AccessProvider({ children }: AccessProviderProps) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<AccessSnapshot | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const refreshAccess = useCallback(async () => {
    if (!user) {
      setSnapshot(null);
      setAccessLoading(false);
      setAccessError(null);
      return;
    }
    setAccessLoading(true);
    setAccessError(null);
    const { snapshot: next, error } = await fetchAccessSnapshot(user);
    setAccessLoading(false);
    if (error) {
      setAccessError(error.message);
    }
    setSnapshot(next);
  }, [user]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  const effectiveSnapshot = snapshot;

  const visibleShops = useMemo(
    () => (effectiveSnapshot ? getVisibleShops(effectiveSnapshot) : []),
    [effectiveSnapshot],
  );

  const [activeShopId, setActiveShopIdState] = useState<string | null>(null);

  useEffect(() => {
    if (visibleShops.length === 0) {
      setActiveShopIdState(null);
      return;
    }
    const stillValid = activeShopId && visibleShops.some((s) => s.id === activeShopId);
    if (!stillValid) {
      setActiveShopIdState(visibleShops[0].id);
    }
  }, [visibleShops, activeShopId]);

  const setActiveShopId = useCallback((id: string) => {
    setActiveShopIdState(id);
  }, []);

  const activeShop = useMemo(() => {
    if (!activeShopId) {
      return null;
    }
    return visibleShops.find((s) => s.id === activeShopId) ?? null;
  }, [activeShopId, visibleShops]);

  const safeActiveShopId = activeShop?.id ?? null;

  const can = useCallback(
    (permission: PermissionKey, scope: PermissionScope) => {
      if (!effectiveSnapshot) {
        return false;
      }
      return canEval(effectiveSnapshot, permission, scope);
    },
    [effectiveSnapshot],
  );

  const fallbackSnapshot: AccessSnapshot = useMemo(
    () =>
      user
        ? {
            user: {
              id: user.id,
              displayName: user.email?.split("@")[0] ?? "…",
              email: user.email ?? "",
            },
            organizations: [],
            shops: [],
            organizationMembers: [],
            shopMemberships: [],
          }
        : {
            user: { id: "", displayName: "", email: "" },
            organizations: [],
            shops: [],
            organizationMembers: [],
            shopMemberships: [],
          },
    [user],
  );

  const valueSnapshot = effectiveSnapshot ?? fallbackSnapshot;

  const value = useMemo<AccessContextValue>(
    () => ({
      snapshot: valueSnapshot,
      activeShopId: safeActiveShopId,
      setActiveShopId,
      visibleShops,
      activeShop,
      can,
      accessLoading,
      accessError,
      refreshAccess,
    }),
    [
      valueSnapshot,
      safeActiveShopId,
      setActiveShopId,
      visibleShops,
      activeShop,
      can,
      accessLoading,
      accessError,
      refreshAccess,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Hook consommateur du contexte d’accès. */
// eslint-disable-next-line react-refresh/only-export-components -- hook pairé au provider du même module
export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useAccess must be used within AccessProvider");
  }
  return ctx;
}
