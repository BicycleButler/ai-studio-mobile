import { defaultServerContext } from "./server/serverContext";

import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import { GenerateContentConfig } from "@google/genai";
import dotenv from "dotenv";
import { ServerStateStore, GoogleSessionUser } from "./server/stateStore";
import {
  GenerateRequestSchema,
  CountTokensRequestSchema,
  TTSRequestSchema,
  ProviderVerifyRequestSchema,
  IntegrationVerifySchema,
  FirebaseListDocsSchema,
  FirebaseWriteDocSchema,
  FirebaseDeleteDocSchema,
  FirebaseRtdbSchema,
  GcpBucketObjectsSchema,
  GcpReadObjectSchema,
  GcpWriteObjectSchema,
  GcpSecretAccessSchema,
  GcpSecretWriteSchema,
  GitHubRepoScopedSchema,
  GitHubWriteFileSchema,
  GitHubBatchPushSchema,
  GitHubDeleteFileSchema,
  GitHubCreateBranchSchema,
  VercelProjectScopedSchema,
  VercelUpsertEnvSchema,
  VercelDeleteEnvSchema,
  VercelDeploySchema,
  formatZodError,
} from "./src/schemas/validation";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  sanitizeModelId,
} from "./src/utils/modelCatalog";
import {
  getGraphData,
  queryGraph,
  getDiagram,
  getImpact,
  getContextPackage,
  lintArchitecture,
  pruneWorkspace,
  listSidecarSpecs,
  getSpecContent,
  getWorkspaceFileTree,
  getWorkspaceFileContent,
  saveSpecContent,
  materializeSpec,
  sandSpec,
  runStubsPipeline,
  runCliCommand,
  stubsEvents,
  closeStubsDatabase,
} from "./server/stubsService";
import { getGenAIClient } from "./server/utils/genai";
import { discoverProviderModels, streamExternalProviderChat, validateProviderBaseUrl } from "./server/utils/providers";
import {
  IntegrationHttpError,
  verifyIntegrationConnection,
  listFirebaseProjects,
  listFirebaseCollections,
  listFirebaseDocuments,
  writeFirebaseDocument,
  deleteFirebaseDocument,
  readFirebaseRtdb,
  writeFirebaseRtdb,
  listGcpProjects,
  listGcsBuckets,
  listGcsObjects,
  readGcsObject,
  writeGcsObject,
  deleteGcsObject,
  listGcpSecrets,
  accessGcpSecret,
  writeGcpSecret,
  listCloudRunServices,
  listGitHubRepos,
  listGitHubBranches,
  getGitHubTree,
  readGitHubFile,
  writeGitHubFile,
  batchPushGitHubFiles,
  deleteGitHubFile,
  createGitHubBranch,
  listGitHubCommits,
  listVercelTeams,
  listVercelProjects,
  listVercelDeployments,
  listVercelEnvVars,
  readVercelEnvVar,
  upsertVercelEnvVar,
  deleteVercelEnvVar,
  deployToVercel,
} from "./server/utils/integrations";
import { getErrorMessage } from "./src/utils/errorHandling";
import { ModelProviderId } from "./src/types";
import { IntegrationCredentialsPayload, IntegrationProviderId } from "./src/types/integrations";

dotenv.config();

const { logger: defaultLogger, timeProvider } = defaultServerContext.services;
const PORT = 3000;

export interface GoogleCredentialVerificationResult {
  verified: boolean;
  email?: string;
  sub?: string;
  name?: string;
  picture?: string;
  error?: string;
}

export type GoogleCredentialVerifier = (params: {
  email: string;
  idToken?: string;
  accessToken?: string;
}) => Promise<GoogleCredentialVerificationResult>;

export interface RateLimitConfig {
  windowMs?: number;
  aiMaxPerMin?: number;
  aiMaxConcurrent?: number;
  stubsMaxPerMin?: number;
  stubsMaxConcurrent?: number;
}

export interface CreateAppOptions {
  stateStore?: ServerStateStore;
  verifyGoogleCredentials?: GoogleCredentialVerifier;
  rateLimits?: RateLimitConfig;
}

const DEFAULT_FALLBACK_MODELS = CURATED_MODELS;
const MODEL_CACHE_TTL_MS = 300_000;
const MODEL_ERROR_BACKOFF_MS = 60_000;
const MAX_MODEL_CACHE_ENTRIES = 50;
const GENAI_CALL_TIMEOUT_MS = 30_000;
const GENAI_STREAM_IDLE_TIMEOUT_MS = 60_000;
const AUTH_VERIFY_TIMEOUT_MS = 10_000;

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function getOrCreateSessionId(req: Request, res: Response): string {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies.ais_sid;
  if (existing && /^[a-zA-Z0-9_-]{16,128}$/.test(existing)) {
    return existing;
  }
  const sid = crypto.randomUUID();
  const isHttps =
    req.protocol === "https" ||
    req.headers["x-forwarded-proto"] === "https" ||
    (req.get("host") || "").includes("run.app");
  const attrs = isHttps
    ? "Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000"
    : "Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";
  res.setHeader("Set-Cookie", `ais_sid=${encodeURIComponent(sid)}; ${attrs}`);
  return sid;
}

function hashKeyForCache(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

function attachClientDisconnectAbort(req: Request, res: Response): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) {
      controller.abort(new DOMException("Client disconnected", "AbortError"));
    }
  };
  res.on("close", onClose);
  req.on("aborted", onClose);
  return {
    signal: controller.signal,
    cleanup: () => {
      res.off("close", onClose);
      req.off("aborted", onClose);
    },
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const DEFAULT_RATE_WINDOW_MS = 60_000;
const MAX_RATE_BUCKETS = 2000;

function getClientRateKey(req: Request): string {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.ais_sid && /^[a-zA-Z0-9_-]{16,128}$/.test(cookies.ais_sid)) {
    return `sid:${cookies.ais_sid}`;
  }
  return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

function createRateLimiter(config: {
  windowMs: number;
  maxRequests: number;
  maxConcurrent: number;
  nowFn: () => number;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const inflight = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getClientRateKey(req);
    const now = config.nowFn();

    // Evict expired buckets when map grows
    if (buckets.size >= MAX_RATE_BUCKETS) {
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
      }
      if (buckets.size >= MAX_RATE_BUCKETS) {
        const oldest = buckets.keys().next().value;
        if (oldest) buckets.delete(oldest);
      }
    }

    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + config.windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= config.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Rate limit exceeded. Please wait before retrying.",
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    const active = inflight.get(key) || 0;
    if (active >= config.maxConcurrent) {
      res.setHeader("Retry-After", "2");
      res.status(429).json({
        error: "Too many concurrent requests. Please wait for an active request to finish.",
        retryAfterSeconds: 2,
      });
      return;
    }

    bucket.count += 1;
    inflight.set(key, active + 1);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const cur = inflight.get(key) || 0;
      if (cur <= 1) {
        inflight.delete(key);
      } else {
        inflight.set(key, cur - 1);
      }
    };

    res.on("finish", release);
    res.on("close", release);
    next();
  };
}

