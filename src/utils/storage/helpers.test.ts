import { describe, test, expect } from 'vitest';
import { getNestedValue, deepFreeze } from './helpers';

describe('helpers', () => {
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
