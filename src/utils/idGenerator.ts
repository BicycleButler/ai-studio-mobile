export function generateUniqueId(prefix: string): string {
  const now = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${now}_${randomSuffix}`;
}