function requireTrustedWorkspaceOrigin(req: Request, res: Response, next: NextFunction): void {
  const host = (req.get("host") || "").toLowerCase();
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (host && originHost !== host) {
        res.status(403).json({ error: "Cross-origin workspace mutation blocked." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid request Origin header." });
      return;
    }
  } else if (referer) {
    try {
      const refHost = new URL(referer).host.toLowerCase();
      if (host && refHost !== host) {
        res.status(403).json({ error: "Cross-origin workspace mutation blocked." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid request Referer header." });
      return;
    }
  }

  const contentLength = Number(req.headers["content-length"] || "0");
  if (req.method === "POST" && contentLength > 0 && !req.is("application/json")) {
    res.status(415).json({ error: "Workspace mutation endpoints require application/json." });
    return;
  }

  next();
}

export function createApp(options: CreateAppOptions = {}): {
  app: express.Express;
  stateStore: ServerStateStore;
} {
  const app = express();
  const stateStore = options.stateStore || new ServerStateStore();

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  const windowMs = options.rateLimits?.windowMs ?? DEFAULT_RATE_WINDOW_MS;
  const aiRateLimiter = createRateLimiter({
    windowMs,
    maxRequests: options.rateLimits?.aiMaxPerMin ?? 60,
    maxConcurrent: options.rateLimits?.aiMaxConcurrent ?? 6,
    nowFn: () => timeProvider.now(),
  });
  const stubsExecRateLimiter = createRateLimiter({
    windowMs,
    maxRequests: options.rateLimits?.stubsMaxPerMin ?? 30,
    maxConcurrent: options.rateLimits?.stubsMaxConcurrent ?? 2,
    nowFn: () => timeProvider.now(),
  });

  // Per-key cached live models and backoff tracking
  const modelCacheByKey = new Map<
    string,
    { models: typeof DEFAULT_FALLBACK_MODELS; timestamp: number }
  >();
  const modelErrorTimestampByKey = new Map<string, number>();

  const recordModelErrorTimestamp = (cacheKey: string, now: number) => {
    for (const [k, ts] of modelErrorTimestampByKey) {
      if (now - ts >= MODEL_ERROR_BACKOFF_MS) {
        modelErrorTimestampByKey.delete(k);
      }
    }
    if (modelErrorTimestampByKey.size >= MAX_MODEL_CACHE_ENTRIES) {
      const oldestKey = modelErrorTimestampByKey.keys().next().value;
      if (oldestKey) modelErrorTimestampByKey.delete(oldestKey);
    }
    modelErrorTimestampByKey.set(cacheKey, now);
  };

  const getScopeKey = (req: Request, res: Response): { sessionId: string; user: GoogleSessionUser | null; scopeKey: string } => {
    const sessionId = getOrCreateSessionId(req, res);
    const user = stateStore.getSessionUser(sessionId);
    return {
      sessionId,
      user,
      scopeKey: user?.email ? `user:${user.email}` : `session:${sessionId}`,
    };
  };

  // Health check endpoint
  app.get("/api/health", (req: Request, res: Response): void => {
    const { user } = getScopeKey(req, res);
    let dbOk = true;
    try {
      dbOk = stateStore.ping();
    } catch {
      dbOk = false;
    }
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? "ok" : "degraded",
      dbOk,
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      authenticatedGoogleUser: user ? user.email : null,
    });
  });

// OAuth Callback handler conforming to AI Studio OAuth integration guidelines
app.get("/auth/callback", (_req: Request, res: Response): void => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Google Authentication</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      max-width: 380px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Google Account Verified</h2>
    <p>Completing sync with Google AI Studio. This window will close automatically...</p>
  </div>
  <script>
    (function() {
      try {
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const params = new URLSearchParams(hash || search);
        const token = params.get('access_token') || params.get('id_token') || params.get('token');
        const code = params.get('code');
        const state = params.get('state');

        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_AUTH_SUCCESS',
            token: token || null,
            code: code || null,
            state: state || null
          }, '*');
          setTimeout(() => window.close(), 500);
        } else {
          window.location.href = '/';
        }
      } catch (err) {
        console.error("Callback error:", err);
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`);
});

function getFirebaseWebApiKey(): string {
  if (process.env.FIREBASE_WEB_API_KEY) return process.env.FIREBASE_WEB_API_KEY;
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as { apiKey?: string };
      if (parsed.apiKey) return parsed.apiKey;
    }
  } catch {
    // ignore
  }
  return "";
}

async function defaultVerifyGoogleCredentials(params: {
  email: string;
  idToken?: string;
  accessToken?: string;
}): Promise<GoogleCredentialVerificationResult> {
  const expectedEmail = params.email.trim().toLowerCase();

  if (params.idToken) {
    const firebaseApiKey = getFirebaseWebApiKey();
    if (firebaseApiKey) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AUTH_VERIFY_TIMEOUT_MS);
      try {
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: params.idToken }),
            signal: controller.signal,
          }
        );
        if (resp.ok) {
          const data = (await resp.json()) as {
            users?: Array<{ email?: string; localId?: string; displayName?: string; photoUrl?: string }>;
          };
          const account = data.users?.[0];
          const accountEmail = account?.email?.trim().toLowerCase();
          if (accountEmail && accountEmail === expectedEmail) {
            return {
              verified: true,
              email: accountEmail,
              sub: account?.localId,
              name: account?.displayName,
              picture: account?.photoUrl,
            };
          }
          if (accountEmail) {
            return { verified: false, error: "Token email does not match requested Google account." };
          }
        }
      } catch {
        // Fall through to Google tokeninfo check
      } finally {
        clearTimeout(timer);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTH_VERIFY_TIMEOUT_MS);
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(params.idToken)}`,
        { signal: controller.signal }
      );
      if (resp.ok) {
        const data = (await resp.json()) as {
          email?: string;
          email_verified?: string | boolean;
          sub?: string;
          name?: string;
          picture?: string;
        };
        const tokenEmail = data.email?.trim().toLowerCase();
        const isEmailVerified = data.email_verified === true || data.email_verified === "true";
        if (tokenEmail && tokenEmail === expectedEmail && isEmailVerified) {
          return {
            verified: true,
            email: tokenEmail,
            sub: data.sub,
            name: data.name,
            picture: data.picture,
          };
        }
        return { verified: false, error: "Google ID token verification failed." };
      }
    } catch {
      return { verified: false, error: "Failed to verify Google ID token." };
    } finally {
      clearTimeout(timer);
    }
  }

  if (params.accessToken) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTH_VERIFY_TIMEOUT_MS);
    try {
      const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${params.accessToken}` },
        signal: controller.signal,
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          email?: string;
          email_verified?: boolean;
          sub?: string;
          name?: string;
          picture?: string;
        };
        const infoEmail = data.email?.trim().toLowerCase();
        if (infoEmail && infoEmail === expectedEmail && data.email_verified !== false) {
          return {
            verified: true,
            email: infoEmail,
            sub: data.sub,
            name: data.name,
            picture: data.picture,
          };
        }
      }
      return { verified: false, error: "Google access token verification failed." };
    } catch {
      return { verified: false, error: "Failed to verify Google access token." };
    } finally {
      clearTimeout(timer);
    }
  }

  return { verified: false, error: "Verified Google credential token is required." };
}

function getOAuthClientId(): string {
  if (process.env.CLIENT_ID) return process.env.CLIENT_ID;
  if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.oAuthClientId) return parsed.oAuthClientId;
    }
  } catch {
    // ignore
  }
  return "";
}

// OAuth Authorization URL generator
app.get("/api/auth/url", (req: Request, res: Response): void => {
  const clientId = getOAuthClientId();
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" || host.includes("run.app") ? "https" : "http";
  const redirectUri = `${protocol}://${host}/auth/callback`;
  const scope = encodeURIComponent("openid email profile");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=token%20id_token&scope=${scope}&prompt=consent&nonce=ais_${timeProvider.now()}`;

  res.json({
    authUrl,
    redirectUri,
    hasClientId: Boolean(clientId),
  });
});

const verifyCredential = options.verifyGoogleCredentials || defaultVerifyGoogleCredentials;

// Establish or sync authenticated Google user session
app.post("/api/auth/google", async (req: Request, res: Response): Promise<void> => {
  const { email, name, picture, sub, authSource, idToken, accessToken } = req.body as Partial<GoogleSessionUser> & {
    idToken?: string;
    accessToken?: string;
  };

  if (!email || !email.trim()) {
    res.status(400).json({ error: "Email is required to authenticate Google account." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sessionId = getOrCreateSessionId(req, res);
  const existingSessionUser = stateStore.getSessionUser(sessionId, timeProvider.now());
  const isAlreadyVerifiedSameUser =
    Boolean(existingSessionUser?.email) &&
    existingSessionUser!.email.trim().toLowerCase() === normalizedEmail &&
    !idToken &&
    !accessToken;

  let verifiedResult: GoogleCredentialVerificationResult = { verified: isAlreadyVerifiedSameUser };
  if (!isAlreadyVerifiedSameUser) {
    verifiedResult = await verifyCredential({
      email: normalizedEmail,
      idToken,
      accessToken,
    });
  }

  if (!verifiedResult.verified) {
    res.status(401).json({
      error: verifiedResult.error || "Unable to verify Google account credentials.",
    });
    return;
  }

  const user: GoogleSessionUser = {
    email: verifiedResult.email || normalizedEmail,
    name: verifiedResult.name || name?.trim() || normalizedEmail.split("@")[0],
    picture: verifiedResult.picture || picture || undefined,
    sub: verifiedResult.sub || sub || `g_${timeProvider.now()}`,
    authSource: authSource || "google_account",
    authenticatedAt: timeProvider.now(),
    aiStudioSynced: true,
  };
  stateStore.setSessionUser(sessionId, user, timeProvider.now());

  res.json({
    success: true,
    user,
    message: "Google account authenticated and synced with Google AI Studio.",
  });
});

// Get current authenticated Google user
app.get("/api/auth/user", (req: Request, res: Response): void => {
  const { user } = getScopeKey(req, res);
  res.json({ user });
});

// Logout Google user
app.post("/api/auth/logout", (req: Request, res: Response): void => {
  const sessionId = getOrCreateSessionId(req, res);
  stateStore.clearSessionUser(sessionId);
  res.json({ success: true });
});

// User prompts persistence endpoints (both legacy /api/user/prompts and sync endpoint /api/prompts)
app.get("/api/user/prompts", (req: Request, res: Response): void => {
  const { scopeKey } = getScopeKey(req, res);
  const { items: prompts, version } = stateStore.getItemsWithVersion(scopeKey, "prompts");
  res.json({ prompts, version });
});

app.post("/api/user/prompts", (req: Request, res: Response): void => {
  const { scopeKey } = getScopeKey(req, res);
  const { prompts, baseVersion, force } = req.body as {
    prompts?: Array<Record<string, unknown>>;
    baseVersion?: number;
    force?: boolean;
  };
  if (!Array.isArray(prompts)) {
    res.status(400).json({ error: "'prompts' array is required." });
    return;
  }
  try {
    const result = stateStore.setItems(scopeKey, "prompts", prompts, timeProvider.now(), {
      expectedVersion: typeof baseVersion === "number" ? baseVersion : undefined,
      force: Boolean(force),
    });
    if (result.conflict) {
      res.status(409).json({
        error: "Prompts changed in another session. Resolve conflict to continue.",
        remote: result.remoteItems,
        remoteVersion: result.version,
      });
      return;
    }
    res.json({ success: true, count: prompts.length, version: result.version });
  } catch (err) {
    res.status(413).json({ error: getErrorMessage(err) });
  }
});

app.get("/api/prompts", (req: Request, res: Response): void => {
  const { scopeKey } = getScopeKey(req, res);
  const { items: prompts, version } = stateStore.getItemsWithVersion(scopeKey, "prompts");
  res.json({ prompts, version });
});

const handlePromptsSync = (req: Request, res: Response): void => {
  const { scopeKey } = getScopeKey(req, res);
  const body = req.body as
    | { prompts?: Array<Record<string, unknown>>; baseVersion?: number; force?: boolean }
    | Array<Record<string, unknown>>;
  const prompts = Array.isArray(body) ? body : body?.prompts;
  const baseVersion = !Array.isArray(body) && typeof body?.baseVersion === "number" ? body.baseVersion : undefined;
  const force = !Array.isArray(body) ? Boolean(body?.force) : false;

  if (!Array.isArray(prompts)) {
    res.status(400).json({ error: "'prompts' array is required." });
    return;
  }
  try {
    const result = stateStore.setItems(scopeKey, "prompts", prompts, timeProvider.now(), {
      expectedVersion: baseVersion,
      force,
    });
    if (result.conflict) {
      res.status(409).json({
        error: "Prompts changed in another session. Resolve conflict to continue.",
        remote: result.remoteItems,
        remoteVersion: result.version,
      });
      return;
    }
    res.json({ success: true, count: prompts.length, version: result.version });
  } catch (err) {
    res.status(413).json({ error: getErrorMessage(err) });
  }
};
app.post("/api/prompts", handlePromptsSync);
app.put("/api/prompts", handlePromptsSync);

// Projects sync endpoints (/api/projects)
app.get("/api/projects", (req: Request, res: Response): void => {
  const { scopeKey } = getScopeKey(req, res);
  const { items: projects, version } = stateStore.getItemsWithVersion(scopeKey, "projects");
  res.json({ projects, version });
});

const handleProjectsSync = (req: Request, res: Response): void => {
  const { scopeKey } = getScopeKey(req, res);
  const body = req.body as
    | { projects?: Array<Record<string, unknown>>; baseVersion?: number; force?: boolean }
    | Array<Record<string, unknown>>;
  const projects = Array.isArray(body) ? body : body?.projects;
  const baseVersion = !Array.isArray(body) && typeof body?.baseVersion === "number" ? body.baseVersion : undefined;
  const force = !Array.isArray(body) ? Boolean(body?.force) : false;

  if (!Array.isArray(projects)) {
    res.status(400).json({ error: "'projects' array is required." });
    return;
  }
  try {
    const result = stateStore.setItems(scopeKey, "projects", projects, timeProvider.now(), {
      expectedVersion: baseVersion,
      force,
    });
    if (result.conflict) {
      res.status(409).json({
        error: "Projects changed in another session. Resolve conflict to continue.",
        remote: result.remoteItems,
        remoteVersion: result.version,
      });
      return;
    }
    res.json({ success: true, count: projects.length, version: result.version });
  } catch (err) {
    res.status(413).json({ error: getErrorMessage(err) });
  }
};
app.post("/api/projects", handleProjectsSync);
app.put("/api/projects", handleProjectsSync);

// Dedicated authentication verification endpoint
app.post("/api/auth/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = getScopeKey(req, res);
    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);
    const countResult = await withTimeout(
      ai.models.countTokens({
        model: "gemini-2.5-flash",
        contents: "ping",
      }),
      GENAI_CALL_TIMEOUT_MS,
      "Auth verification"
    );
    res.json({
      valid: true,
      authSource: user ? "google_account" : customKey ? "custom_key" : "ai_studio_secret",
      totalTokens: countResult.totalTokens,
      user,
    });
  } catch (err: unknown) {
    res.status(401).json({
      valid: false,
      error: getErrorMessage(err),
    });
  }
});

// Phase 2: Lightweight test call against Google's models endpoint to verify key activity & authorization
app.post("/api/verify-key", aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const bodyKey = typeof req.body === "object" && req.body !== null ? req.body.apiKey : undefined;
    const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
    const candidateKey = (bodyKey || headerKey || "").trim();

    if (!candidateKey) {
      res.status(400).json({
        valid: false,
        error: "API key is required for verification.",
      });
      return;
    }

    const testModel = (typeof req.body === "object" && req.body?.model) ? String(req.body.model) : "gemini-2.5-flash";
    const ai = getGenAIClient(candidateKey);

    // Lightweight verification call with explicit timeout
    const result = await withTimeout(
      ai.models.countTokens({
        model: testModel,
        contents: "ping",
      }),
      GENAI_CALL_TIMEOUT_MS,
      "Key verification"
    );

    res.json({
      valid: true,
      model: testModel,
      totalTokens: result.totalTokens,
      verifiedAt: timeProvider.now(),
    });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    const status = getErrorStatus(err);
    res.status(status >= 400 && status < 600 ? status : 401).json({
      valid: false,
      error: msg,
    });
  }
});

// Verify external AI provider credentials and discover live models
app.post("/api/providers/verify", aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = ProviderVerifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ valid: false, error: formatZodError(parseResult.error), models: [] });
      return;
    }

    const { providerId, apiKey: bodyKey, baseUrl } = parseResult.data;
    const headerKey = req.headers["x-provider-api-key"] as string | undefined;
    const candidateKey = (bodyKey || headerKey || "").trim();

    if (providerId === "google") {
      const ai = getGenAIClient(candidateKey || undefined);
      const countResult = await withTimeout(
        ai.models.countTokens({
          model: "gemini-2.5-flash",
          contents: "ping",
        }),
        GENAI_CALL_TIMEOUT_MS,
        "Provider verification"
      );
      res.json({
        valid: true,
        models: CURATED_MODELS,
        totalTokens: countResult.totalTokens,
        verifiedAt: timeProvider.now(),
      });
      return;
    }

    const urlCheck = validateProviderBaseUrl(baseUrl, providerId);
    if (!urlCheck.ok) {
      res.status(400).json({
        valid: false,
        models: [],
        error: urlCheck.error,
      });
      return;
    }

    const disconnect = attachClientDisconnectAbort(req, res);
    let result;
    try {
      result = await discoverProviderModels({
        providerId,
        apiKey: candidateKey,
        baseUrl: urlCheck.url,
        signal: disconnect.signal,
      });
    } finally {
      disconnect.cleanup();
    }

    if (!result.valid) {
      res.status(400).json({
        valid: false,
        models: [],
        error: result.error || "Provider verification failed.",
      });
      return;
    }

    res.json({
      valid: true,
      models: result.models,
      verifiedAt: timeProvider.now(),
    });
  } catch (err: unknown) {
    res.status(500).json({
      valid: false,
      models: [],
      error: getErrorMessage(err),
    });
  }
});

app.post("/api/providers/models", aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const disconnect = attachClientDisconnectAbort(req, res);
  try {
    const parseResult = ProviderVerifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ models: [], error: formatZodError(parseResult.error) });
      return;
    }
    const { providerId, apiKey: bodyKey, baseUrl } = parseResult.data;
    if (providerId !== "google") {
      const urlCheck = validateProviderBaseUrl(baseUrl, providerId);
      if (!urlCheck.ok) {
        res.status(400).json({ valid: false, models: [], error: urlCheck.error });
        return;
      }
    }
    const headerKey = req.headers["x-provider-api-key"] as string | undefined;
    const result = await discoverProviderModels({
      providerId,
      apiKey: (bodyKey || headerKey || "").trim(),
      baseUrl,
      signal: disconnect.signal,
    });
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ valid: false, models: [], error: getErrorMessage(err) });
  } finally {
    disconnect.cleanup();
  }
});

// Return live models list synced directly from Google AI Studio (cache isolated per API key hash)
app.get("/api/models", async (req: Request, res: Response): Promise<void> => {
  const forceRefresh = req.query.refresh === "true";
  const now = timeProvider.now();

  const customKey = (req.headers["x-gemini-api-key"] as string | undefined)?.trim();
  const apiKey = customKey || process.env.GEMINI_API_KEY;

  // If no API key is available, seamlessly serve stable defaults without querying upstream
  if (!apiKey) {
    res.json({
      models: DEFAULT_FALLBACK_MODELS,
      count: DEFAULT_FALLBACK_MODELS.length,
      liveSynced: false,
    });
    return;
  }

  const cacheKey = hashKeyForCache(apiKey);
  const cachedEntry = modelCacheByKey.get(cacheKey);

  // Return cached models if fresh (within 5 minutes) and not forced
  if (!forceRefresh && cachedEntry && now - cachedEntry.timestamp < MODEL_CACHE_TTL_MS) {
    res.json({
      models: cachedEntry.models,
      count: cachedEntry.models.length,
      liveSynced: true,
      cached: true,
    });
    return;
  }

  // Backoff protection: if upstream returned 503 or transient failure recently, prevent hammering
  const lastErrorTs = modelErrorTimestampByKey.get(cacheKey) || 0;
  if (!forceRefresh && lastErrorTs && now - lastErrorTs < MODEL_ERROR_BACKOFF_MS) {
    const fallback = cachedEntry?.models || DEFAULT_FALLBACK_MODELS;
    res.json({
      models: fallback,
      count: fallback.length,
      liveSynced: false,
      cached: true,
    });
    return;
  }

  try {
    const ai = getGenAIClient(customKey);
    const pager = await withTimeout(ai.models.list(), GENAI_CALL_TIMEOUT_MS, "Model list");

    const liveModels: Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      contextWindow: string;
      supportsVision: boolean;
      supportsAudio: boolean;
      supportsSystemInstruction: boolean;
      supportsJson: boolean;
    }> = [];

    for await (const m of pager) {
      if (m.name && m.supportedActions?.includes("generateContent")) {
        const id = m.name.replace(/^models\//, "");
        if (isDeprecatedOrUnusableModel(id)) {
          continue; // Filter out deprecated, legacy, and non-chat models
        }

        const inputLimit = m.inputTokenLimit;
        const ctx = inputLimit
          ? `${inputLimit >= 1_000_000 ? `${(inputLimit / 1_000_000).toFixed(0)}M` : `${Math.round(inputLimit / 1_000)}k`} tokens`
          : "1M tokens";

        const curated = CURATED_MODELS.find((cm) => cm.id === id);

        let category = curated?.category || "General";
        if (!curated) {
          if (id.includes("flash-lite")) {
            category = "High Speed";
          } else if (id.includes("flash")) {
            category = "Recommended";
          } else if (id.includes("pro")) {
            category = "Complex Reasoning";
          }
        }

        liveModels.push({
          id,
          name: curated?.name || m.displayName || id,
          category,
          description: curated?.description || m.description || `Google AI Studio ${id} model.`,
          contextWindow: ctx,
          supportsVision: true,
          supportsAudio: curated?.supportsAudio ?? (id.includes("pro") || id.includes("flash")),
          supportsSystemInstruction: true,
          supportsJson: true,
        });
      }
    }

    // Make sure that all standard curated models are included in the available menu
    for (const curated of CURATED_MODELS) {
      if (!liveModels.some((lm) => lm.id === curated.id)) {
        liveModels.push(curated);
      }
    }

    if (liveModels.length > 0) {
      // Prioritize recommended models at top
      liveModels.sort((a, b) => {
        const priority = (id: string) => {
          if (id === "gemini-2.5-flash") return 1;
          if (id === "gemini-3.1-pro-preview") return 2;
          if (id === "gemini-3.1-flash-lite") return 3;
          if (id === "gemini-flash-latest") return 4;
          if (id === "gemini-pro-latest") return 5;
          if (id === "gemini-3.7-flash") return 6;
          if (id === "gemini-2.5-flash") return 7;
          if (id === "gemini-2.5-pro") return 8;
          return 20;
        };
        return priority(a.id) - priority(b.id);
      });

      if (modelCacheByKey.size >= MAX_MODEL_CACHE_ENTRIES) {
        const oldestKey = modelCacheByKey.keys().next().value;
        if (oldestKey) modelCacheByKey.delete(oldestKey);
      }
      modelCacheByKey.set(cacheKey, { models: liveModels, timestamp: now });
      modelErrorTimestampByKey.delete(cacheKey);

      res.json({
        models: liveModels,
        count: liveModels.length,
        liveSynced: true,
        cached: false,
      });
      return;
    }
  } catch {
    recordModelErrorTimestamp(cacheKey, now);
    // Upstream service can be temporarily unavailable (for example, 503 UNAVAILABLE) or rate-limited.
    // Gracefully fall back to stable default models without logging alarms to console.
  }

  // Fallback to stable defaults if unable to list
  const fallback = cachedEntry?.models || DEFAULT_FALLBACK_MODELS;
  res.json({
    models: fallback,
    count: fallback.length,
    liveSynced: false,
  });
});

// Count tokens endpoint
app.post("/api/count-tokens", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CountTokensRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: formatZodError(parseResult.error) });
      return;
    }

    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);
    const { model: rawModel, contents } = parseResult.data;
    const model = sanitizeModelId(rawModel);

    const countResult = await withTimeout(
      ai.models.countTokens({
        model,
        contents: contents as string,
      }),
      GENAI_CALL_TIMEOUT_MS,
      "Count tokens"
    );

    res.json({
      totalTokens: countResult.totalTokens,
    });
  } catch (err: unknown) {
    const rawText = JSON.stringify(req.body.contents || "");
    const estimatedTokens = Math.max(1, Math.round(rawText.length / 4));
    res.json({
      totalTokens: estimatedTokens,
      estimated: true,
      error: getErrorMessage(err),
    });
  }
});

interface TextPart {
  text: string;
}

interface InlineDataPart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

type Part = TextPart | InlineDataPart;

interface FormattedContent {
  role: "user" | "model";
  parts: Part[];
}

// Generation endpoint with SSE streaming support, timeout & client disconnect propagation
app.post(
  "/api/generate",
  aiRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = timeProvider.now();
    const disconnect = attachClientDisconnectAbort(req, res);
    try {
      const parseResult = GenerateRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: formatZodError(parseResult.error) });
        return;
      }

      const {
        model: rawModel,
        providerId: bodyProviderId,
        baseUrl: bodyBaseUrl,
        messages,
        systemInstruction,
        temperature,
        topP,
        topK,
        maxOutputTokens,
        responseMimeType,
        responseSchema,
        stream,
      } = parseResult.data;

      const headerProviderId = req.headers["x-provider-type"] as ModelProviderId | undefined;
      const providerId: ModelProviderId = bodyProviderId || headerProviderId || "google";

      if (providerId !== "google") {
        const providerKey =
          (req.headers["x-provider-api-key"] as string | undefined) ||
          (req.headers["x-gemini-api-key"] as string | undefined);
        const providerBaseUrl =
          bodyBaseUrl || (req.headers["x-provider-base-url"] as string | undefined);

        const urlCheck = validateProviderBaseUrl(providerBaseUrl, providerId);
        if (!urlCheck.ok) {
          res.status(400).json({ error: urlCheck.error });
          return;
        }

        await streamExternalProviderChat(
          {
            providerId,
            apiKey: providerKey,
            baseUrl: urlCheck.url,
            signal: disconnect.signal,
          },
          {
            model: rawModel,
            messages,
            systemInstruction,
            temperature,
            topP,
            topK,
            maxOutputTokens,
            responseMimeType,
            stream,
          },
          res,
          startTime
        );
        return;
      }

      const customKey = req.headers["x-gemini-api-key"] as string | undefined;
      const ai = getGenAIClient(customKey);
      const model = sanitizeModelId(rawModel, providerId);

      // Convert messages to GenAI contents format
      const contents: FormattedContent[] = messages.map((msg) => {
        const parts: Part[] = [];

        if (msg.images && Array.isArray(msg.images)) {
          for (const img of msg.images) {
            if (img.data && img.mimeType) {
              parts.push({
                inlineData: {
                  data: img.data,
                  mimeType: img.mimeType,
                },
              });
            }
          }
        }

        if (msg.text) {
          parts.push({ text: msg.text });
        }

        return {
          role: msg.role === "model" || msg.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: parts.length > 0 ? parts : [{ text: "" }],
        };
      });

      // Build config object
      const config: GenerateContentConfig = {
        abortSignal: disconnect.signal,
      };
      if (systemInstruction && systemInstruction.trim()) {
        config.systemInstruction = systemInstruction.trim();
      }
      if (typeof temperature === "number") {
        config.temperature = temperature;
      }
      if (typeof topP === "number") {
        config.topP = topP;
      }
      if (typeof topK === "number") {
        config.topK = topK;
      }
      if (typeof maxOutputTokens === "number" && maxOutputTokens > 0) {
        config.maxOutputTokens = maxOutputTokens;
      }
      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      if (responseSchema && Object.keys(responseSchema).length > 0) {
        config.responseSchema = responseSchema;
      }

      if (stream) {
        // Set SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const responseStream = await withTimeout(
          ai.models.generateContentStream({
            model,
            contents,
            config,
          }),
          GENAI_CALL_TIMEOUT_MS,
          "Gemini stream start"
        );

        let usageMetadata: unknown = null;
        const iterator = responseStream[Symbol.asyncIterator]();

        while (true) {
          if (disconnect.signal.aborted || res.writableEnded) break;
          const next = await withTimeout(
            iterator.next(),
            GENAI_STREAM_IDLE_TIMEOUT_MS,
            "Gemini stream chunk"
          );
          if (next.done) break;
          const chunk = next.value;
          const chunkText = chunk.text || "";
          if (chunk.usageMetadata) {
            usageMetadata = chunk.usageMetadata;
          }
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
          }
        }

        if (!disconnect.signal.aborted && !res.writableEnded) {
          const durationMs = timeProvider.now() - startTime;
          res.write(
            `data: ${JSON.stringify({
              done: true,
              durationMs,
              usageMetadata,
            })}\n\n`
          );
          res.end();
        }
        return;
      } else {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents,
            config,
          }),
          GENAI_CALL_TIMEOUT_MS,
          "Gemini generate"
        );

        const durationMs = timeProvider.now() - startTime;
        res.json({
          text: response.text || "",
          durationMs,
          usageMetadata: response.usageMetadata,
        });
        return;
      }
    } catch (err: unknown) {
      if (disconnect.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        if (!res.writableEnded) res.end();
        return;
      }
      defaultLogger.error("Gemini API Error:", err);
      const statusCode = getErrorStatus(err);
      const errorMessage = getErrorMessage(err) || "Failed to generate AI Studio response.";

      if (res.headersSent) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
          res.end();
        }
        return;
      }

      res.status(statusCode).json({
        error: errorMessage,
      });
      return;
    } finally {
      disconnect.cleanup();
    }
  }
);

/**
 * Encodes raw 16-bit linear PCM audio into a standard RIFF/WAVE container
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const len = pcmBuffer.length;
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + len, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
  wavHeader.writeUInt16LE(1, 20); // AudioFormat: PCM (1)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
  wavHeader.writeUInt16LE(numChannels * 2, 32); // BlockAlign
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample: 16-bit
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(len, 40);
  return Buffer.concat([wavHeader, pcmBuffer]);
}

/**
 * Dedicated Gemini High-Fidelity Text-To-Speech (TTS) Endpoint
 * Uses gemini-3.1-flash-tts-preview with customizable prebuilt voices
 */
app.post("/api/tts", aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const validationResult = TTSRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      error: `Invalid TTS payload: ${formatZodError(validationResult.error)}`,
    });
    return;
  }

  const { text, voiceName } = validationResult.data;
  const disconnect = attachClientDisconnectAbort(req, res);

  try {
    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);

    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: text,
        config: {
          abortSignal: disconnect.signal,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Puck",
              },
            },
          },
        },
      }),
      GENAI_CALL_TIMEOUT_MS,
      "Gemini TTS"
    );

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;
    let rawBase64: string | undefined;

    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          rawBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!rawBase64) {
      res.status(500).json({
        error: "No audio stream returned from Gemini TTS model.",
      });
      return;
    }

    // Convert raw 24kHz 16-bit PCM into standard WAV audio
    const pcmBuffer = Buffer.from(rawBase64, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1);
    const audioDataUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

    res.json({
      audioUrl: audioDataUrl,
      voiceName: voiceName || "Puck",
      mimeType: "audio/wav",
      sampleRate: 24000,
    });
  } catch (err: unknown) {
    if (disconnect.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
      if (!res.writableEnded) res.end();
      return;
    }
    defaultLogger.error("Gemini TTS Error:", err);
    const statusCode = getErrorStatus(err);
    const errorMessage = getErrorMessage(err) || "Failed to generate speech with Gemini TTS.";
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: errorMessage,
    });
  } finally {
    disconnect.cleanup();
  }
});

/* ==========================================================================
   STUBS ARCHITECTURE-AS-CODE & PWM (PORTAL WEB MODULE) API ROUTES
   ========================================================================== */

/**
 * GET /api/stubs/graph - Returns full AST dependency graph data & hub metrics
 */
app.get("/api/stubs/graph", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getGraphData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/query - Executes GraphRAG or surgical query (explain:, path:, blast:, map:)
 */
app.get("/api/stubs/query", async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string) || "map:";
    const budget = req.query.budget ? Number(req.query.budget) : 1500;
    const result = await queryGraph(q, Number.isFinite(budget) ? budget : 1500);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/diagram - Returns living Mermaid flowchart, sequence, or slice diagram
 */
app.get("/api/stubs/diagram", async (req: Request, res: Response): Promise<void> => {
  try {
    const groupBy = (req.query.groupBy as "domain" | "layer") || "domain";
    const diagramType = (req.query.type as "architecture" | "sequence" | "slice") || "architecture";
    const target = req.query.target as string | undefined;
    const result = await getDiagram(groupBy, diagramType, target);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/impact - Calculates blast radius, pre-flight safety gate, and tiered context
 */
app.get("/api/stubs/impact", async (req: Request, res: Response): Promise<void> => {
  try {
    const target = req.query.target as string;
    if (!target) {
      res.status(400).json({ error: "Missing required 'target' query parameter." });
      return;
    }
    const guard = (req.query.guard as "low" | "medium" | "high" | "critical") || "high";
    const result = await getImpact(target, guard);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/context - Returns token-optimized L0/L1/L2 agent briefing package
 */
app.get("/api/stubs/context", async (req: Request, res: Response): Promise<void> => {
  try {
    const target = req.query.target as string;
    if (!target) {
      res.status(400).json({ error: "Missing required 'target' query parameter." });
      return;
    }
    const result = await getContextPackage(target);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/lint - Runs architectural invariant checks (layers, cycles, manifest parity, domain leaks)
 */
app.get("/api/stubs/lint", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await lintArchitecture();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/prune - Audits phantom sidecars, zombie exports, and stale DB records
 */
app.get("/api/stubs/prune", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pruneWorkspace();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /api/stubs/run - Executes the unified stubs run pipeline
 */
app.post("/api/stubs/run", requireTrustedWorkspaceOrigin, stubsExecRateLimiter, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runStubsPipeline(true);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/specs - Lists all sidecar specs (*.ts.md) and architecture plans
 */
app.get("/api/stubs/specs", async (_req: Request, res: Response): Promise<void> => {
  try {
    const specs = await listSidecarSpecs();
    res.json({ specs });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/spec-detail - Returns raw markdown content of a spec
 */
app.get("/api/stubs/spec-detail", async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "Missing 'path' query parameter." });
      return;
    }
    const detail = await getSpecContent(filePath);
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/tree - Returns hierarchical directory and file tree for the IDE file explorer
 */
app.get("/api/stubs/tree", async (_req: Request, res: Response): Promise<void> => {
  try {
    const treeData = await getWorkspaceFileTree();
    res.json(treeData);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/file - Returns source content of a workspace file for opening in the IDE
 */
app.get("/api/stubs/file", async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "Missing 'path' query parameter." });
      return;
    }
    const fileData = await getWorkspaceFileContent(filePath);
    res.json(fileData);
  } catch (error) {
    const message = getErrorMessage(error);
    const status = message.includes("not found") ? 404 : message.includes("Invalid") || message.includes("restricted") ? 403 : message.includes("Binary") ? 415 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/stubs/spec-save - Updates spec content
 */
app.post("/api/stubs/spec-save", requireTrustedWorkspaceOrigin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || typeof content !== "string") {
      res.status(400).json({ error: "Missing 'path' or 'content' in request body." });
      return;
    }
    await saveSpecContent(filePath, content);
    res.json({ success: true, message: `Spec '${filePath}' saved.` });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /api/stubs/spec-materialize - Materializes spec code into target source file
 */
app.post("/api/stubs/spec-materialize", requireTrustedWorkspaceOrigin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) {
      res.status(400).json({ error: "Missing 'path' in request body." });
      return;
    }
    const result = await materializeSpec(filePath);
    res.json({
      success: true,
      message: `Materialized spec into '${result.targetFile}' (${result.bytesWritten} bytes).`,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /api/stubs/spec-sand - Executes AST reverse sanding to reconcile sidecar frontmatter
 */
app.post("/api/stubs/spec-sand", requireTrustedWorkspaceOrigin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) {
      res.status(400).json({ error: "Missing 'path' in request body." });
      return;
    }
    const result = await sandSpec(filePath);
    res.json({
      success: true,
      message: result.message,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/stream - Server-Sent Events channel streaming CLI logs
 */
app.get("/api/stubs/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const writeSafe = (chunk: string) => {
    if (!res.writableEnded) {
      res.write(chunk);
    }
  };

  const listener = (data: unknown) => {
    writeSafe(`data: ${JSON.stringify(data)}\n\n`);
  };

  stubsEvents.on("log", listener);

  // Initial connection heartbeat
  writeSafe(`data: ${JSON.stringify({ type: "connect", text: "Connected to Stubs PWM event bus", timestamp: timeProvider.now() })}\n\n`);

  const keepaliveTimer = setInterval(() => {
    writeSafe(": keepalive\n\n");
  }, 25_000);
  keepaliveTimer.unref?.();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(keepaliveTimer);
    stubsEvents.off("log", listener);
  };

  req.on("close", cleanup);
  res.on("close", cleanup);
});

/**
 * POST /api/stubs/execute - Triggers a CLI command and streams stdout/stderr
 */
app.post("/api/stubs/execute", requireTrustedWorkspaceOrigin, stubsExecRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { command, args } = req.body;
    if (!command) {
      res.status(400).json({ error: "Missing 'command' parameter." });
      return;
    }
    const result = await runCliCommand(command, Array.isArray(args) ? args : []);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// ---------------------------------------------------------------------------
// Cloud & Developer Integrations (Firebase, Google Cloud, GitHub, Vercel)
// ---------------------------------------------------------------------------
const oauthPendingStates = new Map<string, { providerId: IntegrationProviderId; createdAt: number }>();

const getAppBaseUrl = (req: Request): string => {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== "MY_APP_URL" && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  const host = req.get("host") || `localhost:${PORT}`;
  const isHttps =
    req.protocol === "https" ||
    req.headers["x-forwarded-proto"] === "https" ||
    host.includes("run.app");
  return `${isHttps ? "https" : "http"}://${host}`;
};

