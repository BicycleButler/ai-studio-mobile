import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, StatementSync } from "node:sqlite";

export interface GoogleSessionUser {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
  authSource: "google_oauth" | "google_identity" | "google_account";
  authenticatedAt: number;
  aiStudioSynced: boolean;
}

export interface SetItemsResult<T = Record<string, unknown>> {
  version: number;
  conflict: boolean;
  remoteItems?: T[];
}

export const DEFAULT_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SCOPED_ITEMS_JSON_BYTES = 5 * 1024 * 1024;
const SESSION_PRUNE_THROTTLE_MS = 5 * 60 * 1000;
const HEALTH_QUICK_CHECK_INTERVAL_MS = 60 * 1000;

export class ServerStateStore {
  private db: DatabaseSync;
  private lastPruneAt = 0;
  private lastQuickCheckAt = 0;

  private stmtGetSession: StatementSync;
  private stmtSetSession: StatementSync;
  private stmtDeleteSession: StatementSync;
  private stmtPruneSessions: StatementSync;
  private stmtGetScopedItems: StatementSync;
  private stmtSetScopedItems: StatementSync;
  private stmtGetScopedItemEntries: StatementSync;
  private stmtDeleteScopedItemEntries: StatementSync;
  private stmtInsertScopedItemEntry: StatementSync;
  private stmtDeleteSingleScopedItemEntry: StatementSync;
  private stmtPingOk: StatementSync;
  private stmtQuickCheck: StatementSync;

