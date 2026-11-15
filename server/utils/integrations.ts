import crypto from "node:crypto";
import {
  FirebaseDocumentSummary,
  FirebaseProjectSummary,
  GcpCloudRunServiceSummary,
  GcpProjectSummary,
  GcpSecretSummary,
  GcsBucketSummary,
  GcsObjectSummary,
  GitHubBranchSummary,
  GitHubCommitSummary,
  GitHubRepoSummary,
  GitHubTreeEntry,
  IntegrationCredentialsPayload,
  VercelDeploymentSummary,
  VercelEnvVarSummary,
  VercelProjectSummary,
  VercelTeamSummary,
} from "../../src/types/integrations";
import { getErrorMessage } from "../../src/utils/errorHandling";

const INTEGRATION_TIMEOUT_MS = 25_000;
const TOKEN_CACHE_SKEW_MS = 60_000;

interface CachedGoogleToken {
  accessToken: string;
  expiresAt: number;
  clientEmail: string;
  projectId?: string;
}

const googleServiceTokenCache = new Map<string, CachedGoogleToken>();

export class IntegrationHttpError extends Error {
  public readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "IntegrationHttpError";
    this.status = status;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = INTEGRATION_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Upstream integration request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonOrTextError(resp: Response, fallbackPrefix: string): Promise<string> {
  const raw = await resp.text().catch(() => "");
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "object" && parsed.error?.message) {
      return `${fallbackPrefix} (${resp.status}): ${parsed.error.message}`;
    }
    if (typeof parsed.error === "string" && parsed.error) {
      return `${fallbackPrefix} (${resp.status}): ${parsed.error}`;
    }
    if (parsed.message) {
      return `${fallbackPrefix} (${resp.status}): ${parsed.message}`;
    }
  } catch {
    // keep raw text
  }
  return raw ? `${fallbackPrefix} (${resp.status}): ${raw.slice(0, 280)}` : `${fallbackPrefix} (${resp.status})`;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface ServiceAccountKey {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  token_uri?: string;
}

function parseServiceAccountJson(rawJson: string): ServiceAccountKey {
  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(rawJson) as ServiceAccountKey;
  } catch {
    throw new IntegrationHttpError("Invalid Service Account JSON format.", 400);
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new IntegrationHttpError(
      "Service Account JSON must include 'client_email' and 'private_key'.",
      400
    );
  }
  return parsed;
}

/**
 * Mints a real Google OAuth2 access token from a Service Account JSON key using RS256 JWT assertion.
 */
export async function resolveGoogleAuthContext(
  credentials: IntegrationCredentialsPayload
): Promise<{ accessToken: string; projectId: string; accountLabel?: string }> {
  const explicitProjectId = credentials.projectId?.trim() || "";

  if (credentials.serviceAccountJson?.trim()) {
    const sa = parseServiceAccountJson(credentials.serviceAccountJson.trim());
    const projectId = explicitProjectId || sa.project_id || "";
    const scopes =
      credentials.providerId === "firebase"
        ? "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform"
        : "https://www.googleapis.com/auth/cloud-platform";

    const cacheKey = crypto
      .createHash("sha256")
      .update(`${sa.client_email}:${sa.private_key}:${scopes}`)
      .digest("hex");
    const cached = googleServiceTokenCache.get(cacheKey);
    if (cached && cached.expiresAt - TOKEN_CACHE_SKEW_MS > Date.now()) {
      return {
        accessToken: cached.accessToken,
        projectId: projectId || cached.projectId || "",
        accountLabel: cached.clientEmail,
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: sa.client_email,
        scope: scopes,
        aud: tokenUri,
        exp: nowSec + 3600,
        iat: nowSec,
      })
    );
    const signingInput = `${header}.${payload}`;
    let signature: string;
    try {
      const signer = crypto.createSign("RSA-SHA256");
      signer.update(signingInput);
      signer.end();
      signature = base64UrlEncode(signer.sign(sa.private_key!));
    } catch (err) {
      throw new IntegrationHttpError(
        `Failed to sign Service Account JWT: ${getErrorMessage(err)}`,
        400
      );
    }

    const assertion = `${signingInput}.${signature}`;
    const tokenResp = await fetchWithTimeout(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });

    if (!tokenResp.ok) {
      throw new IntegrationHttpError(
        await parseJsonOrTextError(tokenResp, "Google OAuth token exchange failed"),
        tokenResp.status
      );
    }

    const tokenJson = (await tokenResp.json()) as { access_token?: string; expires_in?: number };
    if (!tokenJson.access_token) {
      throw new IntegrationHttpError("Google OAuth did not return an access_token.", 401);
    }

    const expiresAt = Date.now() + (tokenJson.expires_in || 3600) * 1000;
    googleServiceTokenCache.set(cacheKey, {
      accessToken: tokenJson.access_token,
      expiresAt,
      clientEmail: sa.client_email!,
      projectId: sa.project_id,
    });

    return {
      accessToken: tokenJson.access_token,
      projectId,
      accountLabel: sa.client_email,
    };
  }

  const token = credentials.token?.trim();
  if (!token) {
    throw new IntegrationHttpError(
      "Service Account JSON or Google OAuth access token is required.",
      400
    );
  }

  return {
    accessToken: token,
    projectId: explicitProjectId,
  };
}

async function fetchGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const resp = await fetchWithTimeout("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as { email?: string; name?: string };
    return data.email || data.name;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Firestore Value Encoding / Decoding
// ============================================================================

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { referenceValue: string }
  | { geoPointValue: { latitude: number; longitude: number } };

export function decodeFirestoreValue(val: unknown): unknown {
  if (!val || typeof val !== "object") return null;
  const v = val as Record<string, unknown>;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return String(v.stringValue);
  if ("timestampValue" in v) return String(v.timestampValue);
  if ("referenceValue" in v) return String(v.referenceValue);
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("arrayValue" in v) {
    const arr = (v.arrayValue as { values?: unknown[] } | undefined)?.values;
    return Array.isArray(arr) ? arr.map(decodeFirestoreValue) : [];
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, unknown> } | undefined)?.fields;
    return decodeFirestoreFields(fields);
  }
  return null;
}

