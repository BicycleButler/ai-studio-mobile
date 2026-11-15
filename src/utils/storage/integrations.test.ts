import { describe, test, expect } from "vitest";
import { IntegrationConnectionService } from "./integrations";
import { DefaultStorageFactory } from "./StorageFactory";
import { STORAGE_KEYS } from "./constants";
import { INTEGRATION_PROVIDER_DEFINITIONS, getIntegrationDefinition } from "../integrationCatalog";
import {
  IntegrationCredentialsSchema,
  FirebaseWriteDocSchema,
  GitHubBatchPushSchema,
  VercelUpsertEnvSchema,
} from "../../schemas/validation";

function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function createTestIntegrationService() {
  const storage = createInMemoryStorage();
  const factory = new DefaultStorageFactory(storage);
  let seq = 1;
  const service = new IntegrationConnectionService({
    storageFactory: factory,
    idGenerator: { generate: (prefix = "intg") => `${prefix}_${seq++}` },
    timeProvider: {
      now: () => 1_700_000_000_000,
      date: (ms?: number) => new Date(ms ?? 1_700_000_000_000),
      formatRelative: () => "just now",
    },
  });
  return { service, storage };
}

describe("IntegrationConnectionService", () => {
  test("encrypts tokens and service account JSON keys at rest and decrypts on load", () => {
    const { service, storage } = createTestIntegrationService();

    const saJson = JSON.stringify({
      type: "service_account",
      project_id: "demo-firebase-proj",
      client_email: "firebase-admin@demo-firebase-proj.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nSECRET_KEY_MATERIAL\n-----END PRIVATE KEY-----",
    });

    const fbConn = service.upsertConnection({
      providerId: "firebase",
      name: "Demo Firebase",
      authMethod: "service_account",
      serviceAccountJson: saJson,
      projectId: "demo-firebase-proj",
      enabled: true,
    });

    const ghConn = service.upsertConnection({
      providerId: "github",
      name: "Work GitHub",
      authMethod: "token",
      token: "ghp_superSecretGitHubToken123456",
      enabled: true,
    });

    expect(fbConn.id).toBe("intg_1");
    expect(fbConn.databaseId).toBe("(default)");
    expect(ghConn.id).toBe("intg_2");

    const raw = storage.getItem(STORAGE_KEYS.INTEGRATION_CONNECTIONS) || "";
    expect(raw).not.toContain("SECRET_KEY_MATERIAL");
    expect(raw).not.toContain("ghp_superSecretGitHubToken123456");
    expect(raw).toContain("enc:");

    const loaded = service.loadConnections();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].serviceAccountJson).toBe(saJson);
    expect(loaded[1].token).toBe("ghp_superSecretGitHubToken123456");

    const payload = service.toCredentialsPayload(loaded[1]);
    expect(payload).toEqual({
      providerId: "github",
      authMethod: "token",
      token: "ghp_superSecretGitHubToken123456",
      serviceAccountJson: undefined,
      projectId: undefined,
      databaseId: undefined,
      teamId: undefined,
    });
  });

  test("toggles, filters, and deletes connections cleanly", () => {
    const { service } = createTestIntegrationService();
    const vercelConn = service.upsertConnection({
      providerId: "vercel",
      name: "Vercel Prod",
      authMethod: "token",
      token: "vcel_tok_987",
      teamId: "team_abc",
      enabled: true,
    });

    expect(service.getConnectionsByProvider("vercel")).toHaveLength(1);
    service.toggleConnectionEnabled(vercelConn.id, false);
    expect(service.getConnectionsByProvider("vercel")).toHaveLength(0);

    service.toggleConnectionEnabled(vercelConn.id, true);
    expect(service.getConnectionsByProvider("vercel")).toHaveLength(1);

    service.deleteConnection(vercelConn.id);
    expect(service.loadConnections()).toHaveLength(0);
  });
});

describe("Integration catalog and validation schemas", () => {
  test("defines OAuth-first metadata for firebase, gcp, github, and vercel", () => {
    expect(INTEGRATION_PROVIDER_DEFINITIONS).toHaveLength(4);
    expect(getIntegrationDefinition("firebase")?.defaultAuthMethod).toBe("oauth");
    expect(getIntegrationDefinition("gcp")?.defaultAuthMethod).toBe("oauth");
    expect(getIntegrationDefinition("github")?.defaultAuthMethod).toBe("oauth");
    expect(getIntegrationDefinition("vercel")?.defaultAuthMethod).toBe("oauth");
    expect(getIntegrationDefinition("github")?.quickTokenUrl).toContain("github.com/settings/tokens/new");
    expect(getIntegrationDefinition("vercel")?.quickTokenUrl).toContain("vercel.com/account/tokens");
  });

  test("validates integration credentials and bi-directional write schemas", () => {
    expect(
      IntegrationCredentialsSchema.safeParse({
        providerId: "gcp",
        authMethod: "token",
        token: "ya29.abc",
        projectId: "my-proj",
      }).success
    ).toBe(true);

    expect(
      FirebaseWriteDocSchema.safeParse({
        credentials: { providerId: "firebase", token: "ya29.abc", projectId: "fb-proj" },
        collectionPath: "posts",
        docId: "post-1",
        data: { title: "Hello", likes: 42 },
        merge: true,
      }).success
    ).toBe(true);

    expect(
      GitHubBatchPushSchema.safeParse({
        credentials: { providerId: "github", token: "ghp_123" },
        owner: "octocat",
        repo: "hello-world",
        branch: "main",
        message: "sync files",
        files: [{ path: "src/index.ts", content: "export const x = 1;" }],
      }).success
    ).toBe(true);

    expect(
      VercelUpsertEnvSchema.safeParse({
        credentials: { providerId: "vercel", token: "vcel_123" },
        projectId: "prj_123",
        key: "API_URL",
        value: "https://example.com",
        target: ["production", "preview"],
        type: "encrypted",
      }).success
    ).toBe(true);
  });
});
