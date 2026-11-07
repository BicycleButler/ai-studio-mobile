export interface IObjectUtils {
  fastDeepEqual(a: unknown, b: unknown): boolean;
  deepFreeze<T>(obj: T): T;
}

export class DefaultObjectUtils implements IObjectUtils {
  public fastDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.fastDeepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (Array.isArray(b)) return false;

    if (a instanceof Date) {
      return b instanceof Date && a.getTime() === b.getTime();
    }
    if (b instanceof Date) return false;

    if (a instanceof RegExp) {
      return b instanceof RegExp && a.source === b.source && a.flags === b.flags;
    }
    if (b instanceof RegExp) return false;

    if (a instanceof Map) {
      if (!(b instanceof Map) || a.size !== b.size) return false;
      for (const [key, val] of a) {
        if (!b.has(key) || !this.fastDeepEqual(val, b.get(key))) return false;
      }
      return true;
    }
    if (b instanceof Map) return false;

    if (a instanceof Set) {
      if (!(b instanceof Set) || a.size !== b.size) return false;
      for (const val of a) {
        if (!b.has(val)) return false;
      }
      return true;
    }
    if (b instanceof Set) return false;

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      if (!this.fastDeepEqual(objA[key], objB[key])) return false;
    }
    return true;
  }

  public deepFreeze<T>(obj: T): T {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return obj;
    }

    if (Object.isFrozen(obj)) {
      return obj;
    }

    if (obj instanceof Date) {
      const frozen = new Date(obj.getTime());
      const throwError = () => { throw new Error('Cannot mutate frozen Date'); };
      const methods = ['setTime', 'setMilliseconds', 'setUTCMilliseconds', 'setSeconds', 'setUTCSeconds', 'setMinutes', 'setUTCMinutes', 'setHours', 'setUTCHours', 'setDate', 'setUTCDate', 'setMonth', 'setUTCMonth', 'setFullYear', 'setUTCFullYear', 'setYear'] as const;
      for (const method of methods) {
        if (typeof ((frozen as unknown) as Record<string, unknown>)[method] === 'function') {
          ((frozen as unknown) as Record<string, unknown>)[method] = throwError;
        }
      }
      return (Object.freeze(frozen) as unknown) as T;
    }
    if (obj instanceof RegExp) {
      return (Object.freeze(new RegExp(obj.source, obj.flags)) as unknown) as T;
    }

    // We should clone the object deeply first to avoid freezing the original reference
    // if it's reused by the caller.
    let clone: unknown;
    if (Array.isArray(obj)) {
      clone = [] as unknown[];
      for (let i = 0; i < obj.length; i++) {
        (clone as unknown[])[i] = this.deepFreeze((obj as unknown[])[i]);
      }
    } else if (obj instanceof Map) {
      clone = new Map<unknown, unknown>();
      for (const [k, v] of obj.entries()) {
        (clone as Map<unknown, unknown>).set(this.deepFreeze(k), this.deepFreeze(v));
      }
      const throwError = () => { throw new Error('Cannot mutate frozen Map'); };
      (clone as Map<unknown, unknown>).set = throwError as never;
      (clone as Map<unknown, unknown>).delete = throwError as never;
      (clone as Map<unknown, unknown>).clear = throwError as never;
    } else if (obj instanceof Set) {
      clone = new Set<unknown>();
      for (const v of obj.values()) {
        (clone as Set<unknown>).add(this.deepFreeze(v));
      }
      const throwError = () => { throw new Error('Cannot mutate frozen Set'); };
      (clone as Set<unknown>).add = throwError as never;
      (clone as Map<unknown, unknown>).delete = throwError as never;
      (clone as Map<unknown, unknown>).clear = throwError as never;
    } else {
      clone = Object.create(Object.getPrototypeOf(obj));
      for (const key of Object.getOwnPropertyNames(obj)) {
        const prop = (obj as Record<string, unknown>)[key];
        if (
          prop !== null &&
          (typeof prop === 'object' || typeof prop === 'function')
        ) {
          (clone as Record<string, unknown>)[key] = this.deepFreeze(prop);
        } else {
          (clone as Record<string, unknown>)[key] = prop;
        }
      }
    }

    return Object.freeze(clone) as T;
  }
}
