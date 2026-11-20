import React from "react";
import { Shield, Key } from "lucide-react";

interface AuthRequiredBannerProps {
  hasApiKey: boolean;
  onOpenSettings: () => void;
}

export const AuthRequiredBanner: React.FC<AuthRequiredBannerProps> = ({
  hasApiKey,
  onOpenSettings,
}) => {
  if (hasApiKey) {
    return null;
  }

  return (
    <div className="bg-muted/90 border-b border-border px-3.5 py-2 text-xs text-foreground flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
      <div className="flex items-center gap-2 overflow-hidden">
        <Shield className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate text-[11px] sm:text-xs">
          <strong>Provider Required:</strong> Connect Google Gemini, OpenAI/Anthropic/OpenRouter/Groq keys, or enable Local On-Device models.
        </span>
      </div>
      <button
        id="banner-auth-btn"
        onClick={onOpenSettings}
        className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] shadow-sm flex items-center gap-1 shrink-0 transition-colors cursor-pointer whitespace-nowrap"
      >
        <Key className="w-3 h-3" />
        <span>Connect</span>
      </button>
    </div>
  );
};