export function decodeFirestoreFields(fields?: Record<string, unknown>): Record<string, unknown> {
  if (!fields || typeof fields !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = decodeFirestoreValue(val);
  }
  return result;
}

export function encodeFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === "object") {
    return { mapValue: { fields: encodeFirestoreFields(val as Record<string, unknown>) } };
  }
  return { stringValue: String(val) };
}

export function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return fields;
}

function normalizeCollectionOrDocPath(rawPath: string): string {
  return rawPath.trim().replace(/^\/+|\/+$/g, "");
}

function encodeResourcePath(relPath: string): string {
  return normalizeCollectionOrDocPath(relPath)
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

// ============================================================================
// Verification
// ============================================================================

export async function verifyIntegrationConnection(
  credentials: IntegrationCredentialsPayload
): Promise<{ valid: boolean; accountLabel?: string; projectId?: string; details?: string; error?: string }> {
  try {
    if (credentials.providerId === "github") {
      const token = credentials.token?.trim();
      if (!token) return { valid: false, error: "GitHub token is required." };
      const resp = await fetchWithTimeout("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "AI-Studio-Integrations",
        },
      });
      if (!resp.ok) {
        return { valid: false, error: await parseJsonOrTextError(resp, "GitHub auth failed") };
      }
      const user = (await resp.json()) as { login: string; name?: string };
      const scopes = resp.headers.get("x-oauth-scopes") || "";
      return {
        valid: true,
        accountLabel: `@${user.login}`,
        details: scopes ? `Scopes: ${scopes}` : "GitHub account connected",
      };
    }

    if (credentials.providerId === "vercel") {
      const token = credentials.token?.trim();
      if (!token) return { valid: false, error: "Vercel access token is required." };
      const resp = await fetchWithTimeout("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        return { valid: false, error: await parseJsonOrTextError(resp, "Vercel auth failed") };
      }
      const data = (await resp.json()) as { user?: { username?: string; email?: string; name?: string } };
      const label = data.user?.username || data.user?.email || data.user?.name || "Vercel User";
      // Also verify projects access (including optional teamId)
      const teamQuery = credentials.teamId?.trim() ? `&teamId=${encodeURIComponent(credentials.teamId.trim())}` : "";
      const projResp = await fetchWithTimeout(`https://api.vercel.com/v9/projects?limit=1${teamQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!projResp.ok) {
        return { valid: false, error: await parseJsonOrTextError(projResp, "Vercel project scope failed") };
      }
      return {
        valid: true,
        accountLabel: label,
        details: credentials.teamId?.trim() ? `Team: ${credentials.teamId.trim()}` : "Personal account",
      };
    }

    if (credentials.providerId === "firebase") {
      const ctx = await resolveGoogleAuthContext(credentials);
      const emailLabel = ctx.accountLabel || (await fetchGoogleUserEmail(ctx.accessToken));
      let resolvedProjectId = ctx.projectId;
      let discoveredCount = 0;

      if (!resolvedProjectId) {
        try {
          const fbProjects = await listFirebaseProjects(credentials);
          discoveredCount = fbProjects.projects.length;
          resolvedProjectId = fbProjects.projects[0]?.projectId || "";
        } catch {
          // ignore discovery errors; verify token via userinfo below
        }
      }

      if (!resolvedProjectId) {
        if (credentials.authMethod === "service_account") {
          return { valid: false, error: "Firebase Project ID is required." };
        }
        if (!emailLabel) {
          return {
            valid: false,
            error: "Could not verify Google OAuth token or discover Firebase projects.",
          };
        }
        return {
          valid: true,
          accountLabel: emailLabel,
          details: "Google account connected · Select or enter a Firebase project",
        };
      }

      const dbId = credentials.databaseId?.trim() || "(default)";
      const resp = await fetchWithTimeout(
        `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(resolvedProjectId)}/databases/${encodeURIComponent(dbId)}/documents:listCollectionIds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pageSize: 20 }),
        }
      );
      if (!resp.ok) {
        // When connecting via Google OAuth without typing projectId beforehand, Firestore may not be initialized on the first project yet
        if (!ctx.projectId && emailLabel) {
          return {
            valid: true,
            projectId: resolvedProjectId,
            accountLabel: emailLabel,
            details: discoveredCount > 0 ? `${discoveredCount} Firebase project${discoveredCount === 1 ? "" : "s"} found` : `Connected as ${emailLabel}`,
          };
        }
        return { valid: false, error: await parseJsonOrTextError(resp, "Firebase Firestore check failed") };
      }
      const json = (await resp.json()) as { collectionIds?: string[] };
      const count = json.collectionIds?.length || 0;
      return {
        valid: true,
        projectId: resolvedProjectId,
        accountLabel: emailLabel || resolvedProjectId,
        details: `Firestore (${dbId}) · ${count} root collections`,
      };
    }

    if (credentials.providerId === "gcp") {
      const ctx = await resolveGoogleAuthContext(credentials);
      const emailLabel = ctx.accountLabel || (await fetchGoogleUserEmail(ctx.accessToken));
      if (!ctx.projectId) {
        const projResp = await fetchWithTimeout(
          "https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE&pageSize=10",
          { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
        );
        if (projResp.ok) {
          const projJson = (await projResp.json()) as { projects?: Array<{ projectId: string }> };
          const firstId = projJson.projects?.[0]?.projectId;
          if (firstId) {
            return {
              valid: true,
              projectId: firstId,
              accountLabel: emailLabel || firstId,
              details: `${projJson.projects?.length || 1} accessible projects`,
            };
          }
        }
        if (credentials.authMethod !== "service_account" && emailLabel) {
          return {
            valid: true,
            accountLabel: emailLabel,
            details: "Google account connected · Select a GCP project",
          };
        }
        return { valid: false, error: "Google Cloud Project ID is required." };
      }

      // Check GCS buckets or Resource Manager for the project
      const bucketsResp = await fetchWithTimeout(
        `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(ctx.projectId)}&maxResults=10`,
        { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
      );
      if (bucketsResp.ok) {
        const bJson = (await bucketsResp.json()) as { items?: unknown[] };
        return {
          valid: true,
          projectId: ctx.projectId,
          accountLabel: emailLabel || ctx.projectId,
          details: `Project ${ctx.projectId} · ${bJson.items?.length || 0} GCS buckets`,
        };
      }

      const crmResp = await fetchWithTimeout(
        `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}`,
        { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
      );
      if (!crmResp.ok) {
        return { valid: false, error: await parseJsonOrTextError(crmResp, "GCP project verification failed") };
      }
      return {
        valid: true,
        projectId: ctx.projectId,
        accountLabel: emailLabel || ctx.projectId,
        details: `Project ${ctx.projectId} verified`,
      };
    }

    return { valid: false, error: "Unsupported integration provider." };
  } catch (err) {
    return { valid: false, error: getErrorMessage(err) };
  }
}

// ============================================================================
// Firebase Firestore & RTDB Operations
// ============================================================================

export async function listFirebaseCollections(
  credentials: IntegrationCredentialsPayload
): Promise<{ collectionIds: string[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("Firebase Project ID is required.", 400);
  const dbId = credentials.databaseId?.trim() || "(default)";
  const resp = await fetchWithTimeout(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/databases/${encodeURIComponent(dbId)}/documents:listCollectionIds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pageSize: 100 }),
    }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List collections failed"), resp.status);
  }
  const data = (await resp.json()) as { collectionIds?: string[] };
  return { collectionIds: data.collectionIds || [] };
}