const renderOAuthCallbackHtml = (payloadScript: string): string => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Authorization Complete</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #111; color: #f5f5f5;">
  <div style="text-align: center; padding: 24px;">
    <p id="status">Completing authorization...</p>
  </div>
  <script>
    (function() {
      ${payloadScript}
    })();
  </script>
</body>
</html>`;

app.get("/api/integrations/oauth/config", (_req: Request, res: Response): void => {
  const hasGoogleOAuth = Boolean(getOAuthClientId());
  const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
  const hasVercelOAuth = Boolean(process.env.VERCEL_CLIENT_ID?.trim() && process.env.VERCEL_CLIENT_SECRET?.trim());
  res.json({
    firebase: hasGoogleOAuth,
    gcp: hasGoogleOAuth,
    github: hasGitHubOAuth,
    vercel: hasVercelOAuth,
  });
});

app.get("/api/integrations/oauth/:provider/url", (req: Request, res: Response): void => {
  const provider = req.params.provider as IntegrationProviderId;
  if (!["firebase", "gcp", "github", "vercel"].includes(provider)) {
    res.status(400).json({ error: "Unsupported integration provider for OAuth." });
    return;
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/api/integrations/oauth/${provider}/callback`;
  const now = timeProvider.now();
  // Prune expired state tokens older than 10 minutes
  for (const [k, v] of oauthPendingStates) {
    if (now - v.createdAt > 10 * 60_000) oauthPendingStates.delete(k);
  }
  const state = crypto.randomBytes(16).toString("hex");
  oauthPendingStates.set(state, { providerId: provider, createdAt: now });

  if (provider === "github") {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || "";
    if (!clientId || !process.env.GITHUB_CLIENT_SECRET?.trim()) {
      res.json({ configured: false, url: "", redirectUri });
      return;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "repo read:user",
      state,
    });
    res.json({
      configured: true,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    });
    return;
  }

  if (provider === "vercel") {
    const clientId = process.env.VERCEL_CLIENT_ID?.trim() || "";
    if (!clientId || !process.env.VERCEL_CLIENT_SECRET?.trim()) {
      res.json({ configured: false, url: "", redirectUri });
      return;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });
    res.json({
      configured: true,
      url: `https://vercel.com/oauth/authorize?${params.toString()}`,
      redirectUri,
    });
    return;
  }

  // Firebase & Google Cloud Project OAuth
  const googleClientId = getOAuthClientId();
  if (!googleClientId) {
    res.json({ configured: false, url: "", redirectUri });
    return;
  }
  const scopes =
    provider === "firebase"
      ? "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase"
      : "https://www.googleapis.com/auth/cloud-platform";
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: scopes,
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  res.json({
    configured: true,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  });
});

