import React, { useState } from "react";
import {
  Key,
  Check,
  AlertCircle,
  X,
  ExternalLink,
  Shield,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ClipboardPaste,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { GoogleUser } from "../types";
import { GoogleAuthCard } from "./GoogleAuthCard";

interface ApiKeyModalProps {
  customApiKey: string;
  onSaveCustomApiKey: (key: string) => void;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => Promise<boolean>;
  onClose: () => void;
  googleUser?: GoogleUser | null;
  onGoogleLogin?: (email?: string, name?: string) => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  liveModelsCount?: number;
  onOpenCustomTabBrowser?: () => void;
  onOpenImportProject?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  customApiKey,
  onSaveCustomApiKey,
  hasServerKey,
  onRefreshServerAuth,
  onClose,
  googleUser = null,
  onGoogleLogin,
  onGoogleLogout,
  liveModelsCount = 55,
  onOpenCustomTabBrowser,
  onOpenImportProject,
}) => {
  const [activeTab, setActiveTab] = useState<"google" | "auto" | "manual">("google");
  const [inputVal, setInputVal] = useState(customApiKey);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const isAuthenticated = Boolean(googleUser || hasServerKey || customApiKey.trim());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCustomApiKey(inputVal.trim());
    setTestResult({
      success: true,
      message: "API key saved successfully to local storage.",
    });
  };

  const handleClearKey = () => {
    setInputVal("");
    onSaveCustomApiKey("");
    setTestResult(null);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputVal(text.trim());
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleTestKey = async (keyToTest?: string) => {
    setTesting(true);
    setTestResult(null);
    const key = keyToTest !== undefined ? keyToTest : inputVal.trim();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (key) {
        headers["x-gemini-api-key"] = key;
      }

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers,
      });

      const data = (await res.json()) as { valid?: boolean; error?: string; authSource?: string };
      if (res.ok && data.valid) {
        setTestResult({
          success: true,
          message:
            data.authSource === "ai_studio_secret"
              ? "Verified! AI Studio environment authentication is active and working."
              : "Verified! Your Gemini API key is valid and connected to Gemini models.",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Authentication check failed.",
        });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Network error during verification.";
      setTestResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRecheckServer = async () => {
    setCheckingServer(true);
    setTestResult(null);
    try {
      if (onRefreshServerAuth) {
        const found = await onRefreshServerAuth();
        if (found) {
          setTestResult({
            success: true,
            message: "AI Studio environment credentials detected!",
          });
        } else {
          setTestResult({
            success: false,
            message: "No GEMINI_API_KEY detected in server environment yet.",
          });
        }
      } else {
        const res = await fetch("/api/health");
        const data = (await res.json()) as { hasServerApiKey?: boolean };
        if (data.hasServerApiKey) {
          setTestResult({
            success: true,
            message: "AI Studio environment credentials detected!",
          });
        } else {
          setTestResult({
            success: false,
            message: "No GEMINI_API_KEY detected in server environment yet.",
          });
        }
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to query server health check.",
      });
    } finally {
      setCheckingServer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-[#17181c] border border-[#2b2c31] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2b2c31] bg-[#1a1b20]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Google AI Studio Authentication
              </h3>
              <p className="text-[11px] text-[#9aa0a6]">
                Manage credentials to prompt and test Gemini models
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#25272e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Active Status Card */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
              isAuthenticated
                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                : "bg-amber-950/30 border-amber-500/30 text-amber-300"
            }`}
          >
            {isAuthenticated ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs text-white">
                  {isAuthenticated ? "Authenticated & Ready" : "Authentication Required"}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isAuthenticated
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {isAuthenticated
                    ? hasServerKey
                      ? "AI Studio Secret"
                      : "Custom Key"
                    : "Not Connected"}
                </span>
              </div>
              <p className="text-[11px] opacity-85 mt-1 leading-relaxed">
                {isAuthenticated
                  ? hasServerKey
                    ? "Authenticated automatically via your AI Studio workspace environment. You can start generating prompts immediately."
                    : "Connected using your saved Gemini API key in local storage."
                  : "AI Studio can authenticate your workspace automatically, or you can connect a Gemini API key below."}
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-xl bg-[#121214] p-1 border border-[#2b2c31] gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("google");
                setTestResult(null);
              }}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "google"
                  ? "bg-[#252830] text-white shadow-sm"
                  : "text-[#9aa0a6] hover:text-[#e3e3e3]"
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
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
              <span className="truncate">Google Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("auto");
                setTestResult(null);
              }}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "auto"
                  ? "bg-[#252830] text-white shadow-sm"
                  : "text-[#9aa0a6] hover:text-[#e3e3e3]"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">Cloud Env</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("manual");
                setTestResult(null);
              }}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "manual"
                  ? "bg-[#252830] text-white shadow-sm"
                  : "text-[#9aa0a6] hover:text-[#e3e3e3]"
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Custom Key</span>
            </button>
          </div>

          {/* TAB 0: GOOGLE ACCOUNT */}
          {activeTab === "google" && (
            <GoogleAuthCard
              user={googleUser}
              onLogin={onGoogleLogin || (async () => {})}
              onLogout={onGoogleLogout || (async () => {})}
              liveModelsCount={liveModelsCount}
            />
          )}

          {/* TAB 1: AI STUDIO AUTOMATIC */}
          {activeTab === "auto" && (
            <div className="space-y-3 bg-[#131315] border border-[#24262b] rounded-xl p-3.5">
              <div>
                <h4 className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
                  <span>Automatic Platform Integration</span>
                </h4>
                <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                  Google AI Studio injects your credentials securely on the server side via the{" "}
                  <code className="bg-[#1f1f23] text-blue-300 px-1 py-0.5 rounded text-[10px]">
                    GEMINI_API_KEY
                  </code>{" "}
                  secret so your keys are never exposed to the client browser.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#1a1b20] border border-[#2b2c31] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#9aa0a6] text-[11px]">Server Environment:</span>
                  <span
                    className={`font-semibold text-[11px] ${
                      hasServerKey ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {hasServerKey ? "Active & Configured" : "Not Detected"}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRecheckServer}
                    disabled={checkingServer}
                    className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${checkingServer ? "animate-spin" : ""}`}
                    />
                    <span>{checkingServer ? "Checking Server..." : "Check AI Studio Credentials"}</span>
                  </button>
                  {hasServerKey && (
                    <button
                      type="button"
                      onClick={() => handleTestKey("")}
                      disabled={testing}
                      className="px-3 py-2 rounded-lg bg-[#252830] hover:bg-[#2f323c] text-zinc-300 font-medium text-xs border border-[#383b45] transition-colors disabled:opacity-50"
                    >
                      {testing ? "Testing..." : "Test Live Ping"}
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-[#71767b] space-y-1 pt-1">
                <div className="font-semibold text-zinc-400">If running in AI Studio:</div>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-500">
                  <li>AI Studio automatically configures secrets for you.</li>
                  <li>You can add or update keys in the AI Studio Settings &gt; Secrets menu.</li>
                  <li>Tap &quot;Check AI Studio Credentials&quot; after updating secrets.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL API KEY */}
          {activeTab === "manual" && (
            <form onSubmit={handleSave} className="space-y-3 bg-[#131315] border border-[#24262b] rounded-xl p-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    Gemini API Key
                  </label>
                  <div className="flex items-center gap-2">
                    {onOpenCustomTabBrowser && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomTabBrowser();
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                        title="Launch AI Studio in Chrome Custom Tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Launch In-App Tab</span>
                      </button>
                    )}
                    {onOpenImportProject && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenImportProject();
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                      >
                        <span>+ Import Project</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#1a1b20] border border-[#2b2c31] rounded-xl pl-3 pr-20 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#252830] transition-colors"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#252830] transition-colors"
                      title={showPassword ? "Hide key" : "Show key"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Stored securely in your local browser storage.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestKey(inputVal.trim())}
                    disabled={testing || !inputVal.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#252830] hover:bg-[#2f323c] text-zinc-300 text-xs font-medium border border-[#383b45] transition-colors disabled:opacity-40"
                  >
                    {testing ? "Testing..." : "Test Connection"}
                  </button>
                  {customApiKey && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="Remove saved key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!inputVal.trim() && !customApiKey}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all disabled:opacity-40"
                >
                  Save Key
                </button>
              </div>
            </form>
          )}

          {/* Live Test Result Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2.5 border animate-in fade-in ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="flex-1 leading-snug">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2b2c31] bg-[#1a1b20] flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
            <span>Encrypted transmission via backend proxy</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium bg-[#252830] hover:bg-[#2f323c] text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