  constructor(dbPath: string = path.resolve(process.cwd(), ".stubs/app_state.sqlite")) {
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -16000;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scoped_items (
        scope_key TEXT NOT NULL,
        kind TEXT NOT NULL,
        data_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (scope_key, kind)
      );
      CREATE TABLE IF NOT EXISTS scoped_item_entries (
        scope_key TEXT NOT NULL,
        kind TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (scope_key, kind, item_id)
      );
    `);

    const cols = this.db.prepare("PRAGMA table_info(scoped_items)").all() as Array<{ name?: string }>;
    if (!cols.some((c) => c.name === "version")) {
      this.db.exec("ALTER TABLE scoped_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
    }

    this.stmtGetSession = this.db.prepare("SELECT user_json, updated_at FROM sessions WHERE session_id = ?");
    this.stmtSetSession = this.db.prepare(
      "INSERT OR REPLACE INTO sessions (session_id, user_json, updated_at) VALUES (?, ?, ?)"
    );
    this.stmtDeleteSession = this.db.prepare("DELETE FROM sessions WHERE session_id = ?");
    this.stmtPruneSessions = this.db.prepare("DELETE FROM sessions WHERE updated_at < ?");
    this.stmtGetScopedItems = this.db.prepare(
      "SELECT data_json, version FROM scoped_items WHERE scope_key = ? AND kind = ?"
    );
    this.stmtSetScopedItems = this.db.prepare(
      "INSERT OR REPLACE INTO scoped_items (scope_key, kind, data_json, version, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    this.stmtGetScopedItemEntries = this.db.prepare(
      "SELECT item_id, item_json, updated_at FROM scoped_item_entries WHERE scope_key = ? AND kind = ?"
    );
    this.stmtDeleteScopedItemEntries = this.db.prepare(
      "DELETE FROM scoped_item_entries WHERE scope_key = ? AND kind = ?"
    );
    this.stmtInsertScopedItemEntry = this.db.prepare(
      "INSERT OR REPLACE INTO scoped_item_entries (scope_key, kind, item_id, item_json, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    this.stmtDeleteSingleScopedItemEntry = this.db.prepare(
      "DELETE FROM scoped_item_entries WHERE scope_key = ? AND kind = ? AND item_id = ?"
    );
    this.stmtPingOk = this.db.prepare("SELECT 1 AS ok");
    this.stmtQuickCheck = this.db.prepare("PRAGMA quick_check(1)");
  }

  private maybePruneExpiredSessions(now: number, maxAgeMs: number): void {
    if (maxAgeMs <= 0) return;
    if (now - this.lastPruneAt < SESSION_PRUNE_THROTTLE_MS) return;
    this.lastPruneAt = now;
    this.pruneExpiredSessions(maxAgeMs, now);
  }

  private extractItemId(item: unknown, index: number): string {
    if (item && typeof item === "object" && "id" in item) {
      const raw = (item as { id?: unknown }).id;
      if (typeof raw === "string" || typeof raw === "number") {
        const str = String(raw).trim();
        if (str) return str;
      }
    }
    return `__idx_${index}`;
  }

  private syncScopedItemEntries(
    scopeKey: string,
    kind: "prompts" | "projects",
    items: unknown[],
    now: number
  ): void {
    this.stmtDeleteScopedItemEntries.run(scopeKey, kind);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = this.extractItemId(item, i);
      this.stmtInsertScopedItemEntry.run(scopeKey, kind, itemId, JSON.stringify(item), now);
    }
  }

  public getSessionUser(
    sessionId: string,
    now: number = Date.now(),
    maxAgeMs: number = DEFAULT_SESSION_MAX_AGE_MS
  ): GoogleSessionUser | null {
    if (!sessionId) return null;
    this.maybePruneExpiredSessions(now, maxAgeMs);
    const row = this.stmtGetSession.get(sessionId) as
      | { user_json?: string; updated_at?: number }
      | undefined;
    if (!row?.user_json) return null;
    if (typeof row.updated_at === "number" && maxAgeMs > 0 && now - row.updated_at > maxAgeMs) {
      this.clearSessionUser(sessionId);
      return null;
    }
    try {
      return JSON.parse(row.user_json) as GoogleSessionUser;
    } catch {
      return null;
    }
  }

  public setSessionUser(sessionId: string, user: GoogleSessionUser, now: number = Date.now()): void {
    this.maybePruneExpiredSessions(now, DEFAULT_SESSION_MAX_AGE_MS);
    this.stmtSetSession.run(sessionId, JSON.stringify(user), now);
  }

  public clearSessionUser(sessionId: string): void {
    if (!sessionId) return;
    this.stmtDeleteSession.run(sessionId);
  }

  public pruneExpiredSessions(
    maxAgeMs: number = DEFAULT_SESSION_MAX_AGE_MS,
    now: number = Date.now()
  ): number {
    const cutoff = now - maxAgeMs;
    const result = this.stmtPruneSessions.run(cutoff);
    return Number(result.changes || 0);
  }

  public getItemsWithVersion<T = Record<string, unknown>>(
    scopeKey: string,
    kind: "prompts" | "projects"
  ): { items: T[]; version: number } {
    const row = this.stmtGetScopedItems.get(scopeKey, kind) as
      | { data_json?: string; version?: number }
      | undefined;
    if (!row?.data_json) return { items: [], version: 0 };
    try {
      const parsed = JSON.parse(row.data_json);
      return {
        items: Array.isArray(parsed) ? (parsed as T[]) : [],
        version: typeof row.version === "number" ? row.version : 1,
      };
    } catch {
      return { items: [], version: typeof row.version === "number" ? row.version : 1 };
    }
  }

  public getItems<T = Record<string, unknown>>(scopeKey: string, kind: "prompts" | "projects"): T[] {
    return this.getItemsWithVersion<T>(scopeKey, kind).items;
  }

  public getItemEntries<T = Record<string, unknown>>(
    scopeKey: string,
    kind: "prompts" | "projects"
  ): Array<{ itemId: string; item: T; updatedAt: number }> {
    const rows = this.stmtGetScopedItemEntries.all(scopeKey, kind) as Array<{
      item_id: string;
      item_json: string;
      updated_at: number;
    }>;
    const results: Array<{ itemId: string; item: T; updatedAt: number }> = [];
    for (const r of rows) {
      try {
        results.push({
          itemId: r.item_id,
          item: JSON.parse(r.item_json) as T,
          updatedAt: r.updated_at,
        });
      } catch {
        // skip corrupted row
      }
    }
    return results;
  }

  public setItems<T = Record<string, unknown>>(
    scopeKey: string,
    kind: "prompts" | "projects",
    items: T[],
    now: number = Date.now(),
    options?: { expectedVersion?: number; force?: boolean }
  ): SetItemsResult<T> {
    const serialized = JSON.stringify(items);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SCOPED_ITEMS_JSON_BYTES) {
      throw new Error(`Sync payload exceeds maximum size (${MAX_SCOPED_ITEMS_JSON_BYTES} bytes).`);
    }

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.stmtGetScopedItems.get(scopeKey, kind) as
        | { data_json?: string; version?: number }
        | undefined;

      const currentVersion = typeof existing?.version === "number" ? existing.version : existing ? 1 : 0;

      if (
        !options?.force &&
        typeof options?.expectedVersion === "number" &&
        existing &&
        currentVersion !== options.expectedVersion
      ) {
        let remoteItems: T[] = [];
        if (existing.data_json) {
          try {
            const parsed = JSON.parse(existing.data_json);
            if (Array.isArray(parsed)) remoteItems = parsed as T[];
          } catch {
            // ignore corrupted remote JSON
          }
        }
        this.db.exec("ROLLBACK");
        return {
          version: currentVersion,
          conflict: true,
          remoteItems,
        };
      }

      const nextVersion = currentVersion + 1;
      this.stmtSetScopedItems.run(scopeKey, kind, serialized, nextVersion, now);
      this.syncScopedItemEntries(scopeKey, kind, items, now);
      this.db.exec("COMMIT");
      return {
        version: nextVersion,
        conflict: false,
      };
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  public upsertScopedItem<T extends Record<string, unknown>>(
    scopeKey: string,
    kind: "prompts" | "projects",
    item: T,
    now: number = Date.now()
  ): { version: number; itemId: string } {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.stmtGetScopedItems.get(scopeKey, kind) as
        | { data_json?: string; version?: number }
        | undefined;

      const currentVersion = typeof existing?.version === "number" ? existing.version : existing ? 1 : 0;
      let items: T[] = [];
      if (existing?.data_json) {
        try {
          const parsed = JSON.parse(existing.data_json);
          if (Array.isArray(parsed)) items = parsed as T[];
        } catch {
          items = [];
        }
      }

      const itemId = this.extractItemId(item, items.length);
      const idx = items.findIndex((entry, i) => this.extractItemId(entry, i) === itemId);
      if (idx >= 0) {
        items[idx] = item;
      } else {
        items.push(item);
      }

      const serialized = JSON.stringify(items);
      if (Buffer.byteLength(serialized, "utf8") > MAX_SCOPED_ITEMS_JSON_BYTES) {
        throw new Error(`Sync payload exceeds maximum size (${MAX_SCOPED_ITEMS_JSON_BYTES} bytes).`);
      }

      const nextVersion = currentVersion + 1;
      this.stmtSetScopedItems.run(scopeKey, kind, serialized, nextVersion, now);
      this.stmtInsertScopedItemEntry.run(scopeKey, kind, itemId, JSON.stringify(item), now);
      this.db.exec("COMMIT");
      return { version: nextVersion, itemId };
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  public deleteScopedItem(
    scopeKey: string,
    kind: "prompts" | "projects",
    itemId: string,
    now: number = Date.now()
  ): { version: number; deleted: boolean } {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.stmtGetScopedItems.get(scopeKey, kind) as
        | { data_json?: string; version?: number }
        | undefined;

      const currentVersion = typeof existing?.version === "number" ? existing.version : existing ? 1 : 0;
      let items: unknown[] = [];
      if (existing?.data_json) {
        try {
          const parsed = JSON.parse(existing.data_json);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items = [];
        }
      }

      const nextItems = items.filter((entry, i) => this.extractItemId(entry, i) !== itemId);
      const deleted = nextItems.length !== items.length;
      const nextVersion = deleted ? currentVersion + 1 : currentVersion;

      if (deleted) {
        this.stmtSetScopedItems.run(scopeKey, kind, JSON.stringify(nextItems), nextVersion, now);
        this.stmtDeleteSingleScopedItemEntry.run(scopeKey, kind, itemId);
      }

      this.db.exec("COMMIT");
      return { version: nextVersion, deleted };
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  public ping(now: number = Date.now()): boolean {
    const row = this.stmtPingOk.get() as { ok?: number } | undefined;
    if (row?.ok !== 1) return false;
    if (now - this.lastQuickCheckAt >= HEALTH_QUICK_CHECK_INTERVAL_MS) {
      this.lastQuickCheckAt = now;
      const integrity = this.stmtQuickCheck.get() as { quick_check?: string } | undefined;
      return !integrity || integrity.quick_check === "ok";
    }
    return true;
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // already closed
    }
  }
}
