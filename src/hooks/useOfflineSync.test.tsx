import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useOfflineSync } from "./useOfflineSync";
import { ServiceProvider } from "../services/ServiceContext";
import { IOfflineService, OfflineMutation } from "../utils/offlineService";
import { Observable } from "../utils/observable";
import { INetworkStatusProvider, NetworkStatus } from "../utils/networkStatus";
import { syncConflictBus } from "../utils/syncConflictBus";
import { errorReporter } from "../utils/errorReporter";

describe("useOfflineSync resilience", () => {
  beforeEach(() => {
    errorReporter.clear();
  });

  function createHarness(initialQueue: OfflineMutation[]) {
    let queue = [...initialQueue];
    const observable = new Observable<OfflineMutation[]>(queue);
    const networkObs = new Observable<NetworkStatus>({ isOnline: true, wasOffline: false });

    const offlineService: IOfflineService = {
      getObservable: () => observable,
      registerSyncHandler: vi.fn(),
      enqueueOfflineMutation: vi.fn(async (type, payload, version) => {
        queue = [...queue, { id: `m_${Date.now()}`, type, payload, timestamp: Date.now(), version }];
        observable.notify(queue);
      }),
      removeOfflineMutation: vi.fn(async (id) => {
        queue = queue.filter((m) => m.id !== id);
        observable.notify(queue);
      }),
      getOfflineQueueLength: vi.fn(async () => queue.length),
      clearOfflineMutations: vi.fn(async () => {
        queue = [];
        observable.notify(queue);
      }),
      processOfflineMutations: vi.fn(async () => ({
        success: true,
        conflicts: [],
        droppedIds: [],
      })),
      getOfflineQueue: vi.fn(async () => queue),
      subscribe: (listener) => observable.subscribe(listener),
      getSnapshot: () => queue,
    };

    const networkStatusProvider: INetworkStatusProvider = {
      isOnline: () => true,
      getObservable: () => networkObs,
    };

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ServiceProvider services={{ offlineService, networkStatusProvider }}>
        {children}
      </ServiceProvider>
    );

    return { offlineService, wrapper };
  }

  it("drains persisted offline queue on startup when already online", async () => {
    const { offlineService, wrapper } = createHarness([
      { id: "m1", type: "saved_prompts", payload: [], timestamp: 1 },
    ]);

    renderHook(() => useOfflineSync(offlineService), { wrapper });

    await waitFor(() => {
      expect(offlineService.processOfflineMutations).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces syncWarning and reports sync_dropped when poison-pill mutations are dropped", async () => {
    const { offlineService, wrapper } = createHarness([
      { id: "m1", type: "saved_prompts", payload: [], timestamp: 1 },
    ]);
    (offlineService.processOfflineMutations as import("vitest").Mock).mockResolvedValueOnce({
      success: true,
      conflicts: [],
      droppedIds: ["m1"],
    });

    const { result } = renderHook(() => useOfflineSync(offlineService), { wrapper });

    await waitFor(() => {
      expect(result.current.syncWarning).toContain("1 queued change");
    });

    expect(errorReporter.getEvents().some((e) => e.category === "sync_dropped")).toBe(true);

    act(() => {
      result.current.dismissSyncWarning();
    });
    expect(result.current.syncWarning).toBeNull();
  });

  it("captures direct online 409 conflicts from syncConflictBus and force-overwrites with version -1", async () => {
    const { offlineService, wrapper } = createHarness([]);
    const { result } = renderHook(() => useOfflineSync(offlineService), { wrapper });

    act(() => {
      syncConflictBus.emit({
        id: "c1",
        type: "projects",
        localData: [{ id: "p1" }],
        remoteData: [{ id: "p2" }],
      });
    });

    expect(result.current.reconnectState).toBe("conflict");
    expect(result.current.conflictData?.id).toBe("c1");

    await act(async () => {
      await result.current.handleResolveConflict("overwrite");
    });

    expect(offlineService.enqueueOfflineMutation).toHaveBeenCalledWith("projects", [{ id: "p1" }], -1);
  });

  it("hydrates remote projects while preserving local apiKey and updates sync version on 'keep' conflict resolution", async () => {
    const { offlineService } = createHarness([]);
    const saveProjectsMock = vi.fn();
    const mockProjectService = {
      loadStoredProjects: () => [{ id: "p1", name: "Old", apiKey: "secret-local-key" }],
      projectsManager: {
        collection: {
          save: saveProjectsMock,
        },
      },
    } as unknown as import("../services/ServiceContext").IServices["projectService"];

    const customWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ServiceProvider
        services={{
          offlineService,
          networkStatusProvider: {
            isOnline: () => true,
            getObservable: () => new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }),
          },
          projectService: mockProjectService,
        }}
      >
        {children}
      </ServiceProvider>
    );

    const { result } = renderHook(() => useOfflineSync(offlineService), { wrapper: customWrapper });

    act(() => {
      syncConflictBus.emit({
        id: "c_keep",
        type: "projects",
        localData: [{ id: "p1", name: "Local" }],
        remoteData: [{ id: "p1", name: "Remote Name", apiKey: "" }],
        remoteVersion: 7,
      });
    });

    await act(async () => {
      await result.current.handleResolveConflict("keep");
    });

    expect(saveProjectsMock).toHaveBeenCalledWith(
      [{ id: "p1", name: "Remote Name", apiKey: "secret-local-key" }],
      { skipSync: true }
    );
  });

  it("requeues dead-letter items via retryDeadLetters and resets count", async () => {
    const { offlineService, wrapper } = createHarness([]);
    offlineService.getDeadLetterQueue = vi.fn(async () => [
      { id: "dl1", type: "saved_prompts", payload: [], timestamp: 1, retryCount: 5 },
    ]);
    offlineService.retryDeadLetterQueue = vi.fn(async () => 1);

    const { result } = renderHook(() => useOfflineSync(offlineService), { wrapper });

    await waitFor(() => {
      expect(result.current.deadLetterCount).toBe(1);
    });

    await act(async () => {
      await result.current.retryDeadLetters();
    });

    expect(offlineService.retryDeadLetterQueue).toHaveBeenCalledTimes(1);
    expect(result.current.deadLetterCount).toBe(0);
    expect(offlineService.processOfflineMutations).toHaveBeenCalled();
  });

  it("resets reconnectState to idle and sets syncWarning if processOfflineMutations throws", async () => {
    const { offlineService, wrapper } = createHarness([
      { id: "m_err", type: "saved_prompts", payload: [], timestamp: 1 },
    ]);
    (offlineService.processOfflineMutations as import("vitest").Mock).mockRejectedValueOnce(
      new Error("IndexedDB transaction failed")
    );

    const { result } = renderHook(() => useOfflineSync(offlineService), { wrapper });

    await waitFor(() => {
      expect(result.current.syncWarning).toBe("IndexedDB transaction failed");
    });

    expect(result.current.reconnectState).toBe("idle");
    expect(errorReporter.getEvents().some((e) => e.category === "unhandled_error")).toBe(true);
  });

  it("handles queue conflicts without spurious syncWarning and does not double-drain after overwrite", async () => {
    const { offlineService, wrapper } = createHarness([
      { id: "m_conf", type: "projects", payload: [{ id: "p1" }], timestamp: 1 },
    ]);
    (offlineService.processOfflineMutations as import("vitest").Mock)
      .mockResolvedValueOnce({
        success: false,
        conflicts: [
          {
            id: "m_conf",
            type: "projects",
            localData: [{ id: "p1" }],
            remoteData: [{ id: "p2" }],
            remoteVersion: 4,
          },
        ],
        droppedIds: [],
      })
      .mockResolvedValueOnce({
        success: false,
        conflicts: [],
        droppedIds: [],
      });

    const { result } = renderHook(() => useOfflineSync(offlineService), { wrapper });

    await waitFor(() => {
      expect(result.current.reconnectState).toBe("conflict");
    });
    expect(result.current.syncWarning).toBeNull();
    expect(errorReporter.getEvents().some((e) => e.category === "sync_dropped")).toBe(false);

    await act(async () => {
      await result.current.handleResolveConflict("overwrite");
    });

    // 1 startup drain + 1 drain from overwrite = 2 total (not 3 from duplicate drain)
    expect(offlineService.processOfflineMutations).toHaveBeenCalledTimes(2);
  });
});