app.get(
  ["/api/integrations/oauth/:provider/callback", "/api/integrations/oauth/:provider/callback/"],
  async (req: Request, res: Response): Promise<void> => {
    const provider = req.params.provider as IntegrationProviderId;
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error : "";

    const postAndClose = (payload: Record<string, unknown>) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(
        renderOAuthCallbackHtml(`
          var payload = ${JSON.stringify(payload)};
          if (window.opener) {
            window.opener.postMessage(payload, "*");
            window.close();
          } else {
            document.getElementById("status").textContent = payload.error ? ("Error: " + payload.error) : "Authorization complete. You may close this window.";
          }
        `)
      );
    };

    if (oauthError) {
      postAndClose({
        type: "INTEGRATION_OAUTH_SUCCESS",
        providerId: provider,
        error: oauthError,
      });
      return;
    }

    if (provider === "firebase" || provider === "gcp") {
      // Google implicit grant returns token in URL fragment (#access_token=...)
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(
        renderOAuthCallbackHtml(`
          var hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          var searchParams = new URLSearchParams(window.location.search);
          var token = hashParams.get("access_token") || "";
          var err = hashParams.get("error") || searchParams.get("error") || (!token ? "No access token returned by Google OAuth." : "");
          var payload = {
            type: "INTEGRATION_OAUTH_SUCCESS",
            providerId: ${JSON.stringify(provider)},
            token: token,
            error: err || undefined
          };
          if (window.opener) {
            window.opener.postMessage(payload, "*");
            window.close();
          } else {
            document.getElementById("status").textContent = err ? ("Error: " + err) : "Authorization complete. You may close this window.";
          }
        `)
      );
      return;
    }

    const pending = state ? oauthPendingStates.get(state) : undefined;
    if (!pending || pending.providerId !== provider) {
      postAndClose({
        type: "INTEGRATION_OAUTH_SUCCESS",
        providerId: provider,
        error: "Invalid or expired OAuth state parameter.",
      });
      return;
    }
    oauthPendingStates.delete(state);

    if (!code) {
      postAndClose({
        type: "INTEGRATION_OAUTH_SUCCESS",
        providerId: provider,
        error: "Missing authorization code.",
      });
      return;
    }

    const redirectUri = `${getAppBaseUrl(req)}/api/integrations/oauth/${provider}/callback`;

    try {
      if (provider === "github") {
        const clientId = process.env.GITHUB_CLIENT_ID?.trim() || "";
        const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || "";
        const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });
        const tokenData = (await tokenResp.json()) as { access_token?: string; error_description?: string; error?: string };
        if (!tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || "GitHub OAuth token exchange failed.");
        }
        let accountLabel: string | undefined;
        try {
          const userResp = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "ai-studio-mobile-integrations",
            },
          });
          if (userResp.ok) {
            const userData = (await userResp.json()) as { login?: string };
            if (userData.login) accountLabel = `@${userData.login}`;
          }
        } catch {
          // ignore optional profile fetch error
        }
        postAndClose({
          type: "INTEGRATION_OAUTH_SUCCESS",
          providerId: "github",
          token: tokenData.access_token,
          accountLabel,
        });
        return;
      }

      if (provider === "vercel") {
        const clientId = process.env.VERCEL_CLIENT_ID?.trim() || "";
        const clientSecret = process.env.VERCEL_CLIENT_SECRET?.trim() || "";
        const form = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        });
        const tokenResp = await fetch("https://api.vercel.com/v2/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        const tokenData = (await tokenResp.json()) as { access_token?: string; error_description?: string; error?: string };
        if (!tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || "Vercel OAuth token exchange failed.");
        }
        let accountLabel: string | undefined;
        try {
          const userResp = await fetch("https://api.vercel.com/v2/user", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (userResp.ok) {
            const userData = (await userResp.json()) as { user?: { username?: string; email?: string } };
            accountLabel = userData.user?.username || userData.user?.email;
          }
        } catch {
          // ignore
        }
        postAndClose({
          type: "INTEGRATION_OAUTH_SUCCESS",
          providerId: "vercel",
          token: tokenData.access_token,
          accountLabel,
        });
        return;
      }
    } catch (err) {
      postAndClose({
        type: "INTEGRATION_OAUTH_SUCCESS",
        providerId: provider,
        error: getErrorMessage(err),
      });
    }
  }
);

