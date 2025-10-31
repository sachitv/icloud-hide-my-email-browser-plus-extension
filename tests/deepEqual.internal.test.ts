import { describe, it, expect, vi } from 'vitest';
import {
  areArraysEqual,
  areDatesEqual,
  areObjectsEqual,
} from '../src/utils/deepEqual';

describe('areArraysEqual', () => {
  it('should return true for equal arrays of primitives', () => {
    const stack = new WeakMap();
    expect(areArraysEqual([1, 2, 3], [1, 2, 3], stack)).toBe(true);
  });

  it('should return false for arrays of different lengths', () => {
    const stack = new WeakMap();
    expect(areArraysEqual([1, 2, 3], [1, 2], stack)).toBe(false);
  });

  it('should return true for equal arrays of objects', () => {
    const stack = new WeakMap();
    const arr1 = [{ a: 1 }, { b: 2 }];
    const arr2 = [{ a: 1 }, { b: 2 }];
    expect(areArraysEqual(arr1, arr2, stack)).toBe(true);
  });

  it('should return false for unequal arrays of objects', () => {
    const stack = new WeakMap();
    const arr1 = [{ a: 1 }, { b: 2 }];
    const arr2 = [{ a: 1 }, { b: 3 }];
    expect(areArraysEqual(arr1, arr2, stack)).toBe(false);
  });

  it('should handle nested arrays', () => {
    const stack = new WeakMap();
    const arr1 = [1, [2, 3]];
    const arr2 = [1, [2, 3]];
    const arr3 = [1, [2, 4]];
    expect(areArraysEqual(arr1, arr2, stack)).toBe(true);
    expect(areArraysEqual(arr1, arr3, stack)).toBe(false);
  });
});

describe('areDatesEqual', () => {
  it('should return true for equal dates', () => {
    expect(areDatesEqual(new Date('2023-01-01'), new Date('2023-01-01'))).toBe(
      true
    );
  });

  it('should return false for unequal dates', () => {
    expect(areDatesEqual(new Date('2023-01-01'), new Date('2023-01-02'))).toBe(
      false
    );
  });

  it('should return false for objects with different values', () => {
    const stack = new WeakMap();
    expect(areObjectsEqual({ a: 1, b: '2' }, { a: 1, b: '3' }, stack)).toBe(
      false
    );
  });

  it('should return true for equal nested objects', () => {
    const stack = new WeakMap();
    const obj1 = { a: 1, b: { c: 3 } };
    const obj2 = { a: 1, b: { c: 3 } };
    expect(areObjectsEqual(obj1, obj2, stack)).toBe(true);
  });

  it('should return false for unequal nested objects', () => {
    const stack = new WeakMap();
    const obj1 = { a: 1, b: { c: 3 } };
    const obj2 = { a: 1, b: { c: 4 } };
    expect(areObjectsEqual(obj1, obj2, stack)).toBe(false);
  });

  it('should return false for objects with different prototypes', () => {
    const stack = new WeakMap();
    const obj1 = { a: 1 };
    const obj2 = Object.create(null);
    obj2.a = 1;
    expect(areObjectsEqual(obj1, obj2, stack)).toBe(false);
  });
});

describe('areObjectsEqual', () => {
  it('should return true for equal simple objects', () => {
    const stack = new WeakMap();
    expect(areObjectsEqual({ a: 1, b: '2' }, { a: 1, b: '2' }, stack)).toBe(
      true
    );
  });

  it('should return false for objects with different keys', () => {
    const stack = new WeakMap();
    expect(areObjectsEqual({ a: 1, b: '2' }, { a: 1, c: '2' }, stack)).toBe(
      false
    );
  });
});
