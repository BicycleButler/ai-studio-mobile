import { describe, test, expect } from "vitest";
import { ProviderConnectionService } from "./providers";
import { DefaultStorageFactory } from "./StorageFactory";
import { STORAGE_KEYS } from "./constants";
import { isDeprecatedOrUnusableModel, sanitizeModelId } from "../modelCatalog";
import { GenerateRequestSchema, ProviderVerifyRequestSchema } from "../../schemas/validation";

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

function createTestProviderService() {
  const storage = createInMemoryStorage();
  const factory = new DefaultStorageFactory(storage);
  let seq = 1;
  const service = new ProviderConnectionService({
    storageFactory: factory,
    idGenerator: { generate: (prefix = "id") => `${prefix}_${seq++}` },
    timeProvider: {
      now: () => 1_700_000_000_000,
      date: (ms?: number) => new Date(ms ?? 1_700_000_000_000),
      formatRelative: () => "just now",
    },
  });
  return { service, storage };
}

describe("ProviderConnectionService", () => {
  test("encrypts API keys in storage and decrypts on load", () => {
    const { service, storage } = createTestProviderService();

    const saved = service.upsertConnection({
      providerId: "openai",
      name: "Work OpenAI",
      apiKey: "sk-proj-secret-test-key-1234",
      enabled: true,
    });

    expect(saved.id).toBe("prov_1");
    expect(saved.apiKey).toBe("sk-proj-secret-test-key-1234");

    const raw = storage.getItem(STORAGE_KEYS.PROVIDER_CONNECTIONS) || "";
    expect(raw).not.toContain("sk-proj-secret-test-key-1234");
    expect(raw).toContain("enc:");

    const loaded = service.loadConnections();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].apiKey).toBe("sk-proj-secret-test-key-1234");
  });

  test("exposes enabled provider models and hides disabled providers", () => {
    const { service } = createTestProviderService();

    const openaiConn = service.upsertConnection({
      providerId: "openai",
      name: "OpenAI",
      apiKey: "sk-test-openai-key-12345",
      customModels: ["gpt-4.1-mini"],
      enabled: true,
    });

    const ollamaConn = service.upsertConnection({
      providerId: "local-ollama",
      name: "Local Ollama",
      baseUrl: "http://localhost:11434",
      discoveredModels: [
        {
          id: "llama3.2:latest",
          name: "llama3.2:latest",
          category: "Local On-Device",
          description: "Local model",
          contextWindow: "Local",
          supportsVision: false,
          supportsAudio: false,
          supportsSystemInstruction: true,
          supportsJson: true,
          isLocal: true,
        },
      ],
      enabled: true,
    });

    const models = service.getEnabledProviderModels();
    expect(models.some((m) => m.id === "gpt-4.1-mini" && m.providerId === "openai")).toBe(true);
    expect(models.some((m) => m.id === "llama3.2:latest" && m.providerId === "local-ollama" && m.isLocal)).toBe(true);

    service.toggleConnectionEnabled(openaiConn.id, false);
    const afterToggle = service.getEnabledProviderModels();
    expect(afterToggle.some((m) => m.id === "gpt-4.1-mini")).toBe(false);
    expect(afterToggle.some((m) => m.id === "llama3.2:latest")).toBe(true);

    service.deleteConnection(ollamaConn.id);
    expect(service.getEnabledProviderModels()).toHaveLength(0);
  });

  test("resolves connections by connectionId, providerId, and modelId", () => {
    const { service } = createTestProviderService();

    const anthropicConn = service.upsertConnection({
      providerId: "anthropic",
      name: "Claude",
      apiKey: "sk-ant-test-key-123456",
      enabled: true,
    });

    expect(service.hasAnyEnabledConnection()).toBe(true);

    const resolvedByExactId = service.resolveConnectionForRequest(
      "claude-sonnet-4-20250514",
      "anthropic",
      anthropicConn.id
    );
    expect(resolvedByExactId?.id).toBe(anthropicConn.id);

    const resolvedByModelOnly = service.resolveConnectionForRequest("claude-sonnet-4-20250514");
    expect(resolvedByModelOnly?.providerId).toBe("anthropic");
  });

  test("requires API keys for cloud connections but not local connections in hasAnyEnabledConnection", () => {
    const { service } = createTestProviderService();

    service.upsertConnection({
      providerId: "openai",
      name: "Empty Key OpenAI",
      apiKey: "",
      enabled: true,
    });
    expect(service.hasAnyEnabledConnection()).toBe(false);

    service.upsertConnection({
      providerId: "local-webllm",
      name: "WebGPU",
      enabled: true,
    });
    expect(service.hasAnyEnabledConnection()).toBe(true);
  });
});

describe("Multi-provider model catalog & schemas", () => {
  test("preserves third-party and local models in isDeprecatedOrUnusableModel and sanitizeModelId", () => {
    expect(isDeprecatedOrUnusableModel("gpt-4o", "openai")).toBe(false);
    expect(isDeprecatedOrUnusableModel("claude-sonnet-4-5", "anthropic")).toBe(false);
    expect(isDeprecatedOrUnusableModel("Llama-3.2-1B-Instruct-q4f16_1-MLC", "local-webllm")).toBe(false);
    expect(isDeprecatedOrUnusableModel("qwen2.5:7b", "local-ollama")).toBe(false);
    expect(isDeprecatedOrUnusableModel("gpt-4.1")).toBe(false);
    expect(isDeprecatedOrUnusableModel("gemini-1.5-pro", "google")).toBe(true);

    expect(sanitizeModelId("claude-sonnet-4-5", "anthropic")).toBe("claude-sonnet-4-5");
    expect(sanitizeModelId("gemini-1.5-pro", "google")).toBe("gemini-2.5-flash");
  });

  test("validates multi-provider GenerateRequest and ProviderVerifyRequest payloads", () => {
    const genRes = GenerateRequestSchema.safeParse({
      model: "gpt-4o-mini",
      providerId: "openai",
      connectionId: "prov_1",
      messages: [{ role: "user", text: "Hello" }],
    });
    expect(genRes.success).toBe(true);

    const verifyRes = ProviderVerifyRequestSchema.safeParse({
      providerId: "openai-compatible",
      baseUrl: "https://api.together.xyz/v1",
    });
    expect(verifyRes.success).toBe(true);
  });
});