const CredentialsBodySchema = IntegrationVerifySchema;

async function handleIntegrationAction<TBody>(
  req: Request,
  res: Response,
  schema: { safeParse: (input: unknown) => { success: true; data: TBody } | { success: false; error: import("zod").ZodError } },
  handler: (data: TBody) => Promise<unknown>
): Promise<void> {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }
    const result = await handler(parsed.data);
    res.json(result);
  } catch (err) {
    if (err instanceof IntegrationHttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const status = getErrorStatus(err);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: getErrorMessage(err) || "Integration request failed.",
    });
  }
}

app.post("/api/integrations/verify", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, IntegrationVerifySchema, async ({ credentials }) =>
    verifyIntegrationConnection(credentials as IntegrationCredentialsPayload)
  )
);

// Firebase bi-directional endpoints
app.post("/api/integrations/firebase/projects", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listFirebaseProjects(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/firebase/collections", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listFirebaseCollections(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/firebase/documents/list", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, FirebaseListDocsSchema, async ({ credentials, collectionPath, pageSize }) =>
    listFirebaseDocuments(
      credentials as IntegrationCredentialsPayload,
      collectionPath || "",
      pageSize
    )
  )
);

app.post("/api/integrations/firebase/documents/write", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, FirebaseWriteDocSchema, async ({ credentials, collectionPath, docId, data, merge }) =>
    writeFirebaseDocument(
      credentials as IntegrationCredentialsPayload,
      collectionPath,
      data,
      docId,
      merge
    )
  )
);

