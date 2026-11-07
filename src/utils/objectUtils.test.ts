import { describe, test, expect } from 'vitest';
import { DefaultObjectUtils } from './objectUtils';

describe('objectUtils', () => {
  const objectUtils = new DefaultObjectUtils();
  test('fastDeepEqual correctly checks equality for Dates, RegExp, Maps, and Sets', () => {
    // Dates
    expect(objectUtils.fastDeepEqual(new Date(100), new Date(100))).toBe(true);
    expect(objectUtils.fastDeepEqual(new Date(100), new Date(200))).toBe(false);

    // RegExp
    expect(objectUtils.fastDeepEqual(/abc/g, /abc/g)).toBe(true);
    expect(objectUtils.fastDeepEqual(/abc/g, /abc/i)).toBe(false);

    // Maps
    expect(objectUtils.fastDeepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(objectUtils.fastDeepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
    expect(objectUtils.fastDeepEqual(new Map([['a', { nested: true }]]), new Map([['a', { nested: true }]]))).toBe(true);

    // Sets
    expect(objectUtils.fastDeepEqual(new Set([1, 2]), new Set([1, 2]))).toBe(true);
    expect(objectUtils.fastDeepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);

    // Edge cases against objects
    expect(objectUtils.fastDeepEqual(new Date(100), {})).toBe(false);
    expect(objectUtils.fastDeepEqual(/abc/g, {})).toBe(false);
    expect(objectUtils.fastDeepEqual(new Map(), {})).toBe(false);
    expect(objectUtils.fastDeepEqual(new Set(), {})).toBe(false);
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

    const frozen = objectUtils.deepFreeze(obj);

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
