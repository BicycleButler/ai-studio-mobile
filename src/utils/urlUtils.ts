export function buildUrlWithParams(endpoint: string, queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>): string {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return endpoint;
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      value.forEach(item => {
        searchParams.append(key, String(item));
      });
    } else {
      searchParams.append(key, String(value));
    }
  }

  const queryStr = searchParams.toString();
  if (!queryStr) {
    return endpoint;
  }

  const baseEndpoint = endpoint.replace(/[?&]$/, '');
  const separator = baseEndpoint.includes('?') ? '&' : '?';
  return `${baseEndpoint}${separator}${queryStr}`;
}
