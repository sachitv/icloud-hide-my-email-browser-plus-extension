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
    expect(deepEqual(NaN, NaN)).toBe(true);
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
});
