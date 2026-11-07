import React from "react";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

export interface ServerConfigSectionProps {
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
}

export const ServerConfigSection: React.FC<ServerConfigSectionProps> = ({
  hasServerKey,
  onRefreshServerAuth,
}) => {
  return (
    <div
      className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
        hasServerKey
          ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
          : "bg-card border-border text-muted-foreground"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg bg-muted`}
        >
          {hasServerKey ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          ) : (
            <Lock className="w-5 h-5" />
          )}
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground">
            Server Environment Config
          </h4>
          <p className="text-xs mt-1 text-muted-foreground/80 leading-relaxed">
            {hasServerKey
              ? "Connected securely to self-hosted server."
              : "Server keys missing. Running in local mode."}
          </p>
        </div>
      </div>
      {hasServerKey ? (
        <div className="px-2.5 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
        </div>
      ) : (
        <button
          onClick={onRefreshServerAuth}
          className="text-xs px-3 py-1.5 bg-muted hover:bg-muted-foreground/20 rounded-md transition"
        >
          Refresh
        </button>
      )}
    </div>
  );
};
