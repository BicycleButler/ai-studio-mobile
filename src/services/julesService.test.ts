import { describe, expect, vi, beforeEach, it } from 'vitest';
import { defaultClient } from "../utils/apiClient";
import { JulesClient } from "./julesService";

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    defaultClient: {
       fetch: vi.fn(),
    }
  };
});

describe("julesService", () => {
  const defaultJulesClient = new JulesClient({ getApiKey: () => "test-key", getSettings: () => ({ autoApprovePlans: false, defaultBranch: "main" }), apiClient: defaultClient });
  beforeEach(() => {
    vi.resetAllMocks();
    defaultJulesClient.setConfig({
      getApiKey: () => "test-jules-key",
      getSettings: () => ({ autoApprovePlans: false, defaultBranch: "main" }),
      apiClient: defaultClient
    });
  });

  describe("verifyJulesApiKey", () => {
    it("should return false if key is blank", async () => {
      const result = await defaultJulesClient.verifyApiKey("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("blank");
    });

    it("should call apiClient.fetch and return true on success", async () => {
      vi.mocked(defaultClient.fetch).mockResolvedValueOnce({ valid: true });
      const result = await defaultJulesClient.verifyApiKey("valid-key");
      expect(result.valid).toBe(true);
      expect(defaultClient.fetch).toHaveBeenCalledWith(
        "/api/jules/auth/verify",
        expect.objectContaining({ body: JSON.stringify({ apiKey: "valid-key" }) }),
        expect.any(String)
      );
    });

    it("should handle apiClient.fetch failure gracefully", async () => {
      vi.mocked(defaultClient.fetch).mockRejectedValueOnce(new Error("Network Error"));
      const result = await defaultJulesClient.verifyApiKey("invalid-key");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network Error");
    });
  });

  describe("fetchJulesRepositories", () => {
    it("should return mapped repositories on success", async () => {
      vi.mocked(defaultClient.fetch).mockResolvedValueOnce({
        repositories: [{ fullName: "owner/repo", defaultBranch: "dev" }]
      });
      const repos = await defaultJulesClient.fetchRepositories();
      expect(repos.length).toBe(1);
      expect(repos[0].fullName).toBe("owner/repo");
      expect(repos[0].defaultBranch).toBe("dev");
      expect(defaultClient.fetch).toHaveBeenCalledWith(
        "/api/jules/repos",
        expect.objectContaining({ headers: { "x-jules-api-key": "test-jules-key" } })
      );
    });

    it("should return empty array on failure", async () => {
      vi.mocked(defaultClient.fetch).mockRejectedValueOnce(new Error("Network Error"));
      const repos = await defaultJulesClient.fetchRepositories();
      expect(repos.length).toBe(0);
    });
  });

  describe("createJulesTask", () => {
    it("should call apiClient.fetch with correct params", async () => {
      vi.mocked(defaultClient.fetch).mockResolvedValueOnce({
        task: { id: "task-123", status: "queued" }
      });
      const result = await defaultJulesClient.createTask({ repository: "owner/repo", branch: "main", prompt: "Fix bug" });
      expect(result.task?.id).toBe("task-123");
      expect(defaultClient.fetch).toHaveBeenCalledWith(
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
