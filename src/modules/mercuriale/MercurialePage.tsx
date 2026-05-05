import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { mockIngredients } from "../../services/mock/ingredients";

type OptionalColumn = "eanMain" | "stock" | "priceTrend";
type SortKey = "name" | "category" | "price" | "eanMain" | "stock" | "priceTrend";
type SortDirection = "asc" | "desc";

/**
 * Mercuriale : version tableau simple et fonctionnelle.
 */
export function MercurialePage() {
  const [ingredients, setIngredients] = useState(mockIngredients);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"tableau" | "categories">("tableau");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<
    Record<OptionalColumn, boolean>
  >({
    eanMain: false,
    stock: false,
    priceTrend: false,
  });
  const [placeholderMessage, setPlaceholderMessage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isMobileTable, setIsMobileTable] = useState(false);
  const [isDesktopTable, setIsDesktopTable] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [pressedRowId, setPressedRowId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const LONG_PRESS_MS = 450;

  const categories = useMemo(
    () => Array.from(new Set(ingredients.map((i) => i.category))).sort(),
    [ingredients],
  );
  const suppliers = useMemo(
    () => Array.from(new Set(ingredients.map((i) => i.supplierName))).sort(),
    [ingredients],
  );
  const hasActiveFilter = categoryFilter !== "all" || supplierFilter !== "all";

  useEffect(() => {
    const media = window.matchMedia("(max-width: 920px)");
    const apply = (matches: boolean) => setIsMobileTable(matches);
    apply(media.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const apply = (matches: boolean) => setIsDesktopTable(matches);
    apply(media.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const filteredIngredients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = ingredients.filter((ing) => {
      const matchesSearch =
        q.length === 0 ||
        ing.name.toLowerCase().includes(q) ||
        ing.supplierName.toLowerCase().includes(q) ||
        (ing.eanMain ?? "").toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || ing.category === categoryFilter;
      const matchesSupplier = supplierFilter === "all" || ing.supplierName === supplierFilter;
      return matchesSearch && matchesCategory && matchesSupplier;
    });

    const sorted = [...filtered].sort((a, b) => {
      const order = sortDirection === "asc" ? 1 : -1;
      const asText = (value: string | undefined) => (value ?? "").toLowerCase();
      const asNumber = (value: number | undefined) => value ?? Number.NEGATIVE_INFINITY;

      if (sortBy === "name") {
        return asText(a.name).localeCompare(asText(b.name)) * order;
      }
      if (sortBy === "category") {
        return asText(a.category).localeCompare(asText(b.category)) * order;
      }
      if (sortBy === "price") {
        return (a.lastPriceEur - b.lastPriceEur) * order;
      }
      if (sortBy === "eanMain") {
        return asText(a.eanMain).localeCompare(asText(b.eanMain)) * order;
      }
      if (sortBy === "stock") {
        return (asNumber(a.stock) - asNumber(b.stock)) * order;
      }

      const trendRank = (trend?: "up" | "down" | "flat") =>
        trend === "up" ? 2 : trend === "flat" ? 1 : trend === "down" ? 0 : -1;
      return (trendRank(a.priceTrend) - trendRank(b.priceTrend)) * order;
    });

    return sorted;
  }, [search, categoryFilter, supplierFilter, sortBy, sortDirection, ingredients]);

  function onActionClick(action: string) {
    if (action === "Imprimer") {
      if (selectionMode && selectedIds.length > 0) {
        setPlaceholderMessage(`Impression ciblée prête (${selectedIds.length} sélectionné(s)).`);
      } else {
        setPlaceholderMessage("Impression globale prête (fonctionnalité à venir).");
      }
      return;
    }
    setPlaceholderMessage(`Action “${action}” prête (fonctionnalité à venir).`);
  }

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length === 0) {
        setSelectionMode(false);
      } else if (!selectionMode) {
        setSelectionMode(true);
      }
      return next;
    });
  }

  function startLongPress(id: string) {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTriggeredRef.current = false;
    setIsLongPressing(true);
    setPressedRowId(id);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSelectionMode(true);
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, LONG_PRESS_MS);
  }

  function clearLongPress() {
    setIsLongPressing(false);
    setPressedRowId(null);
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function onRowClick(id: string) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (selectionMode) {
      toggleRowSelection(id);
    }
  }

  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    setSelectionMode(true);
    toggleRowSelection(id);
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function deleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }
    const label = selectedIds.length > 1 ? "éléments" : "élément";
    const confirmed = window.confirm(`Supprimer ${selectedIds.length} ${label} ?`);
    if (!confirmed) {
      return;
    }
    setIngredients((prev) => prev.filter((ing) => !selectedIds.includes(ing.id)));
    setPlaceholderMessage(`${selectedIds.length} ligne(s) supprimée(s).`);
    cancelSelection();
  }

  function toggleOptionalColumn(column: OptionalColumn) {
    setVisibleOptionalColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  }

  function handleSort(nextSortBy: SortKey) {
    setSortBy((prevSortBy) => {
      if (prevSortBy === nextSortBy) {
        setSortDirection((prevDirection) => (prevDirection === "asc" ? "desc" : "asc"));
        return prevSortBy;
      }
      setSortDirection("asc");
      return nextSortBy;
    });
  }

  function sortIndicator(column: SortKey) {
    if (sortBy !== column) {
      return "↕";
    }
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function renderTrendArrow(value?: "up" | "down" | "flat") {
    if (value === "up") {
      return (
        <span title="Hausse" style={{ color: "#dc2626", fontWeight: 700 }}>
          ↑
        </span>
      );
    }
    if (value === "down") {
      return (
        <span title="Baisse" style={{ color: "#2563eb", fontWeight: 700 }}>
          ↓
        </span>
      );
    }
    if (value === "flat") {
      return (
        <span title="Stable" style={{ color: "#16a34a", fontWeight: 700 }}>
          →
        </span>
      );
    }
    return <span>—</span>;
  }

  return (
    <div>
      <header style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--accent)",
            }}
          >
            Mercuriale
          </h1>
          <button type="button" title="Aide bientôt disponible" style={titleInfoButton}>
            i
          </button>
        </div>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)" }}>
          Gérez vos matières premières et leurs coûts.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
          rowGap: isMobileTable ? "0.4rem" : "0.5rem",
        }}
      >
        <button type="button" onClick={() => onActionClick("Imprimer")} style={actionButton}>
          <span aria-hidden>🖨</span>
        </button>
        {selectionMode && (
          <button type="button" onClick={deleteSelected} style={deleteActionButton}>
            <span aria-hidden>🗑</span>
          </button>
        )}
        <button type="button" onClick={() => onActionClick("Scanner")} style={actionButton}>
          <span aria-hidden>▦</span>
        </button>
        <button type="button" onClick={() => onActionClick("Ajouter")} style={addActionButton}>
          <span aria-hidden>＋</span>
        </button>
        <button
          type="button"
          onClick={() => setIsSettingsSheetOpen(true)}
          style={actionButton}
        >
          <span aria-hidden>⚙</span>
        </button>
      </div>

      {selectionMode && (
        <div style={selectionBar}>
          <strong>{selectedIds.length} sélectionné(s)</strong>
          <button type="button" onClick={cancelSelection} style={cancelSelectionButton}>
            Annuler
          </button>
        </div>
      )}

      <BottomSheet
        isOpen={isSettingsSheetOpen}
        title="Paramètres Mercuriale"
        onClose={() => setIsSettingsSheetOpen(false)}
      >
        <div style={sheetTabs}>
          <button
            type="button"
            onClick={() => setSettingsTab("tableau")}
            style={settingsTab === "tableau" ? activeSheetTabButton : sheetTabButton}
          >
            Tableau
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab("categories")}
            style={settingsTab === "categories" ? activeSheetTabButton : sheetTabButton}
          >
            Catégories
          </button>
        </div>
        {settingsTab === "tableau" ? (
          <div style={settingsPanel}>
            <strong style={{ display: "block", marginBottom: "0.5rem" }}>
              Colonnes optionnelles
            </strong>
            <label style={settingsLabel}>
              <input
                type="checkbox"
                checked={visibleOptionalColumns.eanMain}
                onChange={() => toggleOptionalColumn("eanMain")}
              />
              EAN principale
            </label>
            <label style={settingsLabel}>
              <input
                type="checkbox"
                checked={visibleOptionalColumns.stock}
                onChange={() => toggleOptionalColumn("stock")}
              />
              Stock
            </label>
            <label style={settingsLabel}>
              <input
                type="checkbox"
                checked={visibleOptionalColumns.priceTrend}
                onChange={() => toggleOptionalColumn("priceTrend")}
              />
              Variation du prix
            </label>
          </div>
        ) : (
          <div style={categoryTabPanel}>
            <strong>Gestion des catégories</strong>
            <p style={{ margin: "0.45rem 0 0", color: "var(--text-secondary)" }}>
              Cet onglet accueillera l’ajout, la fusion et l’archivage des catégories.
            </p>
          </div>
        )}
      </BottomSheet>

      {placeholderMessage && (
        <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          {placeholderMessage}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobileTable ? "1fr auto" : "minmax(220px, 1fr) auto",
          gap: "0.5rem",
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, EAN, fournisseur..."
          style={filterInput}
        />

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowFiltersPanel((prev) => !prev)}
            style={filterButton}
          >
            Filtres
            {hasActiveFilter && <span style={filterDot} aria-hidden />}
          </button>

          {showFiltersPanel && (
            <div style={filtersPanel}>
              <label style={settingsLabel}>
                Catégories
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={panelInput}
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label style={settingsLabel}>
                Fournisseur
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  style={panelInput}
                >
                  <option value="all">Tous les fournisseurs</option>
                  {suppliers.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      <div style={tableWrapper}>
        <table style={{ ...tableStyle, minWidth: isMobileTable ? 560 : 720 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, ...(isDesktopTable ? fixedNameColumnHeader : null) }}>
                <button type="button" onClick={() => handleSort("name")} style={thButton}>
                  Nom <span>{sortIndicator("name")}</span>
                </button>
              </th>
              <th style={{ ...thStyle, ...(isDesktopTable ? fixedCategoryColumnHeader : null) }}>
                <button type="button" onClick={() => handleSort("category")} style={thButton}>
                  Catégories <span>{sortIndicator("category")}</span>
                </button>
              </th>
              <th style={{ ...thStyle, ...(isDesktopTable ? fixedPriceColumnHeader : null) }}>
                <button type="button" onClick={() => handleSort("price")} style={thButton}>
                  Prix HT <span>{sortIndicator("price")}</span>
                </button>
              </th>
              {visibleOptionalColumns.eanMain && (
                <th style={{ ...thStyle, ...(isDesktopTable ? optionalColumnHeader : null) }}>
                  <button type="button" onClick={() => handleSort("eanMain")} style={thButton}>
                    EAN principale <span>{sortIndicator("eanMain")}</span>
                  </button>
                </th>
              )}
              {visibleOptionalColumns.stock && (
                <th style={{ ...thStyle, ...(isDesktopTable ? optionalColumnHeader : null) }}>
                  <button type="button" onClick={() => handleSort("stock")} style={thButton}>
                    Stock <span>{sortIndicator("stock")}</span>
                  </button>
                </th>
              )}
              {visibleOptionalColumns.priceTrend && (
                <th style={{ ...thStyle, ...(isDesktopTable ? optionalColumnHeader : null) }}>
                  <button type="button" onClick={() => handleSort("priceTrend")} style={thButton}>
                    Variation du prix <span>{sortIndicator("priceTrend")}</span>
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    3 +
                    Number(visibleOptionalColumns.eanMain) +
                    Number(visibleOptionalColumns.stock) +
                    Number(visibleOptionalColumns.priceTrend)
                  }
                  style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}
                >
                  Aucune matière première ne correspond à vos filtres.
                </td>
              </tr>
            ) : (
              filteredIngredients.map((ing) => {
                const isSelected = selectedIds.includes(ing.id);
                return (
                <tr
                  key={ing.id}
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => onRowClick(ing.id)}
                  onKeyDown={(e) => onRowKeyDown(e, ing.id)}
                  onMouseDown={() => startLongPress(ing.id)}
                  onMouseUp={clearLongPress}
                  onMouseLeave={clearLongPress}
                  onTouchStart={() => startLongPress(ing.id)}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
                  style={{
                    ...(pressedRowId === ing.id ? pressedRowStyle : undefined),
                    ...(isSelected ? selectedRowStyle : undefined),
                    userSelect: isLongPressing ? "none" : "text",
                    WebkitUserSelect: isLongPressing ? "none" : "text",
                  }}
                >
                  <td
                    style={{
                      ...tdStyle,
                      ...(isMobileTable ? tdStyleMobile : null),
                      ...(isDesktopTable ? fixedNameColumnCell : null),
                    }}
                  >
                    <div style={ingredientNameStyle}>{ing.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {ing.supplierName}
                    </div>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      ...(isMobileTable ? tdStyleMobile : null),
                      ...(isDesktopTable ? fixedCategoryColumnCell : null),
                    }}
                  >
                    {ing.category}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      ...(isMobileTable ? tdStyleMobile : null),
                      ...(isDesktopTable ? fixedPriceColumnCell : null),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ing.lastPriceEur.toFixed(2).replace(".", ",")} € / {ing.unit}
                  </td>
                  {visibleOptionalColumns.eanMain && (
                    <td
                      style={{
                        ...tdStyle,
                        ...(isMobileTable ? tdStyleMobile : null),
                        ...(isDesktopTable ? optionalColumnCell : null),
                      }}
                    >
                      {ing.eanMain ?? "—"}
                    </td>
                  )}
                  {visibleOptionalColumns.stock && (
                    <td
                      style={{
                        ...tdStyle,
                        ...(isMobileTable ? tdStyleMobile : null),
                        ...(isDesktopTable ? optionalColumnCell : null),
                      }}
                    >
                      {typeof ing.stock === "number" ? ing.stock : "—"}
                    </td>
                  )}
                  {visibleOptionalColumns.priceTrend && (
                    <td
                      style={{
                        ...tdStyle,
                        ...(isMobileTable ? tdStyleMobile : null),
                        ...(isDesktopTable ? optionalColumnCell : null),
                      }}
                    >
                      {renderTrendArrow(ing.priceTrend)}
                    </td>
                  )}
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const actionButton: React.CSSProperties = {
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  borderRadius: "var(--radius-md)",
  width: 40,
  height: 40,
  cursor: "pointer",
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "1rem",
};

const addActionButton: React.CSSProperties = {
  ...actionButton,
  borderColor: "var(--accent)",
  color: "var(--accent)",
};

const deleteActionButton: React.CSSProperties = {
  ...actionButton,
  borderColor: "#dc2626",
  color: "#dc2626",
};

const titleInfoButton: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "999px",
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  fontSize: "0.75rem",
  fontWeight: 700,
  lineHeight: 1,
  cursor: "help",
};

const settingsPanel: React.CSSProperties = {
  marginBottom: "1rem",
  padding: "0.75rem 0.9rem",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  display: "inline-grid",
  gap: "0.45rem",
};

const settingsLabel: React.CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  color: "var(--text-secondary)",
  fontSize: "0.9rem",
};

const filterInput: React.CSSProperties = {
  width: "100%",
  height: 40,
  boxSizing: "border-box",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  padding: "0 0.65rem",
};

const filterButton: React.CSSProperties = {
  height: 40,
  boxSizing: "border-box",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  padding: "0 0.8rem",
  cursor: "pointer",
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const filterDot: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 7,
  height: 7,
  borderRadius: "999px",
  background: "var(--accent)",
};

const filtersPanel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 0.4rem)",
  right: 0,
  zIndex: 20,
  minWidth: 220,
  padding: "0.65rem",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  display: "grid",
  gap: "0.55rem",
  boxShadow: "var(--shadow-card)",
};

