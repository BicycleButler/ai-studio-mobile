import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errorHandling';

describe('getErrorMessage', () => {
  it('should parse an Error with a JSON string message', () => {
    const err = new Error('{"error":{"message":"JSON Error message"}}');
    expect(getErrorMessage(err)).toBe('JSON Error message');
  });

  it('should fallback to raw message for unparsable JSON string in Error', () => {
    const err = new Error('{not valid json}');
    expect(getErrorMessage(err)).toBe('{not valid json}');
  });

  it('should return regular Error message', () => {
    const err = new Error('Regular Error message');
    expect(getErrorMessage(err)).toBe('Regular Error message');
  });

  it('should parse a raw JSON string', () => {
    const errStr = '{"error":{"message":"JSON String message"}}';
    expect(getErrorMessage(errStr)).toBe('JSON String message');
  });

  it('should return raw string if it is not valid JSON but looks like it', () => {
    const errStr = '{looks like json}';
    expect(getErrorMessage(errStr)).toBe('{looks like json}');
  });

  it('should return normal string', () => {
    const errStr = 'Normal string error';
    expect(getErrorMessage(errStr)).toBe('Normal string error');
  });

  it('should extract message from an object with error property', () => {
    const errObj = { error: { message: 'Object error message' } };
    expect(getErrorMessage(errObj)).toBe('Object error message');
  });

  it('should extract message from an object with message property', () => {
    const errObj = { message: 'Direct object message' };
    expect(getErrorMessage(errObj)).toBe('Direct object message');
  });

  it('should return fallback message for null/undefined or unknown formats', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred.');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred.');
    expect(getErrorMessage(123)).toBe('An unexpected error occurred.');
    expect(getErrorMessage({})).toBe('An unexpected error occurred.');
  });
});
