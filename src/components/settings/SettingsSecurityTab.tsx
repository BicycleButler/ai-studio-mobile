import React, { useEffect, useState } from "react";
import { Lock, ShieldCheck, Activity, Copy, Check, Download, Trash2 } from "lucide-react";
import { useServices } from "../../services/ServiceContext";
import { errorReporter, ReliabilityEvent } from "../../utils/errorReporter";

export interface SettingsSecurityTabProps {
  flagSecure: boolean;
  setFlagSecure: (enabled: boolean) => void;
}

export const SettingsSecurityTab: React.FC<SettingsSecurityTabProps> = ({
  flagSecure,
  setFlagSecure,
}) => {
  const { generalSettingsService, clipboardService, fileDownloadService } = useServices();
  const [events, setEvents] = useState<readonly ReliabilityEvent[]>(() => errorReporter.getEvents());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEvents(errorReporter.getEvents());
    return errorReporter.subscribe(() => {
      setEvents(errorReporter.getEvents());
    });
  }, []);

  const handleCopyDiagnostics = async () => {
    const ok = await clipboardService.writeText(errorReporter.exportDiagnosticsJson());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownloadDiagnostics = async () => {
    await fileDownloadService.downloadText(
      `ai-studio-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      errorReporter.exportDiagnosticsJson()
    );
  };

  const handleClearDiagnostics = () => {
    errorReporter.clear();
    setEvents([]);
  };

  const recentEvents = events.slice(-5).reverse();

  return (
    <div className="space-y-4">
      {/* Window & Screen Security (FLAG_SECURE) */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Android Screen Protection (FLAG_SECURE)
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Obscures screen snapshots in Recent Apps / App Switcher to prevent sensitive API key leaks.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            id="settings-flag-secure-toggle"
            checked={flagSecure}
            onChange={(e) => {
              const enabled = e.target.checked;
              setFlagSecure(enabled);
              generalSettingsService.setFlagSecureEnabled(enabled);
            }}
            className="w-4 h-4 rounded text-primary bg-muted border-border focus:ring-primary cursor-pointer"
          />
        </div>
      </div>

      {/* Data Sovereignty & Store Policy Disclosure */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span>Data Sovereignty & Privacy</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed font-normal">
          Your API keys, prompts, and project configurations are encrypted and stored locally on your device. Requests are sent only to your active provider endpoint (Google AI Studio or your connected OpenAI, Anthropic, OpenRouter, Groq, or custom endpoints). WebGPU and Ollama local models execute directly on your device or local network with zero cloud transfer.
        </p>
        <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>AI Studio &amp; Multi-Provider Client</span>
          <span className="text-primary font-medium">Encrypted Local Keys</span>
        </div>
      </div>

      {/* Reliability & Diagnostics Export */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Activity className="w-4 h-4 text-primary shrink-0" />
            <span>Reliability &amp; Diagnostics Log</span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {events.length} / 50 events
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Redacted error, sync, and storage resilience events stored locally on this device for troubleshooting.
        </p>

        {recentEvents.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {recentEvents.map((ev) => (
              <div
                key={ev.id}
                className="p-2 rounded-lg bg-muted/50 border border-border/60 text-[11px] space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium text-foreground">
                    {ev.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-muted-foreground break-words leading-snug">
                  {ev.message}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-[11px] text-muted-foreground">
            No reliability incidents recorded.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied JSON" : "Copy JSON"}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadDiagnostics}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          {events.length > 0 && (
            <button
              type="button"
              onClick={handleClearDiagnostics}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-destructive/10 hover:text-destructive text-[11px] font-medium text-muted-foreground transition-colors cursor-pointer ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

