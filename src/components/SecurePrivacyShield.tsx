import React from "react";
import { ShieldCheck, Lock } from "lucide-react";

interface SecurePrivacyShieldProps {
  isActive: boolean;
}

export const SecurePrivacyShield: React.FC<SecurePrivacyShieldProps> = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <div
      id="flag-secure-privacy-shield"
      className="fixed inset-0 z-[9999] bg-[#0e0f13] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-100"
      aria-hidden="true"
    >
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-xl">
        <ShieldCheck className="w-8 h-8" />
      </div>

      <h2 className="text-base font-semibold text-white tracking-wide">
        Screen Obscured for Security
      </h2>

      <p className="text-xs text-zinc-400 max-w-xs mt-2 leading-relaxed">
        Android FLAG_SECURE window protection is active. Sensitive API keys, custom system instructions, and prompt drafts are shielded from recent app snapshots.
      </p>

      <div className="mt-5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-400 font-mono flex items-center gap-2 shadow-inner">
        <Lock className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-zinc-300">FLAG_SECURE Active</span>
      </div>
    </div>
  );
};