app.post("/api/integrations/firebase/documents/delete", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, FirebaseDeleteDocSchema, async ({ credentials, documentPath }) =>
    deleteFirebaseDocument(credentials as IntegrationCredentialsPayload, documentPath)
  )
);

app.post("/api/integrations/firebase/rtdb/read", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, FirebaseRtdbSchema, async ({ credentials, dbUrl, path: rtdbPath }) =>
    readFirebaseRtdb(credentials as IntegrationCredentialsPayload, rtdbPath || "", dbUrl)
  )
);

app.post("/api/integrations/firebase/rtdb/write", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, FirebaseRtdbSchema, async ({ credentials, dbUrl, path: rtdbPath, data }) =>
    writeFirebaseRtdb(credentials as IntegrationCredentialsPayload, rtdbPath || "", data, dbUrl)
  )
);

// Google Cloud Project bi-directional endpoints
app.post("/api/integrations/gcp/projects", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listGcpProjects(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/gcp/buckets", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listGcsBuckets(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/gcp/objects/list", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GcpBucketObjectsSchema, async ({ credentials, bucket, prefix }) =>
    listGcsObjects(credentials as IntegrationCredentialsPayload, bucket, prefix)
  )
);

app.post("/api/integrations/gcp/objects/read", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GcpReadObjectSchema, async ({ credentials, bucket, objectName }) =>
    readGcsObject(credentials as IntegrationCredentialsPayload, bucket, objectName)
  )
);

