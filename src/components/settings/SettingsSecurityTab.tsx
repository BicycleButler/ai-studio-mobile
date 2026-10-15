import React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { setFlagSecureEnabled } from "../../utils/storage";

export interface SettingsSecurityTabProps {
  flagSecure: boolean;
  setFlagSecure: (enabled: boolean) => void;
}

export const SettingsSecurityTab: React.FC<SettingsSecurityTabProps> = ({
  flagSecure,
  setFlagSecure,
}) => {
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
              setFlagSecureEnabled(enabled);
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
          Your API keys, prompts, and project configurations are stored locally on your device and never sent to external servers other than official Google AI Studio endpoints.
        </p>
        <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Client for Google AI Studio</span>
          <span className="text-primary font-medium">Official Gemini API</span>
        </div>
      </div>
    </div>
  );
};