function mapFirestoreDoc(raw: {
  name?: string;
  fields?: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}): FirebaseDocumentSummary {
  const fullName = raw.name || "";
  const marker = "/documents/";
  const idx = fullName.indexOf(marker);
  const relPath = idx >= 0 ? fullName.slice(idx + marker.length) : fullName;
  const parts = relPath.split("/");
  return {
    id: parts[parts.length - 1] || relPath,
    path: relPath,
    data: decodeFirestoreFields(raw.fields),
    createTime: raw.createTime,
    updateTime: raw.updateTime,
  };
}

export async function listFirebaseDocuments(
  credentials: IntegrationCredentialsPayload,
  collectionPath: string,
  pageSize = 50
): Promise<{ documents: FirebaseDocumentSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("Firebase Project ID is required.", 400);
  const dbId = credentials.databaseId?.trim() || "(default)";
  const encodedPath = encodeResourcePath(collectionPath);
  if (!encodedPath) throw new IntegrationHttpError("Collection path is required.", 400);

  const resp = await fetchWithTimeout(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/databases/${encodeURIComponent(dbId)}/documents/${encodedPath}?pageSize=${pageSize}`,
    {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List documents failed"), resp.status);
  }
  const json = (await resp.json()) as {
    documents?: Array<{
      name?: string;
      fields?: Record<string, unknown>;
      createTime?: string;
      updateTime?: string;
    }>;
  };
  return {
    documents: (json.documents || []).map(mapFirestoreDoc),
  };
}

export async function writeFirebaseDocument(
  credentials: IntegrationCredentialsPayload,
  collectionPath: string,
  data: Record<string, unknown>,
  docId?: string,
  merge = false
): Promise<{ document: FirebaseDocumentSummary }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("Firebase Project ID is required.", 400);
  const dbId = credentials.databaseId?.trim() || "(default)";
  const encodedCollection = encodeResourcePath(collectionPath);
  if (!encodedCollection) throw new IntegrationHttpError("Collection path is required.", 400);

  const encodedFields = encodeFirestoreFields(data);
  const cleanDocId = docId?.trim();

  let url: string;
  let method: "POST" | "PATCH";

  if (cleanDocId) {
    method = "PATCH";
    const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/databases/${encodeURIComponent(dbId)}/documents/${encodedCollection}/${encodeURIComponent(cleanDocId)}`;
    if (merge) {
      const maskParams = Object.keys(encodedFields)
        .map((k) => {
          const masked = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `\`${k}\``;
          return `updateMask.fieldPaths=${encodeURIComponent(masked)}`;
        })
        .join("&");
      url = maskParams ? `${baseDocUrl}?${maskParams}` : baseDocUrl;
    } else {
      url = baseDocUrl;
    }
  } else {
    method = "POST";
    url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/databases/${encodeURIComponent(dbId)}/documents/${encodedCollection}`;
  }

  const resp = await fetchWithTimeout(url, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: encodedFields }),
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Write Firestore document failed"), resp.status);
  }
  const saved = (await resp.json()) as {
    name?: string;
    fields?: Record<string, unknown>;
    createTime?: string;
    updateTime?: string;
  };
  return { document: mapFirestoreDoc(saved) };
}

export async function deleteFirebaseDocument(
  credentials: IntegrationCredentialsPayload,
  documentPath: string
): Promise<{ success: boolean }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("Firebase Project ID is required.", 400);
  const dbId = credentials.databaseId?.trim() || "(default)";
  const encodedDocPath = encodeResourcePath(documentPath);
  if (!encodedDocPath) throw new IntegrationHttpError("Document path is required.", 400);

  const resp = await fetchWithTimeout(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/databases/${encodeURIComponent(dbId)}/documents/${encodedDocPath}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Delete Firestore document failed"), resp.status);
  }
  return { success: true };
}

function resolveRtdbUrl(projectId: string, rawDbUrl?: string, relPath = ""): string {
  const cleanRel = normalizeCollectionOrDocPath(relPath);
  const suffix = cleanRel ? `/${encodeResourcePath(cleanRel)}.json` : "/.json";
  if (rawDbUrl?.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(rawDbUrl.trim());
    } catch {
      throw new IntegrationHttpError("Invalid Realtime Database URL.", 400);
    }
    if (
      parsed.protocol !== "https:" ||
      (!parsed.hostname.endsWith(".firebaseio.com") && !parsed.hostname.endsWith(".firebasedatabase.app"))
    ) {
      throw new IntegrationHttpError("Realtime Database URL must be a valid *.firebaseio.com or *.firebasedatabase.app HTTPS URL.", 400);
    }
    return `${parsed.origin}${suffix}`;
  }
  return `https://${encodeURIComponent(projectId)}-default-rtdb.firebaseio.com${suffix}`;
}

export async function readFirebaseRtdb(
  credentials: IntegrationCredentialsPayload,
  relPath: string,
  dbUrl?: string
): Promise<{ data: unknown; url: string }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId && !dbUrl?.trim()) {
    throw new IntegrationHttpError("Firebase Project ID or RTDB URL is required.", 400);
  }
  const url = resolveRtdbUrl(ctx.projectId, dbUrl, relPath);
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "RTDB read failed"), resp.status);
  }
  const data = await resp.json();
  return { data, url };
}

