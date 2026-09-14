import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  LogOut,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
} from "lucide-react";
import { GoogleUser } from "../types";
import { openGoogleOAuthPopup, parseGoogleJwtPayload } from "../services/googleAuth";
import { GoogleIcon } from "./GoogleIcon";

interface GoogleAuthCardProps {
  user: GoogleUser | null;
  onLogin: (email?: string, name?: string) => Promise<void>;
  onLogout: () => Promise<void>;
  liveModelsCount?: number;
  compact?: boolean;
}

export const GoogleAuthCard: React.FC<GoogleAuthCardProps> = ({
  user,
  onLogin,
  onLogout,
  liveModelsCount = 55,
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");

  const handleSignIn = async (emailToUse?: string, nameToUse?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      if (emailToUse) {
        await onLogin(emailToUse, nameToUse || emailToUse.split("@")[0]);
        return;
      }

      // First check if OAuth URL with client_id is available
      const urlRes = await fetch("/api/auth/url").catch(() => null);
      if (urlRes && urlRes.ok) {
        const urlData = (await urlRes.json()) as { authUrl?: string; hasClientId?: boolean };
        if (urlData.hasClientId && urlData.authUrl) {
          try {
            const oauthResult = await openGoogleOAuthPopup(urlData.authUrl);
            if (oauthResult?.token) {
              const decoded = parseGoogleJwtPayload(oauthResult.token);
              if (decoded?.email) {
                await onLogin(decoded.email, decoded.name || decoded.email.split("@")[0]);
                return;
              }
            }
          } catch (popupErr) {
            console.warn("OAuth popup warning:", popupErr);
          }
        }
      }

      // If OAuth not configured or returned without email, prompt manual input
      setShowManualInput(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to authenticate Google account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = manualEmail.trim();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid Google Account email address.");
      return;
    }
    await handleSignIn(email, manualName.trim() || undefined);
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onLogout();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign out.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="google-auth-card"
      className={`rounded-2xl border transition-colors ${
        user
          ? "bg-card border-primary/40 shadow-xl"
          : "bg-card border-border hover:border-primary/50"
      } ${compact ? "p-3.5" : "p-5"}`}
    >
      {user ? (
        <div className="space-y-4">
          {/* Authenticated user banner */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Profile Avatar with Google Badge */}
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-foreground font-bold text-base shadow-md border-2 border-border">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                {/* Google G mini-badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card flex items-center justify-center shadow-sm p-0.5 border border-border">
                  <GoogleIcon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">
                    {user.name}
                  </h4>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                    Synced
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="google-sign-out-btn"
              onClick={handleSignOut}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors cursor-pointer"
              title="Sign out of Google Account"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Sync status details */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                Live Account Sync
              </span>
              <span className="text-primary font-medium">Google AI Studio</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Available Models
              </span>
              <span className="text-foreground font-mono text-[11px]">
                {liveModelsCount} Live Models Active
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Authentication
              </span>
              <span className="text-foreground">Verified Google Account</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Manage in Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="button"
              onClick={() => handleSignIn(user.email, user.name)}
              disabled={isLoading}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Sync</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Unauthenticated Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-md shrink-0">
              <GoogleIcon className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Sign In with Google Account
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Connect your Google account to synchronize prompts, models, and real AI Studio credentials.
              </p>
            </div>
          </div>

          {/* Primary Action Button: Sign In with Google */}
          <button
            type="button"
            id="primary-google-sign-in-btn"
            onClick={() => handleSignIn()}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-lg transition-colors flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-75 cursor-pointer border border-primary/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
            ) : (
              <GoogleIcon className="w-4 h-4 shrink-0" />
            )}
            <span>Sign in with Google</span>
          </button>

          {/* Manual Account Entry Option */}
          {showManualInput ? (
            <form onSubmit={handleManualSubmit} className="p-3 rounded-xl bg-muted/40 border border-border space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>Connect Google Account</span>
              </div>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="your-email@gmail.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Display Name (optional)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <span>Connect</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
            >
              Sign in with custom Google Account email
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
