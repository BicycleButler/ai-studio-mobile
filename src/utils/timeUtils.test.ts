import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './timeUtils';
import { ITimeProvider } from './timeProvider';

describe('timeUtils', () => {
  const MOCK_NOW = new Date('2024-01-10T12:00:00Z').getTime();

  const mockTimeProvider: ITimeProvider = {
    now: () => MOCK_NOW,
    date: (ts?: number) => new Date(ts ?? MOCK_NOW),
  };

  it('should return empty string for 0 timestamp', () => {
    expect(formatRelativeTime(0, mockTimeProvider)).toBe('');
  });

  it('should format seconds as Just now', () => {
    const time = MOCK_NOW - 30 * 1000; // 30 seconds ago
    expect(formatRelativeTime(time, mockTimeProvider)).toBe('Just now');
  });

  it('should format minutes correctly', () => {
    const time = MOCK_NOW - 5 * 60 * 1000; // 5 minutes ago
    expect(formatRelativeTime(time, mockTimeProvider)).toBe('5m ago');
  });

  it('should format hours correctly', () => {
    const time = MOCK_NOW - 3 * 60 * 60 * 1000; // 3 hours ago
    expect(formatRelativeTime(time, mockTimeProvider)).toBe('3h ago');
  });

  it('should format yesterday correctly', () => {
    const time = MOCK_NOW - 24 * 60 * 60 * 1000; // 1 day ago
    expect(formatRelativeTime(time, mockTimeProvider)).toBe('Yesterday');
  });

  it('should format days ago correctly', () => {
    const time = MOCK_NOW - 3 * 24 * 60 * 60 * 1000; // 3 days ago
    expect(formatRelativeTime(time, mockTimeProvider)).toBe('3d ago');
  });

  it('should format full date for more than 6 days ago', () => {
    const time = MOCK_NOW - 10 * 24 * 60 * 60 * 1000; // 10 days ago (Dec 31, 2023)
    const result = formatRelativeTime(time, mockTimeProvider);
    expect(result).toMatch(/Dec 31/);
  });
});
