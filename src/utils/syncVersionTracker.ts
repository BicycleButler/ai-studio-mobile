export type SyncResourceKind = "prompts" | "projects";

const SYNC_VERSION_STORAGE_KEY = "ai_studio_sync_versions_v1";

class SyncVersionTracker {
  private versions = new Map<SyncResourceKind, number>();
  private hydrated = false;

  private hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(SYNC_VERSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        for (const kind of ["prompts", "projects"] as SyncResourceKind[]) {
          const val = parsed[kind];
          if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
            this.versions.set(kind, val);
          }
        }
      }
    } catch {
      // Ignore storage access or parse errors in restricted environments
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const obj: Record<string, number> = {};
      for (const [k, v] of this.versions.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(SYNC_VERSION_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage write errors
    }
  }

  public getVersion(kind: SyncResourceKind): number | undefined {
    this.hydrate();
    return this.versions.get(kind);
  }

  public setVersion(kind: SyncResourceKind, version: number | undefined): void {
    this.hydrate();
    if (typeof version === "number" && Number.isFinite(version) && version >= 0) {
      this.versions.set(kind, version);
      this.persist();
    }
  }

  public clear(kind?: SyncResourceKind): void {
    this.hydrate();
    if (kind) {
      this.versions.delete(kind);
    } else {
      this.versions.clear();
    }
    this.persist();
  }
}

export const syncVersionTracker = new SyncVersionTracker();

