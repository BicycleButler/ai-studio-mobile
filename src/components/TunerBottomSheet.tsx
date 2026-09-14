import React from "react";
import {
  Sliders,
  RotateCcw,
  Sparkles,
  FileJson,
  Layers,
  X,
  Key,
  ShieldCheck,
} from "lucide-react";
import { PromptConfig, ModelInfo } from "../types";

interface TunerBottomSheetProps {
  config: PromptConfig;
  onChangeConfig: (newConfig: PromptConfig) => void;
  models: ModelInfo[];
  onClose?: () => void;
  isModal?: boolean;
  hasApiKey?: boolean;
  onOpenAuth?: () => void;
}

export const TunerBottomSheet: React.FC<TunerBottomSheetProps> = ({
  config,
  onChangeConfig,
  models,
  onClose,
  isModal = false,
  hasApiKey = false,
  onOpenAuth,
}) => {
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
    if (temp <= 0.2) return "Deterministic • Best for code, math & structured data";
    if (temp <= 0.7) return "Focused & accurate";
    if (temp <= 1.2) return "Balanced • Standard AI Studio default";
    return "High variance • Highly creative & exploratory";
  };

  const content = (
    <div className="flex flex-col h-full overflow-y-auto bg-background p-3.5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Model & Tuners</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleResetDefaults}
            className="p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[11px]">Reset</span>
          </button>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Authentication Status Card */}
      <div
        id="tuner-auth-card"
        onClick={onOpenAuth}
        className="p-3 rounded-xl border border-border bg-card hover:bg-muted/50 flex items-center justify-between gap-3 cursor-pointer transition-colors"
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
                ? "Connected to Gemini • Tap to manage"
                : "Tap to connect credentials"}
            </span>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-border bg-muted text-foreground shrink-0 transition-colors font-mono"
        >
          {hasApiKey ? "Connected" : "Authenticate"}
        </span>
      </div>

      {/* 1. Model Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span>Select Model</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {models.map((m) => {
            const isSelected = config.model === m.id;
            return (
              <button
                key={m.id}
                onClick={() => updateField("model", m.id)}
                className={`text-left p-2.5 rounded-xl border transition-colors relative cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {m.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.badge}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">
                  {m.description}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Context: {m.contextWindow}</span>
                  {m.supportsVision && (
                    <span className="text-primary font-medium">• Vision</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. System Instruction */}
      <div className="space-y-1.5 bg-card border border-border rounded-xl p-3">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            System Instructions
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {config.systemInstruction.length} chars
          </span>
        </label>
        <p className="text-[11px] text-muted-foreground">
          Steer model behavior, tone, style, output constraints, or instructions.
        </p>
        <textarea
          id="tuner-sys-prompt"
          value={config.systemInstruction}
          onChange={(e) => updateField("systemInstruction", e.target.value)}
          placeholder="You are a helpful software assistant. Be succinct..."
          rows={3}
          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
        />
      </div>

      {/* 3. Temperature Slider */}
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
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0.0 (Precise)</span>
          <span>1.0 (Balanced)</span>
          <span>2.0 (Creative)</span>
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
            Nucleus sampling probability mass threshold.
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
            Selects from the top K most likely tokens.
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
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>128</span>
          <span>2048 (default)</span>
          <span>8192</span>
        </div>
      </div>

      {/* 6. Response MIME Type (JSON Schema Mode) */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-primary" />
              Structured Output (JSON)
            </label>
            <p className="text-[10px] text-muted-foreground">
              Force response to follow a strict JSON schema
            </p>
          </div>
          <button
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
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="text-[11px] font-medium text-muted-foreground block">
              Optional JSON Schema
            </label>
            <textarea
              value={config.responseSchemaText}
              onChange={(e) => updateField("responseSchemaText", e.target.value)}
              placeholder='{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" }\n  }\n}'
              rows={4}
              className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        id="tuner-bottom-sheet-overlay"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        <div
          id="tuner-bottom-sheet-dialog"
          className="w-full sm:max-w-md max-h-[85vh] h-auto bg-background border border-border sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
};
