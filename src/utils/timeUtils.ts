import { ITimeProvider, defaultTimeProvider } from './timeProvider';

/**
 * Formats a relative timestamp (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
export function formatRelativeTime(timestamp: number, timeProvider: ITimeProvider = defaultTimeProvider): string {
  if (!timestamp) return "";
  const now = timeProvider.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = timeProvider.date(timestamp);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
