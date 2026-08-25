import { useEffect, useRef } from "react";
import { MdClose, MdChevronRight } from "react-icons/md";
import "./Categorydrawer.css";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Categorydrawer({
  open,
  parentCategory,
  subcategories,
  onClose,
  onSelect,
  triggerRef,
}) {
  const drawerRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Lock body scroll + focus management on open/close
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const triggerEl = triggerRef?.current; // snapshot the ref value

    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;

      const focusable = drawerRef.current.querySelectorAll(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      // Use the copied value, not triggerRef.current
      (triggerEl || previouslyFocused)?.focus?.();
    };
  }, [open, onClose, triggerRef]);

  return (
    <>
      <div
        className={`cat-drawer-backdrop ${open ? "cat-drawer-backdrop--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={`cat-drawer ${open ? "cat-drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-drawer-heading"
        aria-hidden={!open}
      >
        <header className="cat-drawer-header">
          <nav className="cat-drawer-breadcrumb" aria-label="Breadcrumb">
            <span>All Products</span>
            <MdChevronRight />
            <span id="cat-drawer-heading" className="cat-drawer-current">
              {parentCategory?.name || ""}
            </span>
          </nav>
          <button
            ref={closeBtnRef}
            type="button"
            className="cat-drawer-close"
            onClick={onClose}
            aria-label="Close subcategory panel"
          >
            <MdClose />
          </button>
        </header>

        <div className="cat-drawer-body">
          {parentCategory ? (
            <button
              type="button"
              className="cat-drawer-item cat-drawer-item--all"
              onClick={() => onSelect(parentCategory)}
            >
              All {parentCategory.name}
            </button>
          ) : null}

          {subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className="cat-drawer-item"
              onClick={() => onSelect(sub)}
            >
              {sub.name}
            </button>
          ))}

          {subcategories.length === 0 ? (
            <p className="cat-drawer-empty">No subcategories available.</p>
          ) : null}
        </div>
      </aside>
    </>
  );
}