app.post("/api/integrations/gcp/objects/write", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GcpWriteObjectSchema, async ({ credentials, bucket, objectName, content, contentType }) =>
    writeGcsObject(
      credentials as IntegrationCredentialsPayload,
      bucket,
      objectName,
      content,
      contentType
    )
  )
);

app.post("/api/integrations/gcp/objects/delete", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GcpReadObjectSchema, async ({ credentials, bucket, objectName }) =>
    deleteGcsObject(credentials as IntegrationCredentialsPayload, bucket, objectName)
  )
);

app.post("/api/integrations/gcp/secrets/list", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listGcpSecrets(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/gcp/secrets/access", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GcpSecretAccessSchema, async ({ credentials, secretId, version }) =>
    accessGcpSecret(credentials as IntegrationCredentialsPayload, secretId, version)
  )
);

app.post("/api/integrations/gcp/secrets/write", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GcpSecretWriteSchema, async ({ credentials, secretId, secretValue }) =>
    writeGcpSecret(credentials as IntegrationCredentialsPayload, secretId, secretValue)
  )
);

app.post("/api/integrations/gcp/cloudrun/services", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listCloudRunServices(credentials as IntegrationCredentialsPayload)
  )
);

// GitHub bi-directional endpoints
app.post("/api/integrations/github/repos", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listGitHubRepos(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/github/branches", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubRepoScopedSchema, async ({ credentials, owner, repo }) =>
    listGitHubBranches(credentials as IntegrationCredentialsPayload, owner, repo)
  )
);

