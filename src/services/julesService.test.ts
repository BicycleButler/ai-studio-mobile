import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyJulesApiKey, fetchJulesRepositories, createJulesTask, setJulesServiceConfig } from "./julesService";
import { apiFetch } from "../utils/apiClient";

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe("julesService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setJulesServiceConfig({
      getApiKey: () => "test-jules-key",
      getSettings: () => ({ autoApprovePlans: false, defaultBranch: "main" }),
    });
  });

  describe("verifyJulesApiKey", () => {
    it("should return false if key is blank", async () => {
      const result = await verifyJulesApiKey("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("blank");
    });

    it("should call apiFetch and return true on success", async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ valid: true });
      const result = await verifyJulesApiKey("valid-key");
      expect(result.valid).toBe(true);
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/jules/auth/verify",
        expect.objectContaining({ body: JSON.stringify({ apiKey: "valid-key" }) }),
        expect.any(String)
      );
    });

    it("should handle apiFetch failure gracefully", async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Network Error"));
      const result = await verifyJulesApiKey("invalid-key");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network Error");
    });
  });

  describe("fetchJulesRepositories", () => {
    it("should return mapped repositories on success", async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        repositories: [{ fullName: "owner/repo", defaultBranch: "dev" }]
      });
      const repos = await fetchJulesRepositories();
      expect(repos.length).toBe(1);
      expect(repos[0].fullName).toBe("owner/repo");
      expect(repos[0].defaultBranch).toBe("dev");
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/jules/repos",
        expect.objectContaining({ headers: { "x-jules-api-key": "test-jules-key" } })
      );
    });

    it("should return empty array on failure", async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Network Error"));
      const repos = await fetchJulesRepositories();
      expect(repos.length).toBe(0);
    });
  });

  describe("createJulesTask", () => {
    it("should call apiFetch with correct params", async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        task: { id: "task-123", status: "queued" }
      });
      const result = await createJulesTask({ repository: "owner/repo", branch: "main", prompt: "Fix bug" });
      expect(result.task?.id).toBe("task-123");
      expect(apiFetch).toHaveBeenCalledWith(
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