const selectionBar: React.CSSProperties = {
  marginBottom: "1rem",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  padding: "0.55rem 0.7rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const cancelSelectionButton: React.CSSProperties = {
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-page)",
  color: "var(--text-primary)",
  padding: "0.35rem 0.6rem",
  cursor: "pointer",
};

const panelInput: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-page)",
  color: "var(--text-primary)",
  padding: "0.45rem 0.5rem",
};

const tableWrapper: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 720,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: "0.78rem",
  color: "var(--text-muted)",
  fontWeight: 600,
  padding: "0.7rem 0.75rem",
  borderBottom: "1px solid var(--border-subtle)",
};

const tdStyleMobile: React.CSSProperties = {
  padding: "0.55rem 0.45rem",
};

const thButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: 0,
  cursor: "pointer",
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem",
  borderBottom: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  verticalAlign: "top",
};

const ingredientNameStyle: React.CSSProperties = {
  fontWeight: 600,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  textOverflow: "ellipsis",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  lineHeight: 1.25,
  maxWidth: "clamp(8rem, 24vw, 17rem)",
};

const selectedRowStyle: React.CSSProperties = {
  background: "var(--accent-soft)",
};

const pressedRowStyle: React.CSSProperties = {
  filter: "brightness(0.98)",
  outline: "1px dashed var(--accent)",
  outlineOffset: "-1px",
};

