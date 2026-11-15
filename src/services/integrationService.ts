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
  IntegrationProviderId,
  VercelDeploymentSummary,
  VercelEnvVarSummary,
  VercelProjectSummary,
  VercelTeamSummary,
} from "../types/integrations";
import { IApiClient } from "../utils/apiClient";
import { IPlatformService } from "./IPlatformService";

export interface OAuthProviderAvailability {
  firebase: boolean;
  gcp: boolean;
  github: boolean;
  vercel: boolean;
}

export interface IntegrationVerifyResponse {
  valid: boolean;
  accountLabel?: string;
  projectId?: string;
  details?: string;
  error?: string;
}

export interface IIntegrationApiService {
  getOAuthAvailability(): Promise<OAuthProviderAvailability>;
  getOAuthUrl(providerId: IntegrationProviderId): Promise<{ url: string; configured: boolean; redirectUri: string }>;
  openOAuthPopup(
    providerId: IntegrationProviderId
  ): Promise<{ providerId: IntegrationProviderId; token: string; accountLabel?: string }>;
  verifyConnection(credentials: IntegrationCredentialsPayload): Promise<IntegrationVerifyResponse>;

  // Firebase
  listFirebaseProjects(credentials: IntegrationCredentialsPayload): Promise<{ projects: FirebaseProjectSummary[] }>;
  listFirebaseCollections(credentials: IntegrationCredentialsPayload): Promise<{ collectionIds: string[] }>;
  listFirebaseDocuments(
    credentials: IntegrationCredentialsPayload,
    collectionPath: string,
    pageSize?: number
  ): Promise<{ documents: FirebaseDocumentSummary[] }>;
  writeFirebaseDocument(
    credentials: IntegrationCredentialsPayload,
    collectionPath: string,
    data: Record<string, unknown>,
    docId?: string,
    merge?: boolean
  ): Promise<{ document: FirebaseDocumentSummary }>;
  deleteFirebaseDocument(
    credentials: IntegrationCredentialsPayload,
    documentPath: string
  ): Promise<{ success: boolean }>;
  readFirebaseRtdb(
    credentials: IntegrationCredentialsPayload,
    path: string,
    dbUrl?: string
  ): Promise<{ data: unknown; url: string }>;
  writeFirebaseRtdb(
    credentials: IntegrationCredentialsPayload,
    path: string,
    data: unknown,
    dbUrl?: string
  ): Promise<{ data: unknown; url: string }>;

  // Google Cloud Project
  listGcpProjects(credentials: IntegrationCredentialsPayload): Promise<{ projects: GcpProjectSummary[] }>;
  listGcsBuckets(credentials: IntegrationCredentialsPayload): Promise<{ buckets: GcsBucketSummary[] }>;
  listGcsObjects(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    prefix?: string
  ): Promise<{ objects: GcsObjectSummary[] }>;
  readGcsObject(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    objectName: string
  ): Promise<{ content: string; contentType: string; size: number }>;
  writeGcsObject(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    objectName: string,
    content: string,
    contentType?: string
  ): Promise<{ object: GcsObjectSummary }>;
  deleteGcsObject(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    objectName: string
  ): Promise<{ success: boolean }>;
  listGcpSecrets(credentials: IntegrationCredentialsPayload): Promise<{ secrets: GcpSecretSummary[] }>;
  accessGcpSecret(
    credentials: IntegrationCredentialsPayload,
    secretId: string,
    version?: string
  ): Promise<{ value: string; name: string }>;
  writeGcpSecret(
    credentials: IntegrationCredentialsPayload,
    secretId: string,
    secretValue: string
  ): Promise<{ name: string; versionName: string }>;
  listCloudRunServices(
    credentials: IntegrationCredentialsPayload
  ): Promise<{ services: GcpCloudRunServiceSummary[] }>;

