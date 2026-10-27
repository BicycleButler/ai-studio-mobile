import { describe, test, expect } from 'vitest';
import { getNestedValue, deepFreeze, fastDeepEqual } from './helpers';

describe('helpers', () => {
  test('fastDeepEqual correctly checks equality for Dates, RegExp, Maps, and Sets', () => {
    // Dates
    expect(fastDeepEqual(new Date(100), new Date(100))).toBe(true);
    expect(fastDeepEqual(new Date(100), new Date(200))).toBe(false);

    // RegExp
    expect(fastDeepEqual(/abc/g, /abc/g)).toBe(true);
    expect(fastDeepEqual(/abc/g, /abc/i)).toBe(false);

    // Maps
    expect(fastDeepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(fastDeepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
    expect(fastDeepEqual(new Map([['a', { nested: true }]]), new Map([['a', { nested: true }]]))).toBe(true);

    // Sets
    expect(fastDeepEqual(new Set([1, 2]), new Set([1, 2]))).toBe(true);
    expect(fastDeepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);

    // Edge cases against objects
    expect(fastDeepEqual(new Date(100), {})).toBe(false);
    expect(fastDeepEqual(/abc/g, {})).toBe(false);
    expect(fastDeepEqual(new Map(), {})).toBe(false);
    expect(fastDeepEqual(new Set(), {})).toBe(false);
  });

  test('getNestedValue', () => {
    const obj = { a: { b: { c: 1 } } };
    expect(getNestedValue(obj, ['a', 'b', 'c'], 0)).toBe(1);
    expect(getNestedValue(obj, ['a', 'b', 'd'], 0)).toBe(0);
    expect(getNestedValue(null, ['a'], 0)).toBe(0);
  });

  test('deepFreeze preserves Date and class instances', () => {
    class MyClass {
      val: number;
      constructor(v: number) { this.val = v; }
      sayHi() { return 'hi ' + this.val; }
    }

    const map = new Map();
    map.set('key', { nested: 1 });

    const obj = {
      plain: { a: 1 },
      date: new Date('2023-01-01'),
      regexp: /abc/g,
      myClass: new MyClass(42),
      map: map,
    };

    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.plain)).toBe(true);

    expect(frozen.date instanceof Date).toBe(true);
    expect(frozen.date.getTime()).toBe(new Date('2023-01-01').getTime());

    expect(frozen.regexp instanceof RegExp).toBe(true);
    expect(frozen.regexp.source).toBe('abc');

    expect(frozen.myClass instanceof MyClass).toBe(true);
    expect(frozen.myClass.sayHi()).toBe('hi 42');

    expect(frozen.map instanceof Map).toBe(true);
    expect(Object.isFrozen(frozen.map.get('key'))).toBe(true);
    expect(() => frozen.map.set('new', 2)).toThrow();

    expect(() => frozen.date.setTime(1)).toThrow();
  });
});
