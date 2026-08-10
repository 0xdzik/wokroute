import { AnimatePresence, m } from "framer-motion";
import { Maximize2, Minus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getDialogMotion, useMotionProfile } from "../../lib/motion";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  onExited,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  onExited?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onExitedRef = useRef(onExited);
  const closeRequestedRef = useRef(false);
  const [present, setPresent] = useState(open);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const motionProfile = useMotionProfile();
  const dialogMotion = getDialogMotion(motionProfile);
  onCloseRef.current = onClose;
  onExitedRef.current = onExited;

  const requestClose = useCallback(() => {
    if (!present) return;
    closeRequestedRef.current = true;
    setPresent(false);
  }, [present]);

  const handleExitComplete = useCallback(() => {
    if (closeRequestedRef.current) {
      closeRequestedRef.current = false;
      onCloseRef.current();
    }
    onExitedRef.current?.();
  }, []);

  useEffect(() => {
    if (open) {
      closeRequestedRef.current = false;
      setPresent(true);
      setMinimized(false);
      setExpanded(false);
    } else {
      setPresent(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !present) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";
    const focusInitial = () => {
      if (dialogRef.current?.contains(document.activeElement)) return;
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
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
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(focusInitial);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open, present, requestClose]);

  // Portalled to <body>: the routed page sits inside an animated
  // `m.main`, and a transformed ancestor becomes the containing block for
  // `position: fixed`. Rendering in place would centre the dialog on the
  // content column instead of the viewport and leave the sidebar unblurred.
  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {present && (
        <m.div
          className="fixed inset-0 z-90 flex items-center justify-center p-4"
          {...dialogMotion.overlay}
        >
          <button type="button" aria-label="Close dialog" className="absolute inset-0 h-full w-full cursor-default bg-[var(--text-primary)]/40" onClick={requestClose} />
          <m.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-dialog-title"
            tabIndex={-1}
            className={`glass relative flex w-full flex-col ${expanded ? "max-w-4xl max-h-[95vh]" : wide ? "max-w-2xl max-h-[85vh]" : "max-w-md max-h-[85vh]"} rounded-2xl border-[var(--border-subtle)] bg-[var(--surface-1)] p-6`}
            {...dialogMotion.panel}
          >
            <div className="mb-4 flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] pb-4">
              <h2 id="dashboard-dialog-title" className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight">{title}</h2>
              <div className="flex items-center gap-0.5" role="group" aria-label="Window controls">
                <button type="button" onClick={() => setMinimized((value) => !value)} aria-label={minimized ? "Restore dialog" : "Minimize dialog"} title={minimized ? "Restore" : "Minimize"} className="grid size-7 place-items-center rounded-[8px] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]">
                  <Minus size={14} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setExpanded((value) => !value); setMinimized(false); }} aria-label={expanded ? "Restore dialog size" : "Expand dialog"} title={expanded ? "Restore" : "Expand"} className="grid size-7 place-items-center rounded-[8px] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]">
                  <Maximize2 size={13} aria-hidden="true" />
                </button>
                <button type="button" onClick={requestClose} aria-label="Close dialog" title="Close" className="grid size-7 place-items-center rounded-[8px] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]">
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            {!minimized && <>
              <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
              {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
            </>}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
