import React from "react";
import { Bot, ShieldCheck, Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";
import { SettingsSectionCard } from "./SettingsSectionCard";

export interface JulesKeySectionProps {
  julesApiKey: string;
  isVerifyingJulesKey: boolean;
  julesKeyValidationResult: { valid: boolean; error?: string; verifiedAt?: number } | null;
  onOpenCustomTabBrowser: (service: "aistudio" | "jules") => void;
}

export const JulesKeySection: React.FC<JulesKeySectionProps> = ({
  julesApiKey,
  isVerifyingJulesKey,
  julesKeyValidationResult,
  onOpenCustomTabBrowser,
}) => {
  return (
    <SettingsSectionCard
      icon={<Bot className="w-5 h-5 text-purple-500" />}
      title={
        <>
          Jules Agent Key
          <span className="text-[9px] uppercase tracking-wider font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Phase 2</span>
        </>
      }
      description="Dedicated API key for the autonomous code-modifying agent. Required for filesystem access."
      accentColorClass="bg-purple-500/5"
      iconBgClass="bg-purple-500/10"
      iconColorClass="text-purple-500"
    >
      {julesApiKey ? (
        <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <ShieldCheck className="w-3 h-3" /> Agent Key
              </div>
            </div>
            {isVerifyingJulesKey ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Verifying
              </span>
            ) : julesKeyValidationResult ? (
              julesKeyValidationResult.valid ? (
                <span className="text-[10px] text-foreground font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Validated
                </span>
              ) : (
                <span className="text-[10px] text-destructive font-medium flex items-center gap-1" title={julesKeyValidationResult.error}>
                  <AlertCircle className="w-3 h-3" /> Invalid
                </span>
              )
            ) : null}
          </div>
          <div className="font-mono text-xs text-foreground/80 break-all bg-background p-2 rounded-md border border-border/50">
            {julesApiKey.substring(0, 8)}...{julesApiKey.substring(julesApiKey.length - 4)}
          </div>
          <div className="mt-3">
            <button
              onClick={() => onOpenCustomTabBrowser("jules")}
              className="w-full px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition"
            >
              Replace Agent Key
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpenCustomTabBrowser("jules")}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition shadow-sm active:scale-[0.98]"
        >
          <span>Authorize Jules Agent</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </SettingsSectionCard>
  );
};
