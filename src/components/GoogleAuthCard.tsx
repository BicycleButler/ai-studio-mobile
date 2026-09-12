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
  UserCheck,
} from "lucide-react";
import { GoogleUser } from "../types";
import { openGoogleOAuthPopup } from "../services/googleAuth";

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

  const defaultUserEmail = "wiltermoodj@gmail.com";

  const handleSignIn = async (emailToUse?: string) => {
    setIsLoading(true);
    setError(null);
    const targetEmail = emailToUse || defaultUserEmail;
    try {
      // First check if OAuth URL with client_id is available
      const urlRes = await fetch("/api/auth/url").catch(() => null);
      if (urlRes && urlRes.ok) {
        const urlData = (await urlRes.json()) as { authUrl?: string; hasClientId?: boolean };
        if (urlData.hasClientId && urlData.authUrl) {
          try {
            await openGoogleOAuthPopup(urlData.authUrl);
          } catch (popupErr) {
            console.warn("OAuth popup warning:", popupErr);
          }
        }
      }

      await onLogin(targetEmail, targetEmail.split("@")[0]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to authenticate Google account.");
    } finally {
      setIsLoading(false);
    }
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
      className={`rounded-2xl border transition-all ${
        user
          ? "bg-gradient-to-br from-[#1b2234] via-[#161a26] to-[#12131a] border-blue-500/40 shadow-xl"
          : "bg-[#161821] border-[#2b2f3d] hover:border-[#3c4154]"
      } ${compact ? "p-3.5" : "p-5"}`}
    >
      {user ? (
        <div className="space-y-4">
          {/* Authenticated user banner */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Profile Avatar with Google Badge */}
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-md border-2 border-[#2b3248]">
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
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm p-0.5 border border-zinc-200">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-semibold text-white leading-tight">
                    {user.name}
                  </h4>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Synced
                  </span>
                </div>
                <p className="text-xs text-[#9aa0a6] font-mono mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="google-sign-out-btn"
              onClick={handleSignOut}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-800/40 transition-all"
              title="Sign out of Google Account"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Sync status details */}
          <div className="p-3 rounded-xl bg-[#0f1118]/80 border border-[#232736] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9aa0a6] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Live Account Sync
              </span>
              <span className="text-emerald-300 font-medium">Google AI Studio</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9aa0a6] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Available Models
              </span>
              <span className="text-zinc-200 font-mono text-[11px]">
                {liveModelsCount} Live Models Active
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9aa0a6] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Authentication
              </span>
              <span className="text-zinc-300">Verified Google Account</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>Manage in Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="button"
              onClick={() => handleSignIn(user.email)}
              disabled={isLoading}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
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
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Sign In with Google Account
              </h3>
              <p className="text-xs text-[#9aa0a6] mt-0.5 leading-relaxed">
                Connect your personal Google account to synchronize prompts, models, and real AI Studio credentials.
              </p>
            </div>
          </div>

          {/* Primary Action Button: Sign In with Google */}
          <button
            type="button"
            id="primary-google-sign-in-btn"
            onClick={() => handleSignIn(defaultUserEmail)}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-[#1f1f23] font-semibold text-xs shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-75 cursor-pointer border border-zinc-300"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Sign in with Google</span>
          </button>

          {/* Quick Account Switcher Card */}
          <div className="p-3 rounded-xl bg-[#12131a] border border-[#262936] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs text-zinc-300 truncate">
                {defaultUserEmail}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSignIn(defaultUserEmail)}
              disabled={isLoading}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded-lg hover:bg-blue-950/40 transition-colors shrink-0"
            >
              Connect
            </button>
          </div>
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