export async function writeFirebaseRtdb(
  credentials: IntegrationCredentialsPayload,
  relPath: string,
  data: unknown,
  dbUrl?: string
): Promise<{ data: unknown; url: string }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId && !dbUrl?.trim()) {
    throw new IntegrationHttpError("Firebase Project ID or RTDB URL is required.", 400);
  }
  const url = resolveRtdbUrl(ctx.projectId, dbUrl, relPath);
  const resp = await fetchWithTimeout(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "RTDB write failed"), resp.status);
  }
  const saved = await resp.json();
  return { data: saved, url };
}

export async function listFirebaseProjects(
  credentials: IntegrationCredentialsPayload
): Promise<{ projects: FirebaseProjectSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  const fbResp = await fetchWithTimeout("https://firebase.googleapis.com/v1beta1/projects?pageSize=25", {
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
  });
  if (fbResp.ok) {
    const json = (await fbResp.json()) as {
      results?: Array<{
        projectId: string;
        displayName?: string;
        projectNumber?: string;
        resources?: {
          storageBucket?: string;
          realtimeDatabaseInstance?: string;
        };
      }>;
    };
    const mapped = (json.results || []).map((p) => ({
      projectId: p.projectId,
      displayName: p.displayName || p.projectId,
      projectNumber: p.projectNumber,
      storageBucket: p.resources?.storageBucket,
      rtdbUrl: p.resources?.realtimeDatabaseInstance
        ? `https://${p.resources.realtimeDatabaseInstance}.firebaseio.com`
        : undefined,
    }));
    if (mapped.length > 0) {
      return { projects: mapped };
    }
  }

  // Fallback to Cloud Resource Manager active projects when Firebase Management API isn't enabled
  const crmResp = await fetchWithTimeout(
    "https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE&pageSize=50",
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!crmResp.ok) {
    if (!fbResp.ok) {
      throw new IntegrationHttpError(await parseJsonOrTextError(fbResp, "List Firebase projects failed"), fbResp.status);
    }
    return { projects: [] };
  }
  const crmJson = (await crmResp.json()) as {
    projects?: Array<{ projectId: string; name?: string; projectNumber?: string }>;
  };
  return {
    projects: (crmJson.projects || []).map((p) => ({
      projectId: p.projectId,
      displayName: p.name || p.projectId,
      projectNumber: p.projectNumber,
    })),
  };
}

// ============================================================================
// Google Cloud Project (Resource Manager, Cloud Storage, Secret Manager, Cloud Run)
// ============================================================================

export async function listGcpProjects(
  credentials: IntegrationCredentialsPayload
): Promise<{ projects: GcpProjectSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  const resp = await fetchWithTimeout(
    "https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE&pageSize=50",
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List GCP projects failed"), resp.status);
  }
  const json = (await resp.json()) as {
    projects?: Array<{ projectId: string; name?: string; projectNumber?: string; lifecycleState?: string }>;
  };
  return {
    projects: (json.projects || []).map((p) => ({
      projectId: p.projectId,
      name: p.name || p.projectId,
      projectNumber: p.projectNumber,
      lifecycleState: p.lifecycleState,
    })),
  };
}

export async function listGcsBuckets(
  credentials: IntegrationCredentialsPayload
): Promise<{ buckets: GcsBucketSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("GCP Project ID is required.", 400);
  const resp = await fetchWithTimeout(
    `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(ctx.projectId)}&maxResults=100`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List GCS buckets failed"), resp.status);
  }
  const json = (await resp.json()) as {
    items?: Array<{ name: string; location?: string; storageClass?: string; timeCreated?: string }>;
  };
  return {
    buckets: (json.items || []).map((b) => ({
      name: b.name,
      location: b.location,
      storageClass: b.storageClass,
      timeCreated: b.timeCreated,
    })),
  };
}