  // GitHub
  listGitHubRepos(credentials: IntegrationCredentialsPayload): Promise<{ repos: GitHubRepoSummary[] }>;
  listGitHubBranches(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string
  ): Promise<{ branches: GitHubBranchSummary[] }>;
  getGitHubTree(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string,
    branch: string
  ): Promise<{ entries: GitHubTreeEntry[]; truncated: boolean }>;
  readGitHubFile(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<{ content: string; sha: string; size: number; path: string; htmlUrl?: string }>;
  writeGitHubFile(
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
  ): Promise<{ sha: string; commitSha: string; htmlUrl?: string }>;
  batchPushGitHubFiles(
    credentials: IntegrationCredentialsPayload,
    params: {
      owner: string;
      repo: string;
      branch: string;
      message: string;
      files: Array<{ path: string; content: string }>;
    }
  ): Promise<{ commitSha: string; htmlUrl?: string; filesCount: number }>;
  deleteGitHubFile(
    credentials: IntegrationCredentialsPayload,
    params: {
      owner: string;
      repo: string;
      branch?: string;
      path: string;
      message: string;
      sha: string;
    }
  ): Promise<{ success: boolean }>;
  createGitHubBranch(
    credentials: IntegrationCredentialsPayload,
    params: {
      owner: string;
      repo: string;
      newBranch: string;
      fromBranch?: string;
    }
  ): Promise<{ ref: string; sha: string }>;
  listGitHubCommits(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<{ commits: GitHubCommitSummary[] }>;

  // Vercel
  listVercelTeams(credentials: IntegrationCredentialsPayload): Promise<{ teams: VercelTeamSummary[] }>;
  listVercelProjects(credentials: IntegrationCredentialsPayload): Promise<{ projects: VercelProjectSummary[] }>;
  listVercelDeployments(
    credentials: IntegrationCredentialsPayload,
    projectId: string
  ): Promise<{ deployments: VercelDeploymentSummary[] }>;
  listVercelEnvVars(
    credentials: IntegrationCredentialsPayload,
    projectId: string
  ): Promise<{ envs: VercelEnvVarSummary[] }>;
  readVercelEnvVar(
    credentials: IntegrationCredentialsPayload,
    projectId: string,
    envId: string
  ): Promise<{ env: VercelEnvVarSummary }>;
  upsertVercelEnvVar(
    credentials: IntegrationCredentialsPayload,
    params: {
      projectId: string;
      key: string;
      value: string;
      target: Array<"production" | "preview" | "development">;
      type?: "encrypted" | "plain" | "sensitive";
    }
  ): Promise<{ env: VercelEnvVarSummary }>;
  deleteVercelEnvVar(
    credentials: IntegrationCredentialsPayload,
    projectId: string,
    envId: string
  ): Promise<{ success: boolean }>;
  deployToVercel(
    credentials: IntegrationCredentialsPayload,
    params: {
      projectId?: string;
      name: string;
      target?: "production" | "preview";
      files: Array<{ file: string; data: string }>;
    }
  ): Promise<{ deployment: VercelDeploymentSummary }>;
}

export class IntegrationApiService implements IIntegrationApiService {
  private apiClient: IApiClient;
  private platformService: IPlatformService;

  constructor(config: { apiClient: IApiClient; platformService: IPlatformService }) {
    this.apiClient = config.apiClient;
    this.platformService = config.platformService;
  }

  private post<T>(endpoint: string, body: unknown, defaultError: string): Promise<T> {
    return this.apiClient.fetch<T>(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      defaultError
    );
  }

  public getOAuthAvailability(): Promise<OAuthProviderAvailability> {
    return this.apiClient.fetch<OAuthProviderAvailability>(
      "/api/integrations/oauth/config",
      undefined,
      "Failed to check OAuth availability"
    );
  }

  public getOAuthUrl(
    providerId: IntegrationProviderId
  ): Promise<{ url: string; configured: boolean; redirectUri: string }> {
    return this.apiClient.fetch<{ url: string; configured: boolean; redirectUri: string }>(
      `/api/integrations/oauth/${providerId}/url`,
      undefined,
      "Failed to get OAuth authorization URL"
    );
  }

  public async openOAuthPopup(
    providerId: IntegrationProviderId
  ): Promise<{ providerId: IntegrationProviderId; token: string; accountLabel?: string }> {
    const { url, configured } = await this.getOAuthUrl(providerId);
    if (!configured || !url) {
      throw new Error(`OAuth is not configured on the server for ${providerId}.`);
    }

    return new Promise((resolve, reject) => {
      const win = this.platformService.getWindow();
      const width = 560;
      const height = 680;
      const left = win ? win.screenX + (win.outerWidth - width) / 2 : 0;
      const top = win ? win.screenY + (win.outerHeight - height) / 2 : 0;

      const popup = win?.open(
        url,
        `integration_oauth_${providerId}`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        reject(new Error("Popup blocked. Please allow popups for this site and try again."));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        const currentOrigin = win?.location?.origin || "";
        const originAllowed =
          !event.origin ||
          event.origin === currentOrigin ||
          event.origin.endsWith(".run.app") ||
          event.origin.includes("localhost");
        if (!originAllowed) return;

        if (
          event.data &&
          event.data.type === "INTEGRATION_OAUTH_SUCCESS" &&
          event.data.providerId === providerId
        ) {
          cleanup();
          if (event.data.error) {
            reject(new Error(String(event.data.error)));
            return;
          }
          resolve({
            providerId,
            token: String(event.data.token || ""),
            accountLabel: event.data.accountLabel ? String(event.data.accountLabel) : undefined,
          });
        }
      };

      const removeListener = this.platformService.addEventListener("message", handleMessage);
      const pollTimer = this.platformService.setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error("Authentication popup closed before completing."));
        }
      }, 800);

      const cleanup = () => {
        removeListener();
        this.platformService.clearInterval(pollTimer);
      };
    });
  }

  public verifyConnection(credentials: IntegrationCredentialsPayload): Promise<IntegrationVerifyResponse> {
    return this.post("/api/integrations/verify", { credentials }, "Failed to verify integration");
  }

  // Firebase
  public listFirebaseProjects(credentials: IntegrationCredentialsPayload) {
    return this.post<{ projects: FirebaseProjectSummary[] }>(
      "/api/integrations/firebase/projects",
      { credentials },
      "Failed to list Firebase projects"
    );
  }

  public listFirebaseCollections(credentials: IntegrationCredentialsPayload) {
    return this.post<{ collectionIds: string[] }>(
      "/api/integrations/firebase/collections",
      { credentials },
      "Failed to list Firestore collections"
    );
  }

  public listFirebaseDocuments(
    credentials: IntegrationCredentialsPayload,
    collectionPath: string,
    pageSize = 50
  ) {
    return this.post<{ documents: FirebaseDocumentSummary[] }>(
      "/api/integrations/firebase/documents/list",
      { credentials, collectionPath, pageSize },
      "Failed to list Firestore documents"
    );
  }

  public writeFirebaseDocument(
    credentials: IntegrationCredentialsPayload,
    collectionPath: string,
    data: Record<string, unknown>,
    docId?: string,
    merge = false
  ) {
    return this.post<{ document: FirebaseDocumentSummary }>(
      "/api/integrations/firebase/documents/write",
      { credentials, collectionPath, docId, data, merge },
      "Failed to write Firestore document"
    );
  }

  public deleteFirebaseDocument(
    credentials: IntegrationCredentialsPayload,
    documentPath: string
  ) {
    return this.post<{ success: boolean }>(
      "/api/integrations/firebase/documents/delete",
      { credentials, documentPath },
      "Failed to delete Firestore document"
    );
  }

  public readFirebaseRtdb(
    credentials: IntegrationCredentialsPayload,
    path: string,
    dbUrl?: string
  ) {
    return this.post<{ data: unknown; url: string }>(
      "/api/integrations/firebase/rtdb/read",
      { credentials, path, dbUrl },
      "Failed to read Realtime Database"
    );
  }

  public writeFirebaseRtdb(
    credentials: IntegrationCredentialsPayload,
    path: string,
    data: unknown,
    dbUrl?: string
  ) {
    return this.post<{ data: unknown; url: string }>(
      "/api/integrations/firebase/rtdb/write",
      { credentials, path, data, dbUrl },
      "Failed to write Realtime Database"
    );
  }

  // Google Cloud Project
  public listGcpProjects(credentials: IntegrationCredentialsPayload) {
    return this.post<{ projects: GcpProjectSummary[] }>(
      "/api/integrations/gcp/projects",
      { credentials },
      "Failed to list GCP projects"
    );
  }

  public listGcsBuckets(credentials: IntegrationCredentialsPayload) {
    return this.post<{ buckets: GcsBucketSummary[] }>(
      "/api/integrations/gcp/buckets",
      { credentials },
      "Failed to list GCS buckets"
    );
  }

  public listGcsObjects(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    prefix?: string
  ) {
    return this.post<{ objects: GcsObjectSummary[] }>(
      "/api/integrations/gcp/objects/list",
      { credentials, bucket, prefix },
      "Failed to list GCS objects"
    );
  }

  public readGcsObject(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    objectName: string
  ) {
    return this.post<{ content: string; contentType: string; size: number }>(
      "/api/integrations/gcp/objects/read",
      { credentials, bucket, objectName },
      "Failed to read GCS object"
    );
  }

  public writeGcsObject(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    objectName: string,
    content: string,
    contentType = "text/plain; charset=utf-8"
  ) {
    return this.post<{ object: GcsObjectSummary }>(
      "/api/integrations/gcp/objects/write",
      { credentials, bucket, objectName, content, contentType },
      "Failed to write GCS object"
    );
  }

  public deleteGcsObject(
    credentials: IntegrationCredentialsPayload,
    bucket: string,
    objectName: string
  ) {
    return this.post<{ success: boolean }>(
      "/api/integrations/gcp/objects/delete",
      { credentials, bucket, objectName },
      "Failed to delete GCS object"
    );
  }

  public listGcpSecrets(credentials: IntegrationCredentialsPayload) {
    return this.post<{ secrets: GcpSecretSummary[] }>(
      "/api/integrations/gcp/secrets/list",
      { credentials },
      "Failed to list Secret Manager secrets"
    );
  }

  public accessGcpSecret(
    credentials: IntegrationCredentialsPayload,
    secretId: string,
    version = "latest"
  ) {
    return this.post<{ value: string; name: string }>(
      "/api/integrations/gcp/secrets/access",
      { credentials, secretId, version },
      "Failed to access secret version"
    );
  }

  public writeGcpSecret(
    credentials: IntegrationCredentialsPayload,
    secretId: string,
    secretValue: string
  ) {
    return this.post<{ name: string; versionName: string }>(
      "/api/integrations/gcp/secrets/write",
      { credentials, secretId, secretValue },
      "Failed to write secret version"
    );
  }

  public listCloudRunServices(credentials: IntegrationCredentialsPayload) {
    return this.post<{ services: GcpCloudRunServiceSummary[] }>(
      "/api/integrations/gcp/cloudrun/services",
      { credentials },
      "Failed to list Cloud Run services"
    );
  }

  // GitHub
  public listGitHubRepos(credentials: IntegrationCredentialsPayload) {
    return this.post<{ repos: GitHubRepoSummary[] }>(
      "/api/integrations/github/repos",
      { credentials },
      "Failed to list GitHub repositories"
    );
  }

  public listGitHubBranches(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string
  ) {
    return this.post<{ branches: GitHubBranchSummary[] }>(
      "/api/integrations/github/branches",
      { credentials, owner, repo },
      "Failed to list GitHub branches"
    );
  }

  public getGitHubTree(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string,
    branch: string
  ) {
    return this.post<{ entries: GitHubTreeEntry[]; truncated: boolean }>(
      "/api/integrations/github/tree",
      { credentials, owner, repo, branch },
      "Failed to fetch GitHub repository tree"
    );
  }

  public readGitHubFile(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ) {
    return this.post<{ content: string; sha: string; size: number; path: string; htmlUrl?: string }>(
      "/api/integrations/github/file/read",
      { credentials, owner, repo, path, branch },
      "Failed to read GitHub file"
    );
  }

  public writeGitHubFile(
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
  ) {
    return this.post<{ sha: string; commitSha: string; htmlUrl?: string }>(
      "/api/integrations/github/file/write",
      { credentials, ...params },
      "Failed to commit file to GitHub"
    );
  }

  public batchPushGitHubFiles(
    credentials: IntegrationCredentialsPayload,
    params: {
      owner: string;
      repo: string;
      branch: string;
      message: string;
      files: Array<{ path: string; content: string }>;
    }
  ) {
    return this.post<{ commitSha: string; htmlUrl?: string; filesCount: number }>(
      "/api/integrations/github/files/push",
      { credentials, ...params },
      "Failed to push files to GitHub"
    );
  }

  public deleteGitHubFile(
    credentials: IntegrationCredentialsPayload,
    params: {
      owner: string;
      repo: string;
      branch?: string;
      path: string;
      message: string;
      sha: string;
    }
  ) {
    return this.post<{ success: boolean }>(
      "/api/integrations/github/file/delete",
      { credentials, ...params },
      "Failed to delete GitHub file"
    );
  }

  public createGitHubBranch(
    credentials: IntegrationCredentialsPayload,
    params: {
      owner: string;
      repo: string;
      newBranch: string;
      fromBranch?: string;
    }
  ) {
    return this.post<{ ref: string; sha: string }>(
      "/api/integrations/github/branch/create",
      { credentials, ...params },
      "Failed to create GitHub branch"
    );
  }

  public listGitHubCommits(
    credentials: IntegrationCredentialsPayload,
    owner: string,
    repo: string,
    branch?: string
  ) {
    return this.post<{ commits: GitHubCommitSummary[] }>(
      "/api/integrations/github/commits",
      { credentials, owner, repo, branch },
      "Failed to list GitHub commits"
    );
  }

  // Vercel
  public listVercelTeams(credentials: IntegrationCredentialsPayload) {
    return this.post<{ teams: VercelTeamSummary[] }>(
      "/api/integrations/vercel/teams",
      { credentials },
      "Failed to list Vercel teams"
    );
  }

  public listVercelProjects(credentials: IntegrationCredentialsPayload) {
    return this.post<{ projects: VercelProjectSummary[] }>(
      "/api/integrations/vercel/projects",
      { credentials },
      "Failed to list Vercel projects"
    );
  }

  public listVercelDeployments(credentials: IntegrationCredentialsPayload, projectId: string) {
    return this.post<{ deployments: VercelDeploymentSummary[] }>(
      "/api/integrations/vercel/deployments",
      { credentials, projectId },
      "Failed to list Vercel deployments"
    );
  }

  public listVercelEnvVars(credentials: IntegrationCredentialsPayload, projectId: string) {
    return this.post<{ envs: VercelEnvVarSummary[] }>(
      "/api/integrations/vercel/env/list",
      { credentials, projectId },
      "Failed to list Vercel environment variables"
    );
  }

  public readVercelEnvVar(
    credentials: IntegrationCredentialsPayload,
    projectId: string,
    envId: string
  ) {
    return this.post<{ env: VercelEnvVarSummary }>(
      "/api/integrations/vercel/env/read",
      { credentials, projectId, envId },
      "Failed to read Vercel environment variable"
    );
  }

  public upsertVercelEnvVar(
    credentials: IntegrationCredentialsPayload,
    params: {
      projectId: string;
      key: string;
      value: string;
      target: Array<"production" | "preview" | "development">;
      type?: "encrypted" | "plain" | "sensitive";
    }
  ) {
    return this.post<{ env: VercelEnvVarSummary }>(
      "/api/integrations/vercel/env/write",
      { credentials, ...params },
      "Failed to save Vercel environment variable"
    );
  }

  public deleteVercelEnvVar(
    credentials: IntegrationCredentialsPayload,
    projectId: string,
    envId: string
  ) {
    return this.post<{ success: boolean }>(
      "/api/integrations/vercel/env/delete",
      { credentials, projectId, envId },
      "Failed to delete Vercel environment variable"
    );
  }

  public deployToVercel(
    credentials: IntegrationCredentialsPayload,
    params: {
      projectId?: string;
      name: string;
      target?: "production" | "preview";
      files: Array<{ file: string; data: string }>;
    }
  ) {
    return this.post<{ deployment: VercelDeploymentSummary }>(
      "/api/integrations/vercel/deploy",
      { credentials, ...params },
      "Failed to deploy to Vercel"
    );
  }
}
