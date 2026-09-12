import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { ProjectInfo, KeyVerificationResult } from "../types";
import {
  maskApiKey,
  verifyGoogleApiKey,
  clearClipboardSafe,
  isValidGoogleApiKeyFormat,
} from "../services/keyVerification";
import {
  saveAndActivateProject,
  loadStoredProjects,
} from "../utils/storage";

interface ImportProjectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialKey?: string;
  onSuccess: (project: ProjectInfo) => void;
  availableModels?: Array<{ id: string; name: string }>;
}

const DEFAULT_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Default)" },
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
];

export const ImportProjectSheet: React.FC<ImportProjectSheetProps> = ({
  isOpen,
  onClose,
  initialKey = "",
  onSuccess,
  availableModels = DEFAULT_MODELS,
}) => {
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
      const projects = loadStoredProjects();
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

    if (!isValidGoogleApiKeyFormat(trimmed)) {
      setValidationState("invalid");
      setValidationResult({
        valid: false,
        error: "Key format does not match recognized Google AI Studio key patterns (AIza... or AQ....).",
      });
      return;
    }

    setValidationState("validating");
    setValidationResult(null);

    const result = await verifyGoogleApiKey(trimmed, modelToTest);

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
      const savedProject = saveAndActivateProject({
        name: projectName.trim() || "AI Studio Project",
        apiKey: trimmedKey,
        defaultModel: selectedModel,
        lastVerifiedAt: Date.now(),
        isValid: true,
      });

      // 2. Clear device clipboard to prevent lingering credential exposure
      await clearClipboardSafe();

      // 3. Callback and dismiss
      onSuccess(savedProject);
      onClose();
    } catch (err) {
      console.error("Failed to save and activate project:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Immediate clipboard erasure upon dismissal without saving
  const handleDismiss = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && isValidGoogleApiKeyFormat(text.trim())) {
          await clearClipboardSafe();
        }
      }
    } catch {
      // ignore
    }
    onClose();
  };

  if (!isOpen) return null;

  const maskedPreview = maskApiKey(apiKey);

  return (
    <div
      id="import-project-sheet"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          void handleDismiss();
        }
      }}
    >
      <div
        className="w-full max-w-lg bg-[#17181c] border-t sm:border border-[#2b2c31] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-project-title"
      >
        {/* Sheet Top Grabber (Mobile) */}
        <div className="sm:hidden w-12 h-1.5 bg-[#2d2e35] rounded-full mx-auto mt-2.5" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2b2c31] bg-[#1a1b20]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="import-project-title" className="text-sm font-semibold text-white">
                Import AI Studio Project
              </h2>
              <p className="text-[11px] text-[#9aa0a6]">
                Configure and activate your Google AI Studio project credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#25272e] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveAndActivate} className="p-4 space-y-4 overflow-y-auto">
          {/* 1. Project Name input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Project Name
            </label>
            <input
              type="text"
              id="project-name-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Production Gemini Assistant"
              required
              className="w-full bg-[#1a1b20] border border-[#2b2c31] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 2. Masked API key preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 block">
                Google API Key
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await clearClipboardSafe();
                  }}
                  className="text-[10px] text-zinc-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                  title="Erase sensitive key from device clipboard"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Wipe Clipboard</span>
                </button>
                <span className="text-[10px] text-zinc-500 font-mono">
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
                className="w-full bg-[#1a1b20] border border-[#2b2c31] rounded-xl pl-3 pr-20 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowRawKey(!showRawKey)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#252830] transition-colors"
                  title={showRawKey ? "Hide raw key" : "Show raw key"}
                >
                  {showRawKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => performVerification(apiKey, selectedModel)}
                  disabled={validationState === "validating" || !apiKey.trim()}
                  className="p-1.5 text-blue-400 hover:text-blue-300 rounded-lg hover:bg-[#252830] transition-colors disabled:opacity-40"
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
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[#141518] border border-[#26282f] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>Masked preview:</span>
                </span>
                <span className="font-mono text-white font-medium bg-[#1d1f25] px-1.5 py-0.5 rounded border border-[#2c2e38]">
                  {maskedPreview}
                </span>
              </div>
            )}
          </div>

          {/* 3. Default model selection (defaulting to gemini-2.5-flash) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 block">
                Default Model
              </label>
              <span className="text-[10px] text-blue-400 font-medium">
                gemini-2.5-flash default
              </span>
            </div>
            <div className="relative">
              <select
                id="project-default-model-select"
                value={selectedModel}
                onChange={handleModelChange}
                className="w-full bg-[#1a1b20] border border-[#2b2c31] rounded-xl px-3 py-2.5 text-xs text-white appearance-none focus:outline-none focus:border-blue-500 transition-colors pr-8 cursor-pointer"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1a1b20] text-white">
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 4. Real-time validation status feedback */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
              Authorization Verification
            </span>

            {validationState === "validating" && (
              <div
                id="validation-state-validating"
                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2.5 animate-pulse"
              >
                <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                <span>Checking key authorization against Google models endpoint...</span>
              </div>
            )}

            {validationState === "valid" && (
              <div
                id="validation-state-valid"
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Key Verified & Authorized</span>
                  <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
                    Successfully reached Google Gemini models endpoint using {validationResult?.model || selectedModel}.
                  </span>
                </div>
              </div>
            )}

            {validationState === "invalid" && (
              <div
                id="validation-state-invalid"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Verification Failed</span>
                  <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
                    {validationResult?.error || "Key is invalid or unauthorized by Google AI Studio."}
                  </span>
                </div>
              </div>
            )}

            {validationState === "idle" && (
              <div className="p-3 rounded-xl bg-[#131417] border border-[#25262c] text-zinc-400 text-xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                <span>Enter or paste an API key to initiate verification</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#2b2c31]">
            <button
              type="button"
              onClick={() => void handleDismiss()}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-[#25272e] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-and-activate-btn"
              disabled={isSaving || validationState === "validating" || validationState === "invalid" || !apiKey.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
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
      </div>
    </div>
  );
};
