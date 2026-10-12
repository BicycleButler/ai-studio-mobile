import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sliders,
  RotateCcw,
  FileJson,
  Layers,
  X,
  Key,
  ShieldCheck,
  Check,
  Sparkles,
  Zap,
  Brain,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { PromptConfig, ModelInfo } from "../types";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  sanitizeModelId,
} from "../utils/modelCatalog";
import { useBackNavigation } from "../hooks/useBackNavigation";
import { safeAddEventListener } from "../utils/platform";

interface TunerBottomSheetProps {
  config: PromptConfig;
  onChangeConfig: (newConfig: PromptConfig) => void;
  models: ModelInfo[];
  onClose?: () => void;
  isModal?: boolean;
  isOpen?: boolean;
  hasApiKey?: boolean;
  onOpenAuth?: () => void;
}

export const TunerBottomSheet: React.FC<TunerBottomSheetProps> = ({
  config,
  onChangeConfig,
  models,
  onClose,
  isModal = false,
  isOpen = true,
  hasApiKey = false,
  onOpenAuth,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Device/browser back navigation support
  useBackNavigation(Boolean(isModal && onClose), onClose || (() => {}), "tuner-drawer");

  // Filter out any deprecated, legacy, or unusable non-chat models
  const cleanModels = useMemo(() => {
    const source = models && models.length > 0 ? models : CURATED_MODELS;
    const filtered = source.filter((m) => !isDeprecatedOrUnusableModel(m.id));
    return filtered.length > 0 ? filtered : CURATED_MODELS;
  }, [models]);

  // Guard against deprecated/unusable model saved in config
  useEffect(() => {
    if (isDeprecatedOrUnusableModel(config.model)) {
      onChangeConfig({
        ...config,
        model: sanitizeModelId(config.model),
      });
    }
  }, [config.model, onChangeConfig, config]);

  // Distinct category filters
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    cleanModels.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [cleanModels]);

  const displayedModels = useMemo(() => {
    if (activeCategory === "All") return cleanModels;
    return cleanModels.filter((m) => m.category === activeCategory);
  }, [cleanModels, activeCategory]);

  useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isModal, onClose]);

  const updateField = <K extends keyof PromptConfig>(
    field: K,
    value: PromptConfig[K]
  ) => {
    onChangeConfig({ ...config, [field]: value });
  };

  const handleResetDefaults = () => {
    onChangeConfig({
      model: "gemini-3.8-flash",
      systemInstruction: "",
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
      responseMimeType: "text/plain",
      responseSchemaText: "",
    });
  };

  const getTemperatureDescription = (temp: number) => {
    if (temp <= 0.2) return "Deterministic • Best for code, math & structured JSON";
    if (temp <= 0.7) return "Focused & accurate • Standard factual reasoning";
    if (temp <= 1.2) return "Balanced • Recommended AI Studio default";
    return "High variance • Highly creative, conversational & exploratory";
  };

  // Schema validation status
  const schemaStatus = useMemo(() => {
    if (!config.responseSchemaText?.trim()) return null;
    try {
      JSON.parse(config.responseSchemaText);
      return { valid: true, message: "Valid JSON schema" };
    } catch {
      return { valid: false, message: "Invalid JSON syntax" };
    }
  }, [config.responseSchemaText]);

  const handleInsertSampleSchema = () => {
    const sampleSchema = {
      type: "object",
      properties: {
        summary: { type: "string", description: "Brief executive summary" },
        keyPoints: {
          type: "array",
          items: { type: "string" },
          description: "List of actionable takeaways",
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative"],
        },
      },
      required: ["summary", "keyPoints"],
    };
    updateField("responseSchemaText", JSON.stringify(sampleSchema, null, 2));
  };

  const selectedModelInfo = cleanModels.find((m) => m.id === config.model);

  const bodyFields = (
    <div className="space-y-5">
      {/* Authentication Status Card */}
      <div
        id="tuner-auth-card"
        onClick={onOpenAuth}
        className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/50 flex items-center justify-between gap-3 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-muted text-foreground shrink-0">
            {hasApiKey ? (
              <ShieldCheck className="w-4 h-4 text-primary" />
            ) : (
              <Key className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-xs text-foreground block truncate">
              {hasApiKey ? "AI Studio Authenticated" : "Authentication Required"}
            </span>
            <span className="text-[11px] block text-muted-foreground truncate">
              {hasApiKey
                ? "Connected to Gemini • Tap to manage keys"
                : "Tap to connect API credentials"}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-border bg-muted text-foreground shrink-0 font-mono">
          {hasApiKey ? "Connected" : "Authenticate"}
        </span>
      </div>

      {/* 1. Model Selection */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Select Model</span>
          </label>
          {selectedModelInfo && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Active: <strong className="text-primary font-semibold">{selectedModelInfo.name}</strong>
            </span>
          )}
        </div>

        {/* Category Pills */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Clean Model Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {displayedModels.map((m) => {
            const isSelected = config.model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => updateField("model", m.id)}
                className={`text-start p-3 rounded-xl border transition relative cursor-pointer group ${
                  isSelected
                    ? "bg-primary/10 border-primary ring-1 ring-primary/30 text-foreground"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : m.category === "Complex Reasoning" ? (
                      <Brain className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : m.category === "High Speed" ? (
                      <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-foreground truncate">
                      {m.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground/70 shrink-0 uppercase tracking-wider">
                    {m.badge}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                  {m.description}
                </p>

                <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-muted/80 font-mono">
                    {m.contextWindow}
                  </span>
                  {m.supportsVision && (
                    <span className="px-1.5 py-0.5 rounded bg-muted/80 font-medium text-foreground">
                      Vision
                    </span>
                  )}
                  {m.supportsAudio && (
                    <span className="px-1.5 py-0.5 rounded bg-muted/80 font-medium text-foreground">
                      Audio
                    </span>
                  )}
                  {m.supportsJson && (
                    <span className="px-1.5 py-0.5 rounded bg-muted/80 font-medium text-foreground">
                      JSON
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. System Instruction */}
      <div className="space-y-1.5 bg-card border border-border rounded-xl p-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            System Instructions
          </label>
          <div className="flex items-center gap-2">
            {config.systemInstruction.length > 0 && (
              <button
                type="button"
                onClick={() => updateField("systemInstruction", "")}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            <span className="text-[10px] text-muted-foreground font-mono">
              {config.systemInstruction.length} chars
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Steer model behavior, tone, style, and guardrails across turns.
        </p>
        <textarea
          id="tuner-sys-prompt"
          value={config.systemInstruction}
          onChange={(e) => updateField("systemInstruction", e.target.value)}
          placeholder="You are an intelligent, concise AI assistant inside Google AI Studio..."
          rows={3}
          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
        />
      </div>

      {/* 3. Temperature Slider & Presets */}
      <div className="space-y-2 bg-card border border-border rounded-xl p-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            Temperature
          </label>
          <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
            {config.temperature.toFixed(2)}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={config.temperature}
          onChange={(e) => updateField("temperature", parseFloat(e.target.value))}
          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />

        {/* Quick Temperature Presets */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {[
            { label: "0.2 Code", val: 0.2 },
            { label: "0.7 Precise", val: 0.7 },
            { label: "1.0 Default", val: 1.0 },
            { label: "1.5 Creative", val: 1.5 },
          ].map((preset) => {
            const isPresetActive = Math.abs(config.temperature - preset.val) < 0.05;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateField("temperature", preset.val)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  isPresetActive
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground italic mt-0.5">
          {getTemperatureDescription(config.temperature)}
        </p>
      </div>

      {/* 4. Top P and Top K */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Top P */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Top P</label>
            <span className="text-xs font-mono font-bold text-foreground">
              {config.topP.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.topP}
            onChange={(e) => updateField("topP", parseFloat(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <p className="text-[10px] text-muted-foreground">
            Nucleus sampling probability mass cutoff.
          </p>
        </div>

        {/* Top K */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Top K</label>
            <span className="text-xs font-mono font-bold text-foreground">
              {config.topK}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={config.topK}
            onChange={(e) => updateField("topK", parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <p className="text-[10px] text-muted-foreground">
            Restricts candidates to the top K most likely tokens.
          </p>
        </div>
      </div>

      {/* 5. Max Output Tokens */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            Max Output Tokens
          </label>
          <span className="text-xs font-mono font-bold text-foreground">
            {config.maxOutputTokens}
          </span>
        </div>
        <input
          type="range"
          min="128"
          max="8192"
          step="128"
          value={config.maxOutputTokens}
          onChange={(e) =>
            updateField("maxOutputTokens", parseInt(e.target.value, 10))
          }
          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        {/* Token Presets */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {[
            { label: "1,024", val: 1024 },
            { label: "2,048 (Def)", val: 2048 },
            { label: "4,096", val: 4096 },
            { label: "8,192", val: 8192 },
          ].map((preset) => {
            const isPresetActive = config.maxOutputTokens === preset.val;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateField("maxOutputTokens", preset.val)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  isPresetActive
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Structured Output (JSON Schema Mode) */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-primary" />
              Structured Output (JSON)
            </label>
            <p className="text-[10px] text-muted-foreground">
              Forces response to conform to strict JSON schema
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              updateField(
                "responseMimeType",
                config.responseMimeType === "application/json"
                  ? "text/plain"
                  : "application/json"
              )
            }
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              config.responseMimeType === "application/json"
                ? "bg-primary justify-end"
                : "bg-muted justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-background shadow-sm" />
          </button>
        </div>

        {config.responseMimeType === "application/json" && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground block">
                JSON Schema Definition
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSampleSchema}
                  className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                >
                  Insert Sample Schema
                </button>
                {schemaStatus && (
                  <span
                    className={`text-[10px] flex items-center gap-1 font-mono ${
                      schemaStatus.valid ? "text-primary" : "text-destructive validation"
                    } toast-element`}
                  >
                    {schemaStatus.valid ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {schemaStatus.message}
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={config.responseSchemaText}
              onChange={(e) => updateField("responseSchemaText", e.target.value)}
              placeholder='{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" }\n  }\n}'
              rows={5}
              className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="tuner-drawer-overlay"
            id="tuner-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.89, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget && onClose) {
                onClose();
              }
            }}
          >
            <motion.div
              key="tuner-drawer-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Models and Parameters drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 1.89, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 z-50 w-full h-full h-[100dvh] bg-background border-none shadow-2xl flex flex-col overflow-hidden text-foreground"
            >
              {/* Top Drawer Header with Back button */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-background/95 backdrop-blur-md shrink-0 select-none">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {onClose && (
                    <button
                      type="button"
                      id="tuner-modal-back-btn"
                      onClick={onClose}
                      className="p-2 -ms-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      title="Close drawer"
                      aria-label="Back / Close drawer"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span className="text-xs font-semibold sm:inline hidden">Back</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">
                        Models & Parameters
                      </h2>
                      <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
                        Select Gemini models and customize temperature, output tokens & schema
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    title="Reset parameters to defaults"
                    aria-label="Reset parameters to defaults"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium sm:inline hidden">Reset</span>
                  </button>
                  {onClose && (
                    <button
                      type="button"
                      id="tuner-modal-close-btn"
                      onClick={onClose}
                      className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      title="Close drawer"
                      aria-label="Close drawer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
                {bodyFields}
              </div>

              {/* Drawer Footer */}
              <div className="px-4 sm:px-6 py-3 border-t border-border bg-background/95 backdrop-blur-md shrink-0">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-primary/30 bg-primary/20 text-primary font-semibold shrink-0">
                      Active Model
                    </span>
                    <span className="truncate font-medium text-foreground">
                      {selectedModelInfo?.name || config.model}
                    </span>
                  </div>

                  {onClose && (
                    <button
                      type="button"
                      id="tuner-done-btn"
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background p-3.5 space-y-4">
      {/* Header for embedded mode */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Model & Tuners</h2>
        </div>
        <button
          onClick={handleResetDefaults}
          className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation"
          title="Reset parameters to defaults"
          aria-label="Reset parameters to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-xs">Reset</span>
        </button>
      </div>
      {bodyFields}
    </div>
  );
};
