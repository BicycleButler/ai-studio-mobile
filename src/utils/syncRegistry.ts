import { registerSyncHandler, OfflineMutation } from "./offlineService";

export function initializeSyncHandlers() {
  registerSyncHandler("jules_sessions", async (mutation: OfflineMutation) => {
    const res = await fetch("/api/jules/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutation.payload),
    });
    if (res.ok) return { success: true };
    if (res.status === 409) {
      const data = await res.json();
      return { success: false, conflict: { type: mutation.type, localData: mutation.payload, remoteData: data.remote, id: mutation.id } };
    }
    return { success: false };
  });

  registerSyncHandler("saved_prompts", async (mutation: OfflineMutation) => {
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompts: mutation.payload }),
    });
    if (res.ok) return { success: true };
    if (res.status === 409) {
      const data = await res.json();
      return { success: false, conflict: { type: mutation.type, localData: mutation.payload, remoteData: data.remote, id: mutation.id } };
    }
    return { success: false };
  });

  registerSyncHandler("projects", async (mutation: OfflineMutation) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projects: mutation.payload }),
    });
    if (res.ok) return { success: true };
    if (res.status === 409) {
      const data = await res.json();
      return { success: false, conflict: { type: mutation.type, localData: mutation.payload, remoteData: data.remote, id: mutation.id } };
    }
    return { success: false };
  });
}
