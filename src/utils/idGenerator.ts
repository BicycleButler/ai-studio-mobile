export function generateUniqueId(prefix: string, explicitSuffix?: string): string {
  const now = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const suffixToUse = explicitSuffix ? `${explicitSuffix}_${randomSuffix}` : randomSuffix;
  return `${prefix}_${now}_${suffixToUse}`;
}
