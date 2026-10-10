import { useState, useCallback } from "react";
import { StubsSidecarSpec } from "../../types";
import {
  fetchSidecarSpecs,
  fetchSpecDetail,
  saveSpecContent,
  materializeSpec,
} from "../../services/stubsService";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function useStubsSpecs(showToast: (msg: string) => void, onDataUpdated?: () => void) {
  const [specs, setSpecs] = useState<StubsSidecarSpec[]>([]);
  const [activeSpecPath, setActiveSpecPath] = useState<string>("");
  const [specContent, setSpecContent] = useState<string>("");

  const [isLoadingSpecs, setIsLoadingSpecs] = useState(false);
  const [isSavingSpec, setIsSavingSpec] = useState(false);
  const [isMaterializingSpec, setIsMaterializingSpec] = useState(false);

  const [specActionToast, setSpecActionToast] = useState<string | null>(null);

  const selectSpec = useCallback(async (path: string) => {
    setActiveSpecPath(path);
    try {
      const detail = await fetchSpecDetail(path);
      setSpecContent(detail.content);
    } catch (err: unknown) {
      showToast(`Failed to read spec: ${getErrorMessage(err)}`);
    }
  }, [showToast]);

  const loadSpecs = useCallback(async () => {
    setIsLoadingSpecs(true);
    try {
      const res = await fetchSidecarSpecs();
      setSpecs(res.specs);
      if (res.specs.length > 0 && !activeSpecPath) {
        selectSpec(res.specs[0].path);
      }
    } catch (err: unknown) {
      showToast(`Failed to load sidecar specs: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingSpecs(false);
    }
  }, [activeSpecPath, selectSpec, showToast]);

  const saveSpec = useCallback(async () => {
    if (!activeSpecPath) return;
    setIsSavingSpec(true);
    try {
      await saveSpecContent(activeSpecPath, specContent);
      setSpecActionToast(`Saved ${activeSpecPath}`);
      setTimeout(() => setSpecActionToast(null), 3000);
    } catch (err: unknown) {
      showToast(`Failed to save spec: ${getErrorMessage(err)}`);
    } finally {
      setIsSavingSpec(false);
    }
  }, [activeSpecPath, specContent, showToast]);

  const materializeActiveSpec = useCallback(async () => {
    if (!activeSpecPath) return;
    setIsMaterializingSpec(true);
    try {
      const res = await materializeSpec(activeSpecPath);
      setSpecActionToast(res.message);
      setTimeout(() => setSpecActionToast(null), 4000);
      showToast(res.message);
      await loadSpecs();
      if (onDataUpdated) {
        onDataUpdated();
      }
    } catch (err: unknown) {
      showToast(`Materialization failed: ${getErrorMessage(err)}`);
    } finally {
      setIsMaterializingSpec(false);
    }
  }, [activeSpecPath, loadSpecs, showToast, onDataUpdated]);

  return {
    specs,
    activeSpecPath,
    specContent,
    setSpecContent,
    isLoadingSpecs,
    isSavingSpec,
    isMaterializingSpec,
    specActionToast,
    loadSpecs,
    selectSpec,
    saveSpec,
    materializeActiveSpec,
  };
}
