import { describe, expect, vi, beforeEach, it } from 'vitest';
import { ApiClient } from "../utils/apiClient";
import { JulesClient } from "./julesService";

describe("julesService", () => {
  let testClient: { fetch: import("vitest").Mock } & ApiClient;
  let testJulesClient: JulesClient;
  beforeEach(() => {
    vi.resetAllMocks();
    testClient = { fetch: vi.fn() } as unknown as { fetch: import("vitest").Mock } & ApiClient;
    testJulesClient = new JulesClient({ getApiKey: () => "test-key", getSettings: () => ({ autoApprovePlans: false, defaultBranch: "main" }), apiClient: testClient });
    testJulesClient.setConfig({
      getApiKey: () => "test-jules-key",
      getSettings: () => ({ autoApprovePlans: false, defaultBranch: "main" }),
      apiClient: testClient
    });
  });

  describe("verifyJulesApiKey", () => {
    it("should return false if key is blank", async () => {
      const result = await testJulesClient.verifyApiKey("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("blank");
    });

    it("should call apiClient.fetch and return true on success", async () => {
      (testClient.fetch as import("vitest").Mock).mockResolvedValueOnce({ valid: true });
      const result = await testJulesClient.verifyApiKey("valid-key");
      expect(result.valid).toBe(true);
      expect(testClient.fetch).toHaveBeenCalledWith(
        "/api/jules/auth/verify",
        expect.objectContaining({ body: JSON.stringify({ apiKey: "valid-key" }) }),
        expect.any(String)
      );
    });

    it("should handle apiClient.fetch failure gracefully", async () => {
      (testClient.fetch as import("vitest").Mock).mockRejectedValueOnce(new Error("Network Error"));
      const result = await testJulesClient.verifyApiKey("invalid-key");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network Error");
    });
  });

  describe("fetchJulesRepositories", () => {
    it("should return mapped repositories on success", async () => {
      (testClient.fetch as import("vitest").Mock).mockResolvedValueOnce({
        repositories: [{ fullName: "owner/repo", defaultBranch: "dev" }]
      });
      const repos = await testJulesClient.fetchRepositories();
      expect(repos.length).toBe(1);
      expect(repos[0].fullName).toBe("owner/repo");
      expect(repos[0].defaultBranch).toBe("dev");
      expect(testClient.fetch).toHaveBeenCalledWith(
        "/api/jules/repos",
        expect.objectContaining({ headers: { "x-jules-api-key": "test-jules-key" } })
      );
    });

    it("should return empty array on failure", async () => {
      (testClient.fetch as import("vitest").Mock).mockRejectedValueOnce(new Error("Network Error"));
      const repos = await testJulesClient.fetchRepositories();
      expect(repos.length).toBe(0);
    });
  });

  describe("createJulesTask", () => {
    it("should call apiClient.fetch with correct params", async () => {
      (testClient.fetch as import("vitest").Mock).mockResolvedValueOnce({
        task: { id: "task-123", status: "queued" }
      });
      const result = await testJulesClient.createTask({ repository: "owner/repo", branch: "main", prompt: "Fix bug" });
      expect(result.task?.id).toBe("task-123");
      expect(testClient.fetch).toHaveBeenCalledWith(
        "/api/jules/tasks",
        expect.objectContaining({
          body: JSON.stringify({
            repository: "owner/repo",
            branch: "main",
            prompt: "Fix bug",
            autoApprove: false,
          })
        }),
        expect.any(String)
      );
    });
  });
});