export async function listGcsObjects(
  credentials: IntegrationCredentialsPayload,
  bucket: string,
  prefix?: string
): Promise<{ objects: GcsObjectSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  const qs = new URLSearchParams({ maxResults: "100" });
  if (prefix?.trim()) qs.set("prefix", prefix.trim());

  const resp = await fetchWithTimeout(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${qs.toString()}`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List GCS objects failed"), resp.status);
  }
  const json = (await resp.json()) as {
    items?: Array<{ name: string; bucket?: string; size?: string | number; contentType?: string; updated?: string }>;
  };
  return {
    objects: (json.items || []).map((o) => ({
      name: o.name,
      bucket: o.bucket || bucket,
      size: Number(o.size || 0),
      contentType: o.contentType,
      updated: o.updated,
    })),
  };
}

export async function readGcsObject(
  credentials: IntegrationCredentialsPayload,
  bucket: string,
  objectName: string
): Promise<{ content: string; contentType: string; size: number }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  const metaResp = await fetchWithTimeout(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  let contentType = "text/plain";
  let size = 0;
  if (metaResp.ok) {
    const meta = (await metaResp.json()) as { contentType?: string; size?: string | number };
    contentType = meta.contentType || contentType;
    size = Number(meta.size || 0);
  }

  const resp = await fetchWithTimeout(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Read GCS object failed"), resp.status);
  }
  const content = await resp.text();
  return {
    content,
    contentType: resp.headers.get("content-type") || contentType,
    size: size || Buffer.byteLength(content, "utf8"),
  };
}

export async function writeGcsObject(
  credentials: IntegrationCredentialsPayload,
  bucket: string,
  objectName: string,
  content: string,
  contentType = "text/plain; charset=utf-8"
): Promise<{ object: GcsObjectSummary }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  const cleanName = objectName.trim().replace(/^\/+/, "");
  const resp = await fetchWithTimeout(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(cleanName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": contentType,
      },
      body: content,
    }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Upload GCS object failed"), resp.status);
  }
  const obj = (await resp.json()) as {
    name: string;
    bucket?: string;
    size?: string | number;
    contentType?: string;
    updated?: string;
  };
  return {
    object: {
      name: obj.name,
      bucket: obj.bucket || bucket,
      size: Number(obj.size || Buffer.byteLength(content, "utf8")),
      contentType: obj.contentType || contentType,
      updated: obj.updated,
    },
  };
}

export async function deleteGcsObject(
  credentials: IntegrationCredentialsPayload,
  bucket: string,
  objectName: string
): Promise<{ success: boolean }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  const resp = await fetchWithTimeout(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Delete GCS object failed"), resp.status);
  }
  return { success: true };
}

export async function listGcpSecrets(
  credentials: IntegrationCredentialsPayload
): Promise<{ secrets: GcpSecretSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("GCP Project ID is required.", 400);
  const resp = await fetchWithTimeout(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/secrets?pageSize=50`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List secrets failed"), resp.status);
  }
  const json = (await resp.json()) as {
    secrets?: Array<{ name: string; createTime?: string; replication?: { automatic?: unknown } }>;
  };
  return {
    secrets: (json.secrets || []).map((s) => ({
      name: s.name,
      shortName: s.name.split("/").pop() || s.name,
      createTime: s.createTime,
      replication: s.replication?.automatic ? "automatic" : "user-managed",
    })),
  };
}

export async function accessGcpSecret(
  credentials: IntegrationCredentialsPayload,
  secretId: string,
  version = "latest"
): Promise<{ value: string; name: string }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("GCP Project ID is required.", 400);
  const resp = await fetchWithTimeout(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/secrets/${encodeURIComponent(secretId)}/versions/${encodeURIComponent(version)}:access`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Access secret failed"), resp.status);
  }
  const json = (await resp.json()) as { name?: string; payload?: { data?: string } };
  const decoded = json.payload?.data ? Buffer.from(json.payload.data, "base64").toString("utf8") : "";
  return { value: decoded, name: json.name || secretId };
}

export async function writeGcpSecret(
  credentials: IntegrationCredentialsPayload,
  secretId: string,
  secretValue: string
): Promise<{ name: string; versionName: string }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("GCP Project ID is required.", 400);

  // Create secret if it does not exist yet
  const createResp = await fetchWithTimeout(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/secrets?secretId=${encodeURIComponent(secretId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ replication: { automatic: {} } }),
    }
  );
  if (!createResp.ok && createResp.status !== 409) {
    throw new IntegrationHttpError(await parseJsonOrTextError(createResp, "Create secret failed"), createResp.status);
  }

  const versionResp = await fetchWithTimeout(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/secrets/${encodeURIComponent(secretId)}:addVersion`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: { data: Buffer.from(secretValue, "utf8").toString("base64") },
      }),
    }
  );
  if (!versionResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(versionResp, "Add secret version failed"), versionResp.status);
  }
  const vJson = (await versionResp.json()) as { name: string };
  return { name: secretId, versionName: vJson.name };
}

export async function listCloudRunServices(
  credentials: IntegrationCredentialsPayload
): Promise<{ services: GcpCloudRunServiceSummary[] }> {
  const ctx = await resolveGoogleAuthContext(credentials);
  if (!ctx.projectId) throw new IntegrationHttpError("GCP Project ID is required.", 400);
  const resp = await fetchWithTimeout(
    `https://run.googleapis.com/v2/projects/${encodeURIComponent(ctx.projectId)}/locations/-/services?pageSize=50`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List Cloud Run services failed"), resp.status);
  }
  const json = (await resp.json()) as {
    services?: Array<{ name: string; uri?: string; updateTime?: string }>;
  };
  return {
    services: (json.services || []).map((s) => {
      const parts = s.name.split("/");
      const locIdx = parts.indexOf("locations");
      return {
        name: s.name,
        shortName: parts[parts.length - 1] || s.name,
        region: locIdx >= 0 ? parts[locIdx + 1] : undefined,
        uri: s.uri,
        updateTime: s.updateTime,
      };
    }),
  };
}

// ============================================================================
// GitHub Operations
// ============================================================================

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AI-Studio-Integrations",
  };
}

function requireGitHubToken(credentials: IntegrationCredentialsPayload): string {
  const token = credentials.token?.trim();
  if (!token) throw new IntegrationHttpError("GitHub access token is required.", 400);
  return token;
}

export async function listGitHubRepos(
  credentials: IntegrationCredentialsPayload
): Promise<{ repos: GitHubRepoSummary[] }> {
  const token = requireGitHubToken(credentials);
  const resp = await fetchWithTimeout(
    "https://api.github.com/user/repos?sort=updated&per_page=60&affiliation=owner,collaborator,organization_member",
    { headers: githubHeaders(token) }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List GitHub repos failed"), resp.status);
  }
  const list = (await resp.json()) as Array<{
    id: number;
    name: string;
    full_name: string;
    owner?: { login?: string };
    private: boolean;
    default_branch: string;
    description?: string;
    html_url: string;
    updated_at?: string;
  }>;
  return {
    repos: list.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || r.full_name.split("/")[0],
      private: Boolean(r.private),
      defaultBranch: r.default_branch || "main",
      description: r.description || undefined,
      htmlUrl: r.html_url,
      updatedAt: r.updated_at,
    })),
  };
}