app.post("/api/integrations/github/tree", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubRepoScopedSchema, async ({ credentials, owner, repo, branch }) =>
    getGitHubTree(credentials as IntegrationCredentialsPayload, owner, repo, branch || "main")
  )
);

app.post("/api/integrations/github/file/read", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubRepoScopedSchema, async ({ credentials, owner, repo, path: filePath, branch }) => {
    if (!filePath) throw new IntegrationHttpError("File path is required.", 400);
    return readGitHubFile(credentials as IntegrationCredentialsPayload, owner, repo, filePath, branch);
  })
);

app.post("/api/integrations/github/file/write", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubWriteFileSchema, async ({ credentials, owner, repo, branch, path: filePath, content, message, sha }) =>
    writeGitHubFile(credentials as IntegrationCredentialsPayload, {
      owner,
      repo,
      branch,
      path: filePath,
      content,
      message,
      sha,
    })
  )
);

app.post("/api/integrations/github/files/push", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubBatchPushSchema, async ({ credentials, owner, repo, branch, message, files }) =>
    batchPushGitHubFiles(credentials as IntegrationCredentialsPayload, {
      owner,
      repo,
      branch,
      message,
      files,
    })
  )
);

app.post("/api/integrations/github/file/delete", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubDeleteFileSchema, async ({ credentials, owner, repo, branch, path: filePath, message, sha }) =>
    deleteGitHubFile(credentials as IntegrationCredentialsPayload, {
      owner,
      repo,
      branch,
      path: filePath,
      message,
      sha,
    })
  )
);

app.post("/api/integrations/github/branch/create", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubCreateBranchSchema, async ({ credentials, owner, repo, newBranch, fromBranch }) =>
    createGitHubBranch(credentials as IntegrationCredentialsPayload, {
      owner,
      repo,
      newBranch,
      fromBranch,
    })
  )
);

app.post("/api/integrations/github/commits", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, GitHubRepoScopedSchema, async ({ credentials, owner, repo, branch }) =>
    listGitHubCommits(credentials as IntegrationCredentialsPayload, owner, repo, branch)
  )
);

// Vercel bi-directional endpoints
app.post("/api/integrations/vercel/teams", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listVercelTeams(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/vercel/projects", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, CredentialsBodySchema, async ({ credentials }) =>
    listVercelProjects(credentials as IntegrationCredentialsPayload)
  )
);

app.post("/api/integrations/vercel/deployments", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, VercelProjectScopedSchema, async ({ credentials, projectId }) =>
    listVercelDeployments(credentials as IntegrationCredentialsPayload, projectId)
  )
);

app.post("/api/integrations/vercel/env/list", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, VercelProjectScopedSchema, async ({ credentials, projectId }) =>
    listVercelEnvVars(credentials as IntegrationCredentialsPayload, projectId)
  )
);

app.post("/api/integrations/vercel/env/read", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, VercelDeleteEnvSchema, async ({ credentials, projectId, envId }) =>
    readVercelEnvVar(credentials as IntegrationCredentialsPayload, projectId, envId)
  )
);

app.post("/api/integrations/vercel/env/write", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, VercelUpsertEnvSchema, async ({ credentials, projectId, key, value, target, type }) =>
    upsertVercelEnvVar(credentials as IntegrationCredentialsPayload, {
      projectId,
      key,
      value,
      target,
      type,
    })
  )
);

app.post("/api/integrations/vercel/env/delete", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, VercelDeleteEnvSchema, async ({ credentials, projectId, envId }) =>
    deleteVercelEnvVar(credentials as IntegrationCredentialsPayload, projectId, envId)
  )
);

app.post("/api/integrations/vercel/deploy", requireTrustedWorkspaceOrigin, aiRateLimiter, (req, res) =>
  void handleIntegrationAction(req, res, VercelDeploySchema, async ({ credentials, projectId, name, target, files }) =>
    deployToVercel(credentials as IntegrationCredentialsPayload, {
      projectId,
      name,
      target,
      files,
    })
  )
);

  // Global Express error handler so malformed JSON/body errors return clean JSON instead of HTML stack traces
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const statusCode = getErrorStatus(err);
    const message = getErrorMessage(err) || "Internal server error.";
    defaultLogger.error("Unhandled Express error:", err);
    if (!res.headersSent) {
      res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({ error: message });
    }
  });

  return { app, stateStore };
}

function getErrorStatus(error: unknown): number {
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.statusCode === "number") return obj.statusCode;
    if (typeof obj.code === "number") return obj.code;

    const inner = typeof obj.error === "object" && obj.error !== null ? (obj.error as Record<string, unknown>) : null;
    if (inner && typeof inner.code === "number") return inner.code;
    if (inner && typeof inner.status === "number") return inner.status;

    const statusStr = typeof obj.status === "string" ? obj.status : inner && typeof inner.status === "string" ? inner.status : "";
    if (statusStr === "UNAVAILABLE") return 503;
    if (statusStr === "RESOURCE_EXHAUSTED") return 429;
    if (statusStr === "PERMISSION_DENIED") return 403;
    if (statusStr === "UNAUTHENTICATED") return 401;
    if (statusStr === "NOT_FOUND") return 404;
    if (statusStr === "INVALID_ARGUMENT") return 400;
  }
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.error?.code === "number") return parsed.error.code;
        if (parsed?.error?.status === "UNAVAILABLE") return 503;
        if (parsed?.error?.status === "RESOURCE_EXHAUSTED") return 429;
      } catch {
        // Ignore JSON parse error
      }
    }
  }
  return 500;
}

export async function startServer(): Promise<http.Server> {
  const { app, stateStore } = createApp();

  // Vite dev middleware or static serving
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response): void => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    defaultLogger.info(`AI Studio Android Server listening on http://0.0.0.0:${PORT}`);
  });

  const pruneInterval = setInterval(() => {
    try {
      stateStore.pruneExpiredSessions();
    } catch (err) {
      defaultLogger.warn("Failed pruning expired sessions:", err);
    }
  }, 60 * 60 * 1000);
  pruneInterval.unref?.();

  let shuttingDown = false;
  const shutdown = (signal: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(pruneInterval);
    defaultLogger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      stateStore.close();
      closeStubsDatabase();
      process.exit(exitCode);
    });
    setTimeout(() => {
      stateStore.close();
      closeStubsDatabase();
      process.exit(exitCode || 1);
    }, 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM", 0));
  process.on("SIGINT", () => shutdown("SIGINT", 0));
  process.on("unhandledRejection", (reason) => {
    defaultLogger.error("Unhandled promise rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    defaultLogger.error("Uncaught exception:", err);
    shutdown("uncaughtException", 1);
  });

  return server;
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  void startServer();
}
