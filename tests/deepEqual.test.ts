import { describe, it, expect } from 'vitest';
import { deepEqual } from '../src/utils/deepEqual';

describe('deepEqual', () => {
  // Test cases for primitives
  it('should return true for equal primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
  });

  it('should return false for unequal primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('hello', 'world')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(0, null)).toBe(false);
  });

  it('should handle NaN', () => {
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
  });

  // Test cases for objects
  it('should return true for equal simple objects', () => {
    expect(deepEqual({ a: 1, b: '2' }, { a: 1, b: '2' })).toBe(true);
  });

  it('should return false for unequal simple objects', () => {
    expect(deepEqual({ a: 1, b: '2' }, { a: 1, b: '3' })).toBe(false);
    expect(deepEqual({ a: 1, b: '2' }, { a: 1, c: '2' })).toBe(false);
    expect(deepEqual({ a: 1, b: '2' }, { a: 1 })).toBe(false);
  });

  it('should return true for equal nested objects', () => {
    const obj1 = { a: 1, b: { c: 3, d: { e: 5 } } };
    const obj2 = { a: 1, b: { c: 3, d: { e: 5 } } };
    expect(deepEqual(obj1, obj2)).toBe(true);
  });

  it('should return false for unequal nested objects', () => {
    const obj1 = { a: 1, b: { c: 3, d: { e: 5 } } };
    const obj2 = { a: 1, b: { c: 3, d: { e: 6 } } };
    expect(deepEqual(obj1, obj2)).toBe(false);
  });

  // Test cases for arrays
  it('should return true for equal arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it('should return false for unequal arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  it('should return true for arrays with equal objects', () => {
    const arr1 = [{ a: 1 }, { b: 2 }];
    const arr2 = [{ a: 1 }, { b: 2 }];
    expect(deepEqual(arr1, arr2)).toBe(true);
  });

  it('should return false for arrays with unequal objects', () => {
    const arr1 = [{ a: 1 }, { b: 2 }];
    const arr2 = [{ a: 1 }, { b: 3 }];
    expect(deepEqual(arr1, arr2)).toBe(false);
  });

  // Test cases for dates
  it('should return true for equal dates', () => {
    expect(deepEqual(new Date('2023-01-01'), new Date('2023-01-01'))).toBe(
      true
    );
  });

  it('should return false for unequal dates', () => {
    expect(deepEqual(new Date('2023-01-01'), new Date('2023-01-02'))).toBe(
      false
    );
  });

  // Test cases for object prototypes
  it('should return false for objects with different prototypes', () => {
    const obj1 = { a: 1 };
    const obj2 = Object.create(null);
    obj2.a = 1;
    expect(deepEqual(obj1, obj2)).toBe(false);
  });

  it('should handle complex structures', () => {
    const obj1 = {
      a: 1,
      b: 'hello',
      c: [1, { d: 4, e: new Date(1) }],
      f: { g: { h: 'world' } },
    };
    const obj2 = {
      a: 1,
      b: 'hello',
      c: [1, { d: 4, e: new Date(1) }],
      f: { g: { h: 'world' } },
    };
    expect(deepEqual(obj1, obj2)).toBe(true);

    const obj3 = {
      a: 1,
      b: 'hello',
      c: [1, { d: 4, e: new Date(1) }],
      f: { g: { h: 'different' } },
    };
    expect(deepEqual(obj1, obj3)).toBe(false);
  });

  // Distinguishes array shape from array-like objects.
  it('should treat arrays and objects with numeric keys differently', () => {
    const array = [1, 2, 3];
    const arrayLike = { 0: 1, 1: 2, 2: 3, length: 3 };
    expect(deepEqual(array, arrayLike)).toBe(false);
  });

  // Ensures symbol keyed properties participate in equality checks.
  it('should compare objects with symbol keys', () => {
    const sym = Symbol('key');
    const obj1 = { [sym]: 1 };
    const obj2 = { [sym]: 1 };
    const obj3 = { [sym]: 2 };
    expect(deepEqual(obj1, obj2)).toBe(true);
    expect(deepEqual(obj1, obj3)).toBe(false);
  });

  // Test cases for circular references
  describe('circular references', () => {
    it('should handle circular references in objects', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const obj1: any = { a: 1 };
      obj1.b = obj1;
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const obj2: any = { a: 1 };
      obj2.b = obj2;
      expect(deepEqual(obj1, obj2)).toBe(true);

      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const obj3: any = { a: 1 };
      obj3.b = { c: obj3 };
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const obj4: any = { a: 1 };
      obj4.b = { c: obj4 };
      expect(deepEqual(obj3, obj4)).toBe(true);
    });

    it('should handle circular references in arrays', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const arr1: any[] = [1];
      arr1.push(arr1);
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const arr2: any[] = [1];
      arr2.push(arr2);
      expect(deepEqual(arr1, arr2)).toBe(true);

      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const arr3: any[] = [1, [2]];
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      (arr3[1] as any[]).push(arr3);
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const arr4: any[] = [1, [2]];
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      (arr4[1] as any[]).push(arr4);
      expect(deepEqual(arr3, arr4)).toBe(true);
    });

    it('should return false for objects with different circular structures', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const obj1: any = { a: 1 };
      obj1.b = obj1; // Circular reference to self

      // biome-ignore lint/suspicious/noExplicitAny: Required for testing circular references
      const obj2: any = { a: 1 };
      obj2.b = { c: obj2 }; // Circular reference within a nested object

      expect(deepEqual(obj1, obj2)).toBe(false);
    });
  });

  it('should return false for objects with different number of keys', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1 };
    expect(deepEqual(obj1, obj2)).toBe(false);
  });
});
