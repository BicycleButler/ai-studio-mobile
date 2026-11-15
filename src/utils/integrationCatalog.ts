import { IntegrationAuthMethod, IntegrationProviderId } from "../types/integrations";

export interface IntegrationProviderDefinition {
  id: IntegrationProviderId;
  name: string;
  shortName: string;
  description: string;
  supportedAuthMethods: IntegrationAuthMethod[];
  defaultAuthMethod: IntegrationAuthMethod;
  oauthButtonLabel: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  docsUrl: string;
  quickTokenUrl?: string;
  readCapabilities: string[];
  writeCapabilities: string[];
}

export const INTEGRATION_PROVIDER_DEFINITIONS: IntegrationProviderDefinition[] = [
  {
    id: "firebase",
    name: "Firebase",
    shortName: "Firebase",
    description: "Sign in with Google to browse your Firebase projects, edit Firestore documents, and manage Realtime Database.",
    supportedAuthMethods: ["oauth", "token", "service_account"],
    defaultAuthMethod: "oauth",
    oauthButtonLabel: "Sign in with Google",
    tokenLabel: "Google OAuth Access Token",
    tokenPlaceholder: "ya29.a0...",
    docsUrl: "https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk",
    readCapabilities: ["Auto-discover Firebase projects", "List Firestore collections & docs", "Read Realtime Database paths", "Open JSON in Mobile IDE"],
    writeCapabilities: ["Create & merge documents", "Update fields & JSON", "Delete documents", "Write Realtime Database"],
  },
  {
    id: "gcp",
    name: "Google Cloud Project",
    shortName: "Google Cloud",
    description: "Sign in with Google to auto-discover GCP projects, Cloud Storage buckets, Secret Manager, and Cloud Run services.",
    supportedAuthMethods: ["oauth", "token", "service_account"],
    defaultAuthMethod: "oauth",
    oauthButtonLabel: "Sign in with Google",
    tokenLabel: "Google Cloud Access Token",
    tokenPlaceholder: "ya29.a0... (gcloud auth print-access-token)",
    docsUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
    readCapabilities: ["Auto-discover GCP projects", "Browse GCS buckets & objects", "Open GCS objects in Mobile IDE", "Read Secret Manager & Cloud Run"],
    writeCapabilities: ["Upload & update GCS objects", "Push IDE files to GCS", "Delete GCS objects", "Create secrets & add versions"],
  },
  {
    id: "github",
    name: "GitHub",
    shortName: "GitHub",
    description: "Connect your GitHub account to browse repositories and branches, edit in Mobile IDE, and commit changes back.",
    supportedAuthMethods: ["oauth", "token"],
    defaultAuthMethod: "oauth",
    oauthButtonLabel: "Sign in with GitHub",
    tokenLabel: "Personal Access Token (PAT)",
    tokenPlaceholder: "ghp_... or github_pat_...",
    docsUrl: "https://github.com/settings/tokens?type=beta",
    quickTokenUrl: "https://github.com/settings/tokens/new?scopes=repo,read:user,workflow&description=AI+Studio+Workspace",
    readCapabilities: ["List repos & branches", "Browse full file tree", "Inspect recent commits", "Open repo files in Mobile IDE"],
    writeCapabilities: ["Commit & push file edits", "Create new files & branches", "Batch push IDE workspace files", "Delete repository files"],
  },
  {
    id: "vercel",
    name: "Vercel",
    shortName: "Vercel",
    description: "Connect your Vercel account to inspect deployments, manage environment variables, and trigger live deployments.",
    supportedAuthMethods: ["oauth", "token"],
    defaultAuthMethod: "oauth",
    oauthButtonLabel: "Sign in with Vercel",
    tokenLabel: "Vercel Access Token",
    tokenPlaceholder: "Paste Vercel access token...",
    docsUrl: "https://vercel.com/account/tokens",
    quickTokenUrl: "https://vercel.com/account/tokens",
    readCapabilities: ["List Vercel teams & projects", "Inspect deployments & files", "Read project env variables", "Decrypt env var values"],
    writeCapabilities: ["Upsert environment variables", "Delete environment variables", "Deploy files from IDE or hub", "Trigger preview & prod builds"],
  },
];

export function getIntegrationDefinition(
  providerId: IntegrationProviderId
): IntegrationProviderDefinition | undefined {
  return INTEGRATION_PROVIDER_DEFINITIONS.find((p) => p.id === providerId);
}
