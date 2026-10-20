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
export function fastShallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (objA[key] !== objB[key]) return false;
  }
  return true;
}

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

  if (obj instanceof Date) {
    const frozen = new Date(obj.getTime());
    const throwError = () => { throw new Error('Cannot mutate frozen Date'); };
    const methods = ['setTime', 'setMilliseconds', 'setUTCMilliseconds', 'setSeconds', 'setUTCSeconds', 'setMinutes', 'setUTCMinutes', 'setHours', 'setUTCHours', 'setDate', 'setUTCDate', 'setMonth', 'setUTCMonth', 'setFullYear', 'setUTCFullYear', 'setYear'];
    for (const method of methods) {
      if (typeof (frozen as unknown as Record<string, unknown>)[method] === 'function') {
        (frozen as unknown as Record<string, unknown>)[method] = throwError;
      }
    }
    return Object.freeze(frozen) as unknown as T;
  }
  if (obj instanceof RegExp) {
    return Object.freeze(new RegExp(obj.source, obj.flags)) as unknown as T;
  }

  // We should clone the object deeply first to avoid freezing the original reference
  // if it's reused by the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clone: any;
  if (Array.isArray(obj)) {
    clone = [];
    for (let i = 0; i < obj.length; i++) {
      clone[i] = deepFreeze(obj[i]);
    }
  } else if (obj instanceof Map) {
    clone = new Map();
    for (const [k, v] of obj.entries()) {
      clone.set(deepFreeze(k), deepFreeze(v));
    }
    const throwError = () => { throw new Error('Cannot mutate frozen Map'); };
    clone.set = throwError;
    clone.delete = throwError;
    clone.clear = throwError;
  } else if (obj instanceof Set) {
    clone = new Set();
    for (const v of obj.values()) {
      clone.add(deepFreeze(v));
    }
    const throwError = () => { throw new Error('Cannot mutate frozen Set'); };
    clone.add = throwError;
    clone.delete = throwError;
    clone.clear = throwError;
  } else {
    clone = Object.create(Object.getPrototypeOf(obj));
    for (const key of Object.getOwnPropertyNames(obj)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop = (obj as any)[key];
      if (
        prop !== null &&
        (typeof prop === 'object' || typeof prop === 'function')
      ) {
        clone[key] = deepFreeze(prop);
      } else {
        clone[key] = prop;
      }
    }
  }

  return Object.freeze(clone) as T;
}
