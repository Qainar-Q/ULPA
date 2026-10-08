import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Accessible modal: Esc closes, page scroll locked, focus moved inside. */
export default function Modal({ title, onClose, children, variant = "sheet", labelledBy }) {
  const panelRef = useRef(null);
  // Parents pass a new onClose on every render; keep the latest in a ref so the
  // focus/scroll-lock effect runs only when the modal opens (otherwise focus jumps
  // and the phone keyboard closes while typing).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKey(event) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div className={`modal modal--${variant}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {title && (
          <div className="modal__head">
            <h2>{title}</h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Жабу">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