export async function listGitHubBranches(
  credentials: IntegrationCredentialsPayload,
  owner: string,
  repo: string
): Promise<{ branches: GitHubBranchSummary[] }> {
  const token = requireGitHubToken(credentials);
  const resp = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=50`,
    { headers: githubHeaders(token) }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List branches failed"), resp.status);
  }
  const list = (await resp.json()) as Array<{
    name: string;
    commit?: { sha?: string };
    protected?: boolean;
  }>;
  return {
    branches: list.map((b) => ({
      name: b.name,
      sha: b.commit?.sha || "",
      protected: b.protected,
    })),
  };
}

export async function getGitHubTree(
  credentials: IntegrationCredentialsPayload,
  owner: string,
  repo: string,
  branch: string
): Promise<{ entries: GitHubTreeEntry[]; truncated: boolean }> {
  const token = requireGitHubToken(credentials);
  const resp = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: githubHeaders(token) }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Fetch GitHub tree failed"), resp.status);
  }
  const json = (await resp.json()) as {
    truncated?: boolean;
    tree?: Array<{ path: string; type: "blob" | "tree"; sha: string; size?: number }>;
  };
  return {
    entries: (json.tree || [])
      .filter((item) => item.type === "blob" || item.type === "tree")
      .slice(0, 1500)
      .map((item) => ({
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: item.size,
      })),
    truncated: Boolean(json.truncated),
  };
}

export async function readGitHubFile(
  credentials: IntegrationCredentialsPayload,
  owner: string,
  repo: string,
  filePath: string,
  branch?: string
): Promise<{ content: string; sha: string; size: number; path: string; htmlUrl?: string }> {
  const token = requireGitHubToken(credentials);
  const cleanPath = encodeResourcePath(filePath);
  const refQuery = branch?.trim() ? `?ref=${encodeURIComponent(branch.trim())}` : "";
  const resp = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}${refQuery}`,
    { headers: githubHeaders(token) }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Read GitHub file failed"), resp.status);
  }
  const json = (await resp.json()) as {
    type?: string;
    content?: string;
    encoding?: string;
    sha: string;
    size: number;
    path: string;
    html_url?: string;
  };
  if (json.type !== "file") {
    throw new IntegrationHttpError("Selected GitHub path is a directory, not a file.", 400);
  }
  const content =
    json.encoding === "base64" && json.content
      ? Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8")
      : json.content || "";
  return {
    content,
    sha: json.sha,
    size: json.size,
    path: json.path,
    htmlUrl: json.html_url,
  };
}

export async function writeGitHubFile(
  credentials: IntegrationCredentialsPayload,
  params: {
    owner: string;
    repo: string;
    branch?: string;
    path: string;
    content: string;
    message: string;
    sha?: string;
  }
): Promise<{ sha: string; commitSha: string; htmlUrl?: string }> {
  const token = requireGitHubToken(credentials);
  const cleanPath = encodeResourcePath(params.path);
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/contents/${cleanPath}`;

  let resolvedSha = params.sha?.trim();
  if (!resolvedSha) {
    // Auto-lookup existing file SHA if updating an existing file without an explicit SHA
    const refQuery = params.branch?.trim() ? `?ref=${encodeURIComponent(params.branch.trim())}` : "";
    const existingResp = await fetchWithTimeout(`${endpoint}${refQuery}`, {
      headers: githubHeaders(token),
    });
    if (existingResp.ok) {
      const existing = (await existingResp.json()) as { sha?: string };
      resolvedSha = existing.sha;
    }
  }

  const body: Record<string, unknown> = {
    message: params.message,
    content: Buffer.from(params.content, "utf8").toString("base64"),
  };
  if (params.branch?.trim()) body.branch = params.branch.trim();
  if (resolvedSha) body.sha = resolvedSha;

  const resp = await fetchWithTimeout(endpoint, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "GitHub commit failed"), resp.status);
  }
  const json = (await resp.json()) as {
    content?: { sha?: string; html_url?: string };
    commit?: { sha?: string; html_url?: string };
  };
  return {
    sha: json.content?.sha || "",
    commitSha: json.commit?.sha || "",
    htmlUrl: json.commit?.html_url || json.content?.html_url,
  };
}

export async function batchPushGitHubFiles(
  credentials: IntegrationCredentialsPayload,
  params: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: Array<{ path: string; content: string }>;
  }
): Promise<{ commitSha: string; htmlUrl?: string; filesCount: number }> {
  const token = requireGitHubToken(credentials);
  const baseRepoUrl = `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}`;
  const headers = { ...githubHeaders(token), "Content-Type": "application/json" };

  // 1. Get branch head ref
  const refResp = await fetchWithTimeout(
    `${baseRepoUrl}/git/ref/heads/${encodeURIComponent(params.branch)}`,
    { headers }
  );
  if (!refResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(refResp, "Fetch branch head failed"), refResp.status);
  }
  const refJson = (await refResp.json()) as { object: { sha: string } };
  const headCommitSha = refJson.object.sha;

  // 2. Get base tree SHA from head commit
  const commitResp = await fetchWithTimeout(`${baseRepoUrl}/git/commits/${headCommitSha}`, { headers });
  if (!commitResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(commitResp, "Fetch commit failed"), commitResp.status);
  }
  const commitJson = (await commitResp.json()) as { tree: { sha: string } };
  const baseTreeSha = commitJson.tree.sha;

  // 3. Create blobs for each file
  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const f of params.files) {
    const cleanFilePath = normalizeCollectionOrDocPath(f.path);
    const blobResp = await fetchWithTimeout(`${baseRepoUrl}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: Buffer.from(f.content, "utf8").toString("base64"),
        encoding: "base64",
      }),
    });
    if (!blobResp.ok) {
      throw new IntegrationHttpError(await parseJsonOrTextError(blobResp, `Create blob failed for ${cleanFilePath}`), blobResp.status);
    }
    const blobJson = (await blobResp.json()) as { sha: string };
    treeEntries.push({
      path: cleanFilePath,
      mode: "100644",
      type: "blob",
      sha: blobJson.sha,
    });
  }

  // 4. Create new tree
  const treeResp = await fetchWithTimeout(`${baseRepoUrl}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries,
    }),
  });
  if (!treeResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(treeResp, "Create git tree failed"), treeResp.status);
  }
  const treeJson = (await treeResp.json()) as { sha: string };

  // 5. Create commit
  const newCommitResp = await fetchWithTimeout(`${baseRepoUrl}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: params.message,
      tree: treeJson.sha,
      parents: [headCommitSha],
    }),
  });
  if (!newCommitResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(newCommitResp, "Create git commit failed"), newCommitResp.status);
  }
  const newCommitJson = (await newCommitResp.json()) as { sha: string; html_url?: string };

  // 6. Update branch ref
  const updateRefResp = await fetchWithTimeout(
    `${baseRepoUrl}/git/refs/heads/${encodeURIComponent(params.branch)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommitJson.sha }),
    }
  );
  if (!updateRefResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(updateRefResp, "Update branch ref failed"), updateRefResp.status);
  }

  return {
    commitSha: newCommitJson.sha,
    htmlUrl: newCommitJson.html_url,
    filesCount: treeEntries.length,
  };
}

export async function deleteGitHubFile(
  credentials: IntegrationCredentialsPayload,
  params: {
    owner: string;
    repo: string;
    branch?: string;
    path: string;
    message: string;
    sha: string;
  }
): Promise<{ success: boolean }> {
  const token = requireGitHubToken(credentials);
  const cleanPath = encodeResourcePath(params.path);
  const body: Record<string, unknown> = {
    message: params.message,
    sha: params.sha,
  };
  if (params.branch?.trim()) body.branch = params.branch.trim();

  const resp = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/contents/${cleanPath}`,
    {
      method: "DELETE",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Delete GitHub file failed"), resp.status);
  }
  return { success: true };
}

