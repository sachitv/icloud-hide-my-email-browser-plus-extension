const hasOwn = Object.prototype.hasOwnProperty;

type AnyRecord = Record<string | number | symbol, unknown>;

function deepEqualInternal(
  a: unknown,
  b: unknown,
  stack: WeakMap<object, object>
): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  const objectA = a as object;
  const objectB = b as object;

  if (stack.get(objectA) === objectB) {
    return true;
  }

  stack.set(objectA, objectB);

  if (Array.isArray(objectA) && Array.isArray(objectB)) {
    return areArraysEqual(objectA, objectB, stack);
  }

  if (objectA instanceof Date && objectB instanceof Date) {
    return areDatesEqual(objectA, objectB);
  }

  return areObjectsEqual(objectA as AnyRecord, objectB as AnyRecord, stack);
}

/**
 * @private
 *
 * This function is exported for testing purposes only.
 */
export function areArraysEqual(
  a: unknown[],
  b: unknown[],
  stack: WeakMap<object, object>
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (!deepEqualInternal(a[index], b[index], stack)) {
      return false;
    }
  }

  return true;
}

/**
 * @private
 *
 * This function is exported for testing purposes only.
 */
export const areDatesEqual = (a: Date, b: Date): boolean =>
  a.getTime() === b.getTime();

/**
 * @private
 *
 * This function is exported for testing purposes only.
 */
export function areObjectsEqual(
  a: AnyRecord,
  b: AnyRecord,
  stack: WeakMap<object, object>
): boolean {
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
    return false;
  }

  const keysA = Reflect.ownKeys(a);
  const keysB = Reflect.ownKeys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!hasOwn.call(b, key)) {
      return false;
    }

    if (!deepEqualInternal(a[key], b[key], stack)) {
      return false;
    }
  }

  return true;
}

export const deepEqual = (a: unknown, b: unknown): boolean =>
  deepEqualInternal(a, b, new WeakMap());

export default deepEqual;
