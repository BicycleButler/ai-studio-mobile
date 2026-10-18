import { isMockSession } from "../mockDefinitions";

export interface EntityMapper {
  id?: string;
  title?: string;
  repository?: string;
  messages?: unknown[];
}

export function cleanMockData<T>(
  items: T[],
  type: "chat" | "jules" = "chat",
  mapFn?: (item: T) => EntityMapper
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;

    // Default mapping logic tries to pluck common fields
    const rec = item as Record<string, unknown>;
    const defaultMapped: EntityMapper = mapFn ? mapFn(item) : {
      id: String(rec.id || ""),
      title: String(rec.title || rec.text || ""),
      repository: typeof rec.repository === "string" ? rec.repository : undefined,
      messages: Array.isArray(rec.messages) ? rec.messages : undefined,
    };

    return !isMockSession(defaultMapped, type);
  });
}

/**
 * Extracts a deeply nested value safely without throwing, returning a fallback if missing or type mismatches.
 */
export function getNestedValue<T>(obj: unknown, path: string[], fallback: T): T {
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return fallback;
    }
    if (!(key in current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current !== undefined ? (current as T) : fallback;
}

/**
 * Deep freezes an object to make it immutable.
 * Used to ensure cached storage snapshots cannot be mutated by consumers.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Object.isFrozen(obj)) {
    return obj;
  }

  // We should clone the object deeply first to avoid freezing the original reference
  // if it's reused by the caller.
  let clone: any;
  if (Array.isArray(obj)) {
    clone = [];
    for (let i = 0; i < obj.length; i++) {
      clone[i] = deepFreeze(obj[i]);
    }
  } else {
    clone = { ...obj };
    for (const key of Object.getOwnPropertyNames(clone)) {
      const prop = clone[key];
      if (
        prop !== null &&
        (typeof prop === 'object' || typeof prop === 'function')
      ) {
        clone[key] = deepFreeze(prop);
      }
    }
  }

  return Object.freeze(clone) as T;
}
