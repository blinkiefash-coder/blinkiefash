import { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

/**
 * Reusable accessible confirmation dialog.
 * Used for the logout confirmation (Navbar.jsx, Account.jsx) and can be
 * reused anywhere else a "are you sure?" step is needed.
 *
 * Accessibility:
 * - role="dialog" + aria-modal="true" + aria-labelledby/aria-describedby
 * - Focus moves to the Cancel button on open (safe default, not the destructive action)
 * - Tab / Shift+Tab are trapped inside the dialog while it's open
 * - Esc closes and cancels
 * - Focus returns to whatever element triggered the dialog once it closes
 * - Clicking the overlay behaves like Cancel
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const triggerRef = useRef(null); // element that had focus before the dialog opened

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      cancelBtnRef.current?.focus();
    } else {
      triggerRef.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="cd-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="cd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-message"
        ref={dialogRef}
      >
        <h2 id="cd-title" className="cd-title">{title}</h2>
        <p id="cd-message" className="cd-message">{message}</p>
        <div className="cd-actions">
          <button
            type="button"
            className="cd-btn cd-btn-cancel"
            onClick={onCancel}
            ref={cancelBtnRef}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`cd-btn ${destructive ? 'cd-btn-destructive' : 'cd-btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Logging out…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}