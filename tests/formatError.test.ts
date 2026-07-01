import { expect, test } from 'vitest';
import { formatError } from '../src/utils/formatError';

test('formatError returns message for Error instance', () => {
  const err = new Error('Something went wrong');
  expect(formatError(err)).toBe('Something went wrong');
});

test('formatError returns string for string input', () => {
  expect(formatError('Raw error string')).toBe('Raw error string');
});

test('formatError returns stringified value for other types', () => {
  expect(formatError(404)).toBe('404');
  expect(formatError({ error: 'object' })).toBe('[object Object]');
  expect(formatError(null)).toBe('null');
  expect(formatError(undefined)).toBe('undefined');
});
