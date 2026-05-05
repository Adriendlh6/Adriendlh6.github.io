import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAccess } from "../contexts/AccessContext";
import type { PermissionKey } from "../lib/permissions";

const navItems: {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: PermissionKey;
}[] = [
  {
    to: "/",
    label: "Tableau de bord",
    icon: <span aria-hidden>▣</span>,
    permission: "dashboard.read",
  },
  {
    to: "/fournisseurs",
    label: "Fournisseurs",
    icon: <span aria-hidden>◆</span>,
    permission: "suppliers.read",
  },
  {
    to: "/mercuriale",
    label: "Ingrédients / Mercuriale",
    icon: <span aria-hidden>≡</span>,
    permission: "mercurial.read",
  },
  {
    to: "/compte",
    label: "Compte",
    icon: <span aria-hidden>◉</span>,
  },
];

/**
 * Layout principal : barre latérale + zone de contenu.
 * Les pages enfants s'affichent via <Outlet /> (React Router).
 */
export function MainLayout() {
  const [isCompactSidebar, setIsCompactSidebar] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { signOut } = useAuth();
  const {
    snapshot,
    activeShopId,
    setActiveShopId,
    visibleShops,
    activeShop,
    can,
    accessLoading,
    accessError,
    refreshAccess,
  } = useAccess();

  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission) {
      return true;
    }
    return activeShopId ? can(item.permission, { shopId: activeShopId }) : false;
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const apply = (matches: boolean) => setIsCompactSidebar(matches);
    apply(media.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isCompactSidebar) {
      setMobileSidebarOpen(false);
    }
  }, [isCompactSidebar]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100%",
      }}
    >
      {isCompactSidebar && mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Fermer le menu latéral"
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            border: "none",
            background: "rgba(0,0,0,0.22)",
            zIndex: 29,
            cursor: "pointer",
          }}
        />
      )}

      <aside
        style={{
          width: "var(--sidebar-width)",
          flexShrink: 0,
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem 0",
          ...(isCompactSidebar
            ? {
                position: "fixed",
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 30,
                transform: mobileSidebarOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 180ms ease",
                boxShadow: "0 8px 22px rgba(15, 23, 42, 0.16)",
              }
            : {}),
        }}
      >
        <div
          style={{
            padding: "0 1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.125rem",
              letterSpacing: "-0.02em",
            }}
          >
            Bakergest
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: "0.25rem",
            }}
          >
            Gestion boulangerie
          </div>
          {visibleShops.length > 1 ? (
            <label
              style={{
                display: "block",
                marginTop: "0.85rem",
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Boutique active
              <select
                value={activeShopId ?? ""}
                onChange={(e) => setActiveShopId(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "0.35rem",
                  padding: "0.45rem 0.5rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-page)",
                  font: "inherit",
                  fontSize: "0.8125rem",
                  color: "var(--text-primary)",
                }}
              >
                {visibleShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : activeShop ? (
            <div
              style={{
                marginTop: "0.85rem",
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
              }}
            >
              {activeShop.name}
            </div>
          ) : null}
        </div>

        <nav aria-label="Navigation principale" style={{ flex: 1 }}>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "0 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => {
                    if (isCompactSidebar) {
                      setMobileSidebarOpen(false);
                    }
                  }}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "0.65rem",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    border: isActive
                      ? "1px solid rgba(45, 106, 79, 0.15)"
                      : "1px solid transparent",
                  })}
                >
                  <span style={{ opacity: 0.85, width: "1.25rem" }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div
          style={{
            padding: "1rem 1.25rem 0",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-subtle)",
            marginTop: "0.5rem",
          }}
        >
          <>
            <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
              {snapshot.user.displayName}
            </div>
            <div
              style={{
                marginTop: "0.2rem",
                wordBreak: "break-all",
              }}
            >
              {snapshot.user.email}
            </div>
          </>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              marginTop: "0.65rem",
              width: "100%",
              padding: "0.45rem 0.5rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-page)",
              font: "inherit",
              fontSize: "0.8125rem",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            Déconnexion
          </button>
          <div style={{ marginTop: "0.45rem" }}>
            <NavLink
              to="/compte"
              style={({ isActive }) => ({
                display: "inline-block",
                fontSize: "0.8125rem",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              })}
            >
              Gérer mon compte
            </NavLink>
          </div>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: isCompactSidebar ? "1rem 1.1rem" : "1.75rem 2rem",
        }}
      >
        {isCompactSidebar && (
          <div style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-md)",
                padding: "0.45rem 0.6rem",
                cursor: "pointer",
              }}
            >
              ☰ Menu
            </button>
          </div>
        )}
        {accessLoading ? (
          <div style={{ color: "var(--text-muted)" }}>Chargement de l’espace…</div>
        ) : accessError ? (
          <div
            style={{
              padding: "2rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              color: "var(--text-secondary)",
            }}
          >
            <p style={{ margin: 0 }}>{accessError}</p>
            <button
              type="button"
              onClick={() => void refreshAccess()}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
          </div>
        ) : !activeShopId ? (
          <div
            style={{
              padding: "2rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              color: "var(--text-secondary)",
            }}
          >
            Aucune boutique accessible. Terminez l’onboarding ou vérifiez vos
            affectations dans Supabase.
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
