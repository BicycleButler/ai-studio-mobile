export type IntegrationProviderId = "firebase" | "gcp" | "github" | "vercel";

export type IntegrationAuthMethod = "token" | "service_account" | "oauth";

export interface IntegrationConnection {
  id: string;
  providerId: IntegrationProviderId;
  name: string;
  authMethod: IntegrationAuthMethod;
  token?: string;
  serviceAccountJson?: string;
  projectId?: string;
  databaseId?: string;
  region?: string;
  bucket?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  teamId?: string;
  accountLabel?: string;
  enabled: boolean;
  status?: "connected" | "error" | "unverified";
  statusMessage?: string;
  lastVerifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface IntegrationCredentialsPayload {
  providerId: IntegrationProviderId;
  authMethod?: IntegrationAuthMethod;
  token?: string;
  serviceAccountJson?: string;
  projectId?: string;
  databaseId?: string;
  teamId?: string;
}

export interface RemoteFileSource {
  providerId: "workspace" | IntegrationProviderId;
  connectionId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  sha?: string;
  bucket?: string;
  objectName?: string;
  collectionPath?: string;
  docId?: string;
}

export interface FirebaseDocumentSummary {
  id: string;
  path: string;
  data: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}

export interface FirebaseProjectSummary {
  projectId: string;
  displayName: string;
  projectNumber?: string;
  storageBucket?: string;
  rtdbUrl?: string;
}

export interface GcpProjectSummary {
  projectId: string;
  name: string;
  projectNumber?: string;
  lifecycleState?: string;
}

export interface GcsBucketSummary {
  name: string;
  location?: string;
  storageClass?: string;
  timeCreated?: string;
}

export interface GcsObjectSummary {
  name: string;
  bucket: string;
  size: number;
  contentType?: string;
  updated?: string;
}

export interface GcpSecretSummary {
  name: string;
  shortName: string;
  createTime?: string;
  replication?: string;
}

export interface GcpCloudRunServiceSummary {
  name: string;
  shortName: string;
  uri?: string;
  region?: string;
  updateTime?: string;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  description?: string;
  htmlUrl: string;
  updatedAt?: string;
}

export interface GitHubBranchSummary {
  name: string;
  sha: string;
  protected?: boolean;
}

export interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  authorName: string;
  date?: string;
  htmlUrl: string;
}

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework?: string;
  updatedAt?: number;
  latestDeploymentUrl?: string;
}

export interface VercelTeamSummary {
  id: string;
  slug: string;
  name: string;
}

export interface VercelDeploymentSummary {
  uid: string;
  name: string;
  url: string;
  state: string;
  target?: string;
  createdAt?: number;
  inspectorUrl?: string;
}

export interface VercelEnvVarSummary {
  id: string;
  key: string;
  value?: string;
  type: string;
  target: string[];
  updatedAt?: number;
}
