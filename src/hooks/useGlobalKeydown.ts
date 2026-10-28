import { useEffect } from "react";
import { useServices } from "../services/ServiceContext";

export function useGlobalKeydown(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    ignoreIfInputFocused?: boolean;
    isActive?: boolean;
  } = {}
) {
  const { platformService } = useServices();
  const {
    ctrlKey = false,
    metaKey = false,
    ignoreIfInputFocused = true,
    isActive = true
  } = options;

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (ignoreIfInputFocused) {
        if (platformService.isInputFocused()) {
          return;
        }
      }

      const isModifierMatch = (ctrlKey || metaKey) ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);

      if (e.key.toLowerCase() === key.toLowerCase() && isModifierMatch) {
        handler(e);
      } else if (e.key === key && isModifierMatch) {
        handler(e);
      }
    };

    const win = platformService.getWindow();
    if (win) {
      win.addEventListener("keydown", handleKeyDown);
      return () => win.removeEventListener("keydown", handleKeyDown);
    }
    return undefined;
  }, [key, handler, ctrlKey, metaKey, ignoreIfInputFocused, isActive, platformService]);
}
