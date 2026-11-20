import { useServices } from "../services/ServiceContext";
import { useEffect, useRef } from "react";


/**
 * useBackNavigation Hook
 *
 * Enables device back navigation (Android back gesture/button, browser back button,
 * and keyboard navigation) to smoothly dismiss slide-out drawers and modals.
 * When the drawer opens, a history entry is pushed so that pressing "Back"
 * closes the drawer instead of exiting the application or losing workspace context.
 *
 * When the drawer is closed through UI (such as an "X" button at the top right,
 * an on-screen "Back" button, or Escape key), the history entry is cleanly reverted.
 */
const pendingBackReverts = new Map<string, ReturnType<typeof setTimeout>>();

export function useBackNavigation(
  isOpen: boolean,
  onClose: () => void,
  drawerId: string
) {
  const { platformService, timeProvider } = useServices();
  const isPoppedBySystemRef = useRef(false);
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);

  // Keep onClose updated without triggering the effect on every render
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const stateKey = `drawer_${drawerId}`;

    if (!isOpen) {
      pushedRef.current = false;
      return;
    }

    // Cancel any pending history.back() from a StrictMode double-invoke cleanup
    // or immediate close/re-open of the same drawer.
    const pendingRevert = pendingBackReverts.get(stateKey);
    if (pendingRevert !== undefined) {
      clearTimeout(pendingRevert);
      pendingBackReverts.delete(stateKey);
    }

    isPoppedBySystemRef.current = false;
    pushedRef.current = true;

    try {
      const win = platformService.getWindow() as Window & { history?: History };
      const alreadyPushed = Boolean(win?.history?.state && win.history.state[stateKey]);
      if (!alreadyPushed) {
        const state = { [stateKey]: true, drawerId, timestamp: timeProvider.now() };
        win?.history?.pushState(state, "");
      }
    } catch {
      // Ignore security errors in sandboxed environments
    }

    const handlePopState = () => {
      // Ignore popstate if our drawer's state entry is still the active entry
      try {
        const win = platformService.getWindow() as Window & { history?: History };
        if (win?.history?.state && win.history.state[stateKey]) {
          return;
        }
      } catch {
        // Ignore
      }
      // Marked as popped by browser/system back navigation
      isPoppedBySystemRef.current = true;
      onCloseRef.current();
    };

    const removePopState = platformService.addEventListener("popstate", handlePopState);

    return () => {
      removePopState();

      // If closed by UI action (X button, UI Back button, Esc) rather than popstate,
      // defer history.back() by one macrotask so React StrictMode remounts can cancel it
      // without firing a delayed popstate that would immediately close the remounted drawer.
      if (pushedRef.current && !isPoppedBySystemRef.current) {
        const timer = setTimeout(() => {
          pendingBackReverts.delete(stateKey);
          try {
            const win = platformService.getWindow() as Window & { history?: History };
            if (win?.history?.state && win.history.state[stateKey]) {
              win.history.back();
            }
          } catch {
            // Ignore
          }
        }, 0);
        pendingBackReverts.set(stateKey, timer);
      }
      pushedRef.current = false;
    };
  }, [isOpen, drawerId, platformService, timeProvider]);
}
