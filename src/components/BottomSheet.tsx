import { useEffect, type ReactNode } from "react";

type BottomSheetProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
};

export function BottomSheet({ isOpen, title, onClose, children, maxWidth = 860 }: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.28)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <section
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "82vh",
          background: "var(--bg-card)",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          borderTop: "1px solid var(--border-subtle)",
          boxShadow: "0 -6px 24px rgba(15, 23, 42, 0.12)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: "0.9rem 1rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-page)",
              borderRadius: "var(--radius-md)",
              padding: "0.3rem 0.5rem",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </header>
        <div style={{ padding: "1rem", overflowY: "auto" }}>{children}</div>
      </section>
    </div>
  );
}
