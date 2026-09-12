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

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#131314] p-3.5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2b2c31]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Model & Tuners</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleResetDefaults}
            className="p-1.5 text-xs text-[#9aa0a6] hover:text-white hover:bg-[#232429] rounded-lg transition-colors flex items-center gap-1"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[11px]">Reset</span>
          </button>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#232429]"
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
        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
          hasApiKey
            ? "bg-[#181a24] border-blue-500/30 text-zinc-200 hover:bg-[#202330]"
            : "bg-[#1d1f27] border-[#313543] text-zinc-300 hover:bg-[#252834]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-muted text-foreground shrink-0">
            {hasApiKey ? (
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            ) : (
              <Key className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-xs text-white block truncate">
              {hasApiKey ? "AI Studio Authenticated" : "Authentication Required"}
            </span>
            <span className="text-[11px] block opacity-80 truncate">
              {hasApiKey
                ? "Connected to Gemini • Tap to manage"
                : "Tap to connect credentials"}
            </span>
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
            hasApiKey
              ? "bg-muted/60 text-zinc-300 border-border/40 font-mono"
              : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-sm"
          }`}
        >
          {hasApiKey ? "Connected" : "Authenticate"}
        </span>
      </div>

      {/* 1. Model Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#c4c7c5] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Select Model</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {models.map((m) => {
            const isSelected = config.model === m.id;
            return (
              <button
                key={m.id}
                onClick={() => updateField("model", m.id)}
                className={`text-left p-2.5 rounded-xl border transition-colors relative ${
                  isSelected
                    ? "bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/50 text-white"
                    : "bg-[#1a1b20] border-[#2c2d33] text-[#9aa0a6] hover:bg-[#212328] hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white truncate">
                    {m.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      isSelected
                        ? "bg-blue-500 text-white"
                        : "bg-[#282a30] text-[#8e9196]"
                    }`}
                  >
                    {m.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#8e9196] line-clamp-2 mb-1.5">
                  {m.description}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <span>Context: {m.contextWindow}</span>
                  {m.supportsVision && (
                    <span className="text-emerald-400">• Vision</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. System Instruction */}
      <div className="space-y-1.5 bg-[#17181c] border border-[#27292f] rounded-xl p-3">
        <label className="text-xs font-semibold text-[#c4c7c5] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            System Instructions
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {config.systemInstruction.length} chars
          </span>
        </label>
        <p className="text-[11px] text-[#8e9196]">
          Steer model behavior, tone, style, output constraints, or instructions.
        </p>
        <textarea
          id="tuner-sys-prompt"
          value={config.systemInstruction}
          onChange={(e) => updateField("systemInstruction", e.target.value)}
          placeholder="You are a helpful software assistant. Be succinct..."
          rows={3}
          className="w-full bg-[#121315] border border-[#2b2c31] rounded-lg p-2 text-xs text-white placeholder-[#71767b] focus:outline-none focus:border-blue-500 resize-none font-mono"
        />
      </div>

      {/* 3. Temperature Slider */}
      <div className="space-y-2 bg-[#17181c] border border-[#27292f] rounded-xl p-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#c4c7c5]">
            Temperature
          </label>
          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
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
          className="w-full h-1.5 bg-[#2b2c31] rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>0.0 (Precise)</span>
          <span>1.0 (Balanced)</span>
          <span>2.0 (Creative)</span>
        </div>
        <p className="text-[10px] text-blue-300/80 italic mt-0.5">
          {getTemperatureDescription(config.temperature)}
        </p>
      </div>

      {/* 4. Top P and Top K */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Top P */}
        <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#c4c7c5]">Top P</label>
            <span className="text-xs font-mono font-bold text-zinc-300">
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
            className="w-full h-1.5 bg-[#2b2c31] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-[10px] text-zinc-500">
            Nucleus sampling probability mass threshold.
          </p>
        </div>

        {/* Top K */}
        <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#c4c7c5]">Top K</label>
            <span className="text-xs font-mono font-bold text-zinc-300">
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
            className="w-full h-1.5 bg-[#2b2c31] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-[10px] text-zinc-500">
            Selects from the top K most likely tokens.
          </p>
        </div>
      </div>

      {/* 5. Max Output Tokens */}
      <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#c4c7c5]">
            Max Output Tokens
          </label>
          <span className="text-xs font-mono font-bold text-zinc-300">
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
          className="w-full h-1.5 bg-[#2b2c31] rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>128</span>
          <span>2048 (default)</span>
          <span>8192</span>
        </div>
      </div>

      {/* 6. Response MIME Type (JSON Schema Mode) */}
      <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-[#c4c7c5] flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-blue-400" />
              Structured Output (JSON)
            </label>
            <p className="text-[10px] text-zinc-500">
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
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              config.responseMimeType === "application/json"
                ? "bg-blue-600 justify-end"
                : "bg-[#2c2d33] justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {config.responseMimeType === "application/json" && (
          <div className="space-y-1.5 pt-2 border-t border-[#292b31]">
            <label className="text-[11px] font-medium text-zinc-400 block">
              Optional JSON Schema
            </label>
            <textarea
              value={config.responseSchemaText}
              onChange={(e) => updateField("responseSchemaText", e.target.value)}
              placeholder='{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" }\n  }\n}'
              rows={4}
              className="w-full bg-[#121315] border border-[#2b2c31] rounded-lg p-2 text-xs text-white placeholder-[#71767b] focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
};
