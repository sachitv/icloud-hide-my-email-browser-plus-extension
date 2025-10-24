const hasOwn = Object.prototype.hasOwnProperty;

type AnyRecord = Record<string | number | symbol, unknown>;

const isObjectLike = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

const compareArrays = (
  firstArray: unknown[],
  secondArray: unknown,
  stack: WeakMap<object, object>
): boolean => {
  if (!Array.isArray(secondArray) || firstArray.length !== secondArray.length) {
    return false;
  }

  return firstArray.every((item, index) =>
    deepEqualInternal(item, secondArray[index], stack)
  );
};

const compareDates = (first: object, second: object): boolean =>
  first instanceof Date &&
  second instanceof Date &&
  first.getTime() === second.getTime();

const compareRecords = (
  recordA: AnyRecord,
  recordB: AnyRecord,
  stack: WeakMap<object, object>
): boolean => {
  if (Object.getPrototypeOf(recordA) !== Object.getPrototypeOf(recordB)) {
    return false;
  }

  const keysA = Reflect.ownKeys(recordA);
  const keysB = Reflect.ownKeys(recordB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every((key) => {
    if (!hasOwn.call(recordB, key)) {
      return false;
    }

    return deepEqualInternal(
      recordA[key as keyof AnyRecord],
      recordB[key as keyof AnyRecord],
      stack
    );
  });
};

const deepEqualInternal = (
  a: unknown,
  b: unknown,
  stack: WeakMap<object, object>
): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (!isObjectLike(a) || !isObjectLike(b)) {
    return false;
  }

  if (stack.get(a) === b) {
    return true;
  }

  stack.set(a, b);

  if (Array.isArray(a) || Array.isArray(b)) {
    return compareArrays(a as unknown[], b, stack);
  }

  if (compareDates(a, b)) {
    return true;
  }

  if (a instanceof Date || b instanceof Date) {
    return false;
  }

  return compareRecords(a as AnyRecord, b as AnyRecord, stack);
};

export const deepEqual = (a: unknown, b: unknown): boolean =>
  deepEqualInternal(a, b, new WeakMap());

export default deepEqual;
