import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  SlidersHorizontal,
  FolderPlus,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { ProjectInfo, KeyVerificationResult } from "../types";
import { getSafeNavigatorClipboard } from "../utils/platform";
import { useServices } from "../services/ServiceContext";
import {
  } from "../utils/storage";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
} from "../utils/modelCatalog";
import { useBackNavigation } from "../hooks/useBackNavigation";

interface ImportProjectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialKey?: string;
  onSuccess: (project: ProjectInfo) => void;
  availableModels?: Array<{ id: string; name: string }>;
}

const DEFAULT_MODELS = CURATED_MODELS.map((m) => ({
  id: m.id,
  name: m.name,
}));

export const ImportProjectSheet: React.FC<ImportProjectSheetProps> = ({
  isOpen,
  onClose,
  initialKey = "",
  onSuccess,
  availableModels = DEFAULT_MODELS,
}) => {
  const { keyVerificationService, logger, projectService } = useServices();

  // Enable device/browser back navigation to dismiss sheet smoothly
  useBackNavigation(isOpen, () => {
    void handleDismiss();
  }, "import-project-sheet");

  const [apiKey, setApiKey] = useState(initialKey);
  const [projectName, setProjectName] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [showRawKey, setShowRawKey] = useState(false);

  // Validation State: 'idle' | 'validating' | 'valid' | 'invalid'
  const [validationState, setValidationState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [validationResult, setValidationResult] = useState<KeyVerificationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or reset when opening with a new key
  useEffect(() => {
    if (isOpen) {
      const projects = projectService.loadStoredProjects();
      const defaultName = `AI Studio Project ${projects.length + 1}`;
      setProjectName(defaultName);
      setSelectedModel("gemini-2.5-flash");
      setShowRawKey(false);
      setIsSaving(false);

      if (initialKey) {
        setApiKey(initialKey);
        void performVerification(initialKey, "gemini-2.5-flash");
      } else {
        setApiKey("");
        setValidationState("idle");
        setValidationResult(null);
      }
    }
  }, [isOpen, initialKey]);

  const performVerification = async (keyToTest: string, modelToTest: string) => {
    const trimmed = keyToTest.trim();
    if (!trimmed) {
      setValidationState("idle");
      setValidationResult(null);
      return;
    }

    if (!keyVerificationService.isValidGoogleApiKeyFormat(trimmed)) {
      setValidationState("invalid");
      setValidationResult({
        valid: false,
        error: "Key format does not match recognized Google AI Studio key patterns (AIza... or AQ....).",
      });
      return;
    }

    setValidationState("validating");
    setValidationResult(null);

    const result = await keyVerificationService.verifyGoogleApiKey(trimmed, modelToTest);

    if (result.valid) {
      setValidationState("valid");
      setValidationResult(result);
    } else {
      setValidationState("invalid");
      setValidationResult(result);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    if (newKey.trim().length >= 20) {
      void performVerification(newKey, selectedModel);
    } else {
      setValidationState("idle");
      setValidationResult(null);
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    if (apiKey.trim()) {
      void performVerification(apiKey, model);
    }
  };

  const handleSaveAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationState !== "valid" && validationState !== "idle") {
      return;
    }

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;

    setIsSaving(true);
    try {
      // 1. Save project & its parameters to encrypted storage and mark as active
      const savedProject = projectService.saveAndActivateProject({
        name: projectName.trim() || "AI Studio Project",
        apiKey: trimmedKey,
        defaultModel: selectedModel,
        lastVerifiedAt: Date.now(),
        isValid: true,
      });

      // 2. Clear device clipboard to prevent lingering credential exposure
      await keyVerificationService.clearClipboardSafe();

      // 3. Callback and dismiss
      onSuccess(savedProject);
      onClose();
    } catch (err: unknown) {
      logger.error("Failed to save and activate project:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Immediate clipboard erasure upon dismissal without saving
  const handleDismiss = async () => {
    try {
      if (Boolean(getSafeNavigatorClipboard()?.readText)) {
        const text = await getSafeNavigatorClipboard()?.readText() || "";
        if (text && keyVerificationService.isValidGoogleApiKeyFormat(text.trim())) {
          await keyVerificationService.clearClipboardSafe();
        }
      }
    } catch {
      // ignore
    }
    onClose();
  };

  const maskedPreview = keyVerificationService.maskApiKey(apiKey);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="import-project-sheet"
          id="import-project-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.26, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              void handleDismiss();
            }
          }}
        >
          <motion.div
            key="import-project-dialog"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 1.26, ease: [0.32, 0.72, 0, 1] }}
            className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-foreground"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-project-title"
          >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              id="import-sheet-back-btn"
              onClick={() => void handleDismiss()}
              className="p-2 -ms-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[44px] min-h-[44px]"
              title="Close sheet"
              aria-label="Back / Close sheet"
            >
              <ArrowLeft className="rtl:rotate-180 w-5 h-5" />
              <span className="text-xs font-semibold sm:inline hidden">Back</span>
            </button>
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="import-project-title" className="text-sm font-semibold text-foreground truncate">
                Import AI Studio Project
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                Configure and activate your Google AI Studio project credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            id="import-sheet-close-btn"
            onClick={() => void handleDismiss()}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
            title="Close sheet"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveAndActivate} className="p-4 space-y-4 overflow-y-auto">
          {/* 1. Project Name input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Project Name
            </label>
            <input
              type="text"
              id="project-name-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Production Gemini Assistant"
              required
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* 2. Masked API key preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground block">
                Google API Key
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await keyVerificationService.clearClipboardSafe();
                  }}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
                  title="Erase sensitive key from device clipboard"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Wipe Clipboard</span>
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {apiKey ? `${apiKey.length} chars` : "Empty"}
                </span>
              </div>
            </div>

            <div className="relative flex items-center">
              <input
                type={showRawKey ? "text" : "password"}
                id="project-key-input"
                value={apiKey}
                onChange={handleKeyChange}
                placeholder="AIzaSy... or AQ...."
                required
                className="w-full bg-background border border-border rounded-xl ps-3 pe-20 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
              />
              <div className="absolute end-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowRawKey(!showRawKey)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  title={showRawKey ? "Hide raw key" : "Show raw key"}
                >
                  {showRawKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => performVerification(apiKey, selectedModel)}
                  disabled={validationState === "validating" || !apiKey.trim()}
                  className="p-1.5 text-primary hover:text-primary/80 rounded-lg hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                  title="Re-verify key with Google"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${validationState === "validating" ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Masked Preview Chip */}
            {apiKey && (
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-primary" />
                  <span>Masked preview:</span>
                </span>
                <span className="font-mono text-foreground font-medium bg-card px-1.5 py-0.5 rounded border border-border">
                  {maskedPreview}
                </span>
              </div>
            )}
          </div>

          {/* 3. Default model selection (defaulting to gemini-2.5-flash) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground block">
                Default Model
              </label>
              <span className="text-[10px] text-primary font-medium">
                gemini-2.5-flash recommended
              </span>
            </div>
            <div className="relative">
              <select
                id="project-default-model-select"
                value={selectedModel}
                onChange={handleModelChange}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground appearance-none focus:outline-none focus:border-primary transition-colors pe-8 cursor-pointer"
              >
                {availableModels
                  .filter((m) => !isDeprecatedOrUnusableModel(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id} className="bg-card text-foreground">
                      {m.name} ({m.id})
                    </option>
                  ))}
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground absolute end-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 4. Real-time validation status feedback */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              Authorization Verification
            </span>

            {validationState === "validating" && (
              <div
                id="validation-state-validating"
                className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs flex items-center gap-2.5 animate-pulse"
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <span>Checking key authorization against Google models endpoint...</span>
              </div>
            )}

            {validationState === "valid" && (
              <div
                id="validation-state-valid"
                className="p-3 rounded-xl bg-muted border border-border text-foreground text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold text-foreground block">Key Verified & Authorized</span>
                  <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">
                    Successfully reached Google Gemini models endpoint using {validationResult?.model || selectedModel}.
                  </span>
                </div>
              </div>
            )}

            {validationState === "invalid" && (
              <div
                id="validation-state-invalid"
                className="p-3 rounded-xl bg-muted/40 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 validation-error-banner"
              >
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5 validation-error-icon" />
                <div className="flex-1">
                  <span className="font-semibold text-foreground block">Verification Failed</span>
                  <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
                    {validationResult?.error || "Key is invalid or unauthorized by Google AI Studio."}
                  </span>
                </div>
              </div>
            )}

            {validationState === "idle" && (
              <div className="p-3 rounded-xl bg-muted border border-border text-muted-foreground text-xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Enter or paste an API key to initiate verification</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={() => void handleDismiss()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer touch-manipulation flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-and-activate-btn"
              disabled={isSaving || validationState === "validating" || validationState === "invalid" || !apiKey.trim()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Save & Activate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
    )}
  </AnimatePresence>
  );
};
