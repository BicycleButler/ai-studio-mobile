export interface ITimeProvider {
  now(): number;
  date(timestamp?: number): Date;
  formatRelative(timestamp: number): string;
}

export class DefaultTimeProvider implements ITimeProvider {
  public now(): number {
    return Date.now();
  }

  public date(timestamp?: number): Date {
    return timestamp !== undefined ? new Date(timestamp) : new Date();
  }

  public formatRelative(timestamp: number): string {
    if (!timestamp) return "";
    const now = this.now();
    const diffMs = now - timestamp;

    if (diffMs < 60000) return "Just now";

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    const d = this.date(timestamp);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
}

