// Vite proxies /api in development; production routes /api on the same HTTPS origin.
export const API_BASE = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : '';

// Send credentials only through the API client; never patch global fetch.
export const apiFetch = (input, init = {}) => {
  const headers = new Headers(init.headers)
  headers.delete('Authorization')
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase())) {
    headers.set('X-MedNexus-Request', '1')
  }
  return fetch(input, { ...init, headers, credentials: 'include' })
}