export async function createGitHubBranch(
  credentials: IntegrationCredentialsPayload,
  params: {
    owner: string;
    repo: string;
    newBranch: string;
    fromBranch?: string;
  }
): Promise<{ ref: string; sha: string }> {
  const token = requireGitHubToken(credentials);
  const baseRepoUrl = `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}`;
  let sourceBranch = params.fromBranch?.trim();
  if (!sourceBranch) {
    const repoResp = await fetchWithTimeout(baseRepoUrl, { headers: githubHeaders(token) });
    if (repoResp.ok) {
      const repoJson = (await repoResp.json()) as { default_branch?: string };
      sourceBranch = repoJson.default_branch || "main";
    } else {
      sourceBranch = "main";
    }
  }

  const refResp = await fetchWithTimeout(`${baseRepoUrl}/git/ref/heads/${encodeURIComponent(sourceBranch)}`, {
    headers: githubHeaders(token),
  });
  if (!refResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(refResp, "Source branch lookup failed"), refResp.status);
  }
  const refJson = (await refResp.json()) as { object: { sha: string } };

  const createResp = await fetchWithTimeout(`${baseRepoUrl}/git/refs`, {
    method: "POST",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: `refs/heads/${params.newBranch.trim()}`,
      sha: refJson.object.sha,
    }),
  });
  if (!createResp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(createResp, "Create branch failed"), createResp.status);
  }
  const created = (await createResp.json()) as { ref: string; object: { sha: string } };
  return { ref: created.ref, sha: created.object.sha };
}

export async function listGitHubCommits(
  credentials: IntegrationCredentialsPayload,
  owner: string,
  repo: string,
  branch?: string
): Promise<{ commits: GitHubCommitSummary[] }> {
  const token = requireGitHubToken(credentials);
  const qs = new URLSearchParams({ per_page: "15" });
  if (branch?.trim()) qs.set("sha", branch.trim());

  const resp = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${qs.toString()}`,
    { headers: githubHeaders(token) }
  );
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List commits failed"), resp.status);
  }
  const list = (await resp.json()) as Array<{
    sha: string;
    html_url: string;
    commit?: {
      message?: string;
      author?: { name?: string; date?: string };
    };
  }>;
  return {
    commits: list.map((c) => ({
      sha: c.sha,
      message: c.commit?.message || "",
      authorName: c.commit?.author?.name || "Unknown",
      date: c.commit?.author?.date,
      htmlUrl: c.html_url,
    })),
  };
}

// ============================================================================
// Vercel Operations
// ============================================================================

function requireVercelToken(credentials: IntegrationCredentialsPayload): string {
  const token = credentials.token?.trim();
  if (!token) throw new IntegrationHttpError("Vercel access token is required.", 400);
  return token;
}

function appendTeamId(url: string, teamId?: string): string {
  const cleanTeam = teamId?.trim();
  if (!cleanTeam) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}teamId=${encodeURIComponent(cleanTeam)}`;
}

export async function listVercelTeams(
  credentials: IntegrationCredentialsPayload
): Promise<{ teams: VercelTeamSummary[] }> {
  const token = requireVercelToken(credentials);
  const resp = await fetchWithTimeout("https://api.vercel.com/v2/teams?limit=25", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List Vercel teams failed"), resp.status);
  }
  const json = (await resp.json()) as {
    teams?: Array<{ id: string; slug: string; name?: string }>;
  };
  return {
    teams: (json.teams || []).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name || t.slug,
    })),
  };
}

