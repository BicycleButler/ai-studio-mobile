import React from "react";
import { Smartphone, ShieldCheck, Loader2, Check, AlertCircle, ExternalLink, FolderPlus } from "lucide-react";
import { SettingsSectionCard } from "./SettingsSectionCard";

export interface AIStudioKeySectionProps {
  customApiKey: string;
  isVerifyingKey: boolean;
  localKeyValidationResult: { valid: boolean; error?: string; verifiedAt?: number } | null;
  onOpenCustomTabBrowser: (service: "aistudio" | "jules") => void;
  onOpenImportProject: () => void;
}

export const AIStudioKeySection: React.FC<AIStudioKeySectionProps> = ({
  customApiKey,
  isVerifyingKey,
  localKeyValidationResult,
  onOpenCustomTabBrowser,
  onOpenImportProject,
}) => {
  return (
    <SettingsSectionCard
      icon={<Smartphone className="w-5 h-5 text-primary" />}
      title="Bring Your Own Device API Key"
      description="Authenticate via the mobile app to securely store your Google AI Studio key on-device."
      accentColorClass="bg-primary/5"
      iconBgClass="bg-primary/10"
      iconColorClass="text-primary"
    >
      {customApiKey ? (
        <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <ShieldCheck className="w-3 h-3" /> Encrypted Key
              </div>
            </div>
            {isVerifyingKey ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Verifying
              </span>
            ) : localKeyValidationResult ? (
              localKeyValidationResult.valid ? (
                <span className="text-[10px] text-foreground font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Validated
                </span>
              ) : (
                <span className="text-[10px] text-destructive font-medium flex items-center gap-1" title={localKeyValidationResult.error}>
                  <AlertCircle className="w-3 h-3" /> Invalid
                </span>
              )
            ) : null}
          </div>
          <div className="font-mono text-xs text-foreground/80 break-all bg-background p-2 rounded-md border border-border/50">
            {customApiKey.substring(0, 8)}...{customApiKey.substring(customApiKey.length - 4)}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onOpenCustomTabBrowser("aistudio")}
              className="flex-1 px-3 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors"
            >
              Replace Key
            </button>
            <button
              onClick={onOpenImportProject}
              className="flex-1 px-3 py-2 rounded-md bg-muted hover:bg-muted-foreground/20 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Load Project
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          id="link-aistudio-btn"
          onClick={() => onOpenCustomTabBrowser("aistudio")}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2.5 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98]"
        >
          <span>Link AI Studio Account</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </SettingsSectionCard>
  );
};