const fixedNameColumnHeader: React.CSSProperties = {
  width: 380,
  minWidth: 380,
  maxWidth: 380,
};

const fixedCategoryColumnHeader: React.CSSProperties = {
  width: 220,
  minWidth: 220,
  maxWidth: 220,
};

const fixedPriceColumnHeader: React.CSSProperties = {
  width: 190,
  minWidth: 190,
  maxWidth: 190,
};

const optionalColumnHeader: React.CSSProperties = {
  minWidth: 140,
  width: "auto",
};

const fixedNameColumnCell: React.CSSProperties = {
  width: 380,
  minWidth: 380,
  maxWidth: 380,
};

const fixedCategoryColumnCell: React.CSSProperties = {
  width: 220,
  minWidth: 220,
  maxWidth: 220,
};

const fixedPriceColumnCell: React.CSSProperties = {
  width: 190,
  minWidth: 190,
  maxWidth: 190,
};

const optionalColumnCell: React.CSSProperties = {
  minWidth: 140,
};

const sheetTabs: React.CSSProperties = {
  display: "flex",
  gap: "0.45rem",
  marginBottom: "0.85rem",
};

const sheetTabButton: React.CSSProperties = {
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-page)",
  color: "var(--text-secondary)",
  borderRadius: "var(--radius-md)",
  padding: "0.45rem 0.7rem",
  cursor: "pointer",
};

const activeSheetTabButton: React.CSSProperties = {
  ...sheetTabButton,
  borderColor: "var(--accent)",
  color: "var(--accent)",
  background: "var(--accent-soft)",
};

const categoryTabPanel: React.CSSProperties = {
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  padding: "0.75rem 0.9rem",
};