export async function listVercelProjects(
  credentials: IntegrationCredentialsPayload
): Promise<{ projects: VercelProjectSummary[] }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId("https://api.vercel.com/v9/projects?limit=50", credentials.teamId);
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List Vercel projects failed"), resp.status);
  }
  const json = (await resp.json()) as {
    projects?: Array<{
      id: string;
      name: string;
      framework?: string;
      updatedAt?: number;
      latestDeployments?: Array<{ url?: string }>;
    }>;
  };
  return {
    projects: (json.projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      framework: p.framework || undefined,
      updatedAt: p.updatedAt,
      latestDeploymentUrl: p.latestDeployments?.[0]?.url
        ? `https://${p.latestDeployments[0].url}`
        : undefined,
    })),
  };
}

export async function listVercelDeployments(
  credentials: IntegrationCredentialsPayload,
  projectId: string
): Promise<{ deployments: VercelDeploymentSummary[] }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId(
    `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=20`,
    credentials.teamId
  );
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List Vercel deployments failed"), resp.status);
  }
  const json = (await resp.json()) as {
    deployments?: Array<{
      uid: string;
      name: string;
      url: string;
      state?: string;
      readyState?: string;
      target?: string;
      createdAt?: number;
      inspectorUrl?: string;
    }>;
  };
  return {
    deployments: (json.deployments || []).map((d) => ({
      uid: d.uid,
      name: d.name,
      url: d.url ? (d.url.startsWith("http") ? d.url : `https://${d.url}`) : "",
      state: d.readyState || d.state || "UNKNOWN",
      target: d.target || undefined,
      createdAt: d.createdAt,
      inspectorUrl: d.inspectorUrl,
    })),
  };
}

export async function listVercelEnvVars(
  credentials: IntegrationCredentialsPayload,
  projectId: string
): Promise<{ envs: VercelEnvVarSummary[] }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env`,
    credentials.teamId
  );
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "List Vercel env vars failed"), resp.status);
  }
  const json = (await resp.json()) as {
    envs?: Array<{
      id: string;
      key: string;
      value?: string;
      type: string;
      target?: string[];
      updatedAt?: number;
    }>;
  };
  return {
    envs: (json.envs || []).map((e) => ({
      id: e.id,
      key: e.key,
      value: e.value,
      type: e.type,
      target: Array.isArray(e.target) ? e.target : [],
      updatedAt: e.updatedAt,
    })),
  };
}

export async function readVercelEnvVar(
  credentials: IntegrationCredentialsPayload,
  projectId: string,
  envId: string
): Promise<{ env: VercelEnvVarSummary }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId(
    `https://api.vercel.com/v1/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
    credentials.teamId
  );
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Read Vercel env var failed"), resp.status);
  }
  const e = (await resp.json()) as {
    id: string;
    key: string;
    value?: string;
    type: string;
    target?: string[];
    updatedAt?: number;
  };
  return {
    env: {
      id: e.id,
      key: e.key,
      value: e.value,
      type: e.type,
      target: Array.isArray(e.target) ? e.target : [],
      updatedAt: e.updatedAt,
    },
  };
}

export async function upsertVercelEnvVar(
  credentials: IntegrationCredentialsPayload,
  params: {
    projectId: string;
    key: string;
    value: string;
    target: Array<"production" | "preview" | "development">;
    type?: "encrypted" | "plain" | "sensitive";
  }
): Promise<{ env: VercelEnvVarSummary }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(params.projectId)}/env?upsert=true`,
    credentials.teamId
  );
  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: params.key.trim(),
      value: params.value,
      target: params.target,
      type: params.type || "encrypted",
    }),
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Upsert Vercel env var failed"), resp.status);
  }
  const json = (await resp.json()) as {
    created?: { id: string; key: string; type: string; target?: string[]; updatedAt?: number };
    id?: string;
    key?: string;
    type?: string;
    target?: string[];
    updatedAt?: number;
  };
  const item = json.created || json;
  return {
    env: {
      id: item.id || params.key,
      key: item.key || params.key,
      type: item.type || params.type || "encrypted",
      target: item.target || params.target,
      updatedAt: item.updatedAt,
    },
  };
}

export async function deleteVercelEnvVar(
  credentials: IntegrationCredentialsPayload,
  projectId: string,
  envId: string
): Promise<{ success: boolean }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
    credentials.teamId
  );
  const resp = await fetchWithTimeout(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Delete Vercel env var failed"), resp.status);
  }
  return { success: true };
}

export async function deployToVercel(
  credentials: IntegrationCredentialsPayload,
  params: {
    projectId?: string;
    name: string;
    target?: "production" | "preview";
    files: Array<{ file: string; data: string }>;
  }
): Promise<{ deployment: VercelDeploymentSummary }> {
  const token = requireVercelToken(credentials);
  const url = appendTeamId("https://api.vercel.com/v13/deployments", credentials.teamId);

  const payload: Record<string, unknown> = {
    name: params.name.trim(),
    files: params.files.map((f) => ({
      file: f.file.replace(/^\/+/, ""),
      data: f.data,
    })),
    projectSettings: {
      framework: null,
    },
  };
  if (params.projectId?.trim()) {
    payload.project = params.projectId.trim();
  }
  if (params.target === "production") {
    payload.target = "production";
  }

  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new IntegrationHttpError(await parseJsonOrTextError(resp, "Vercel deployment failed"), resp.status);
  }
  const d = (await resp.json()) as {
    id: string;
    name: string;
    url: string;
    readyState?: string;
    status?: string;
    target?: string;
    createdAt?: number;
    inspectorUrl?: string;
  };
  return {
    deployment: {
      uid: d.id,
      name: d.name || params.name,
      url: d.url ? (d.url.startsWith("http") ? d.url : `https://${d.url}`) : "",
      state: d.readyState || d.status || "BUILDING",
      target: d.target || params.target,
      createdAt: d.createdAt,
      inspectorUrl: d.inspectorUrl,
    },
  };
}
