import React from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SecurePrivacyShieldProps {
  isActive: boolean;
}

export const SecurePrivacyShield: React.FC<SecurePrivacyShieldProps> = ({ isActive }) => {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="flag-secure-privacy-shield"
          id="flag-secure-privacy-shield"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.09, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center select-none"
          aria-hidden="true"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-4 shadow-xl">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h2 className="text-base font-semibold text-foreground tracking-wide">
            Screen Obscured for Security
          </h2>

          <p className="text-xs text-muted-foreground max-w-xs mt-2 leading-relaxed">
            Android FLAG_SECURE window protection is active. Sensitive API keys, custom system instructions, and prompt drafts are shielded from recent app snapshots.
          </p>

          <div className="mt-5 px-3 py-1.5 rounded-full bg-card border border-border text-[11px] text-muted-foreground font-mono flex items-center gap-2 shadow-inner">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground">FLAG_SECURE Active</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
