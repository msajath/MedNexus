// Vite proxies /api in development; production routes /api on the same HTTPS origin.
export const API_BASE = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : '';

// A sleeping API host can briefly return gateway errors while it starts.
const readRetryDelays = [2000, 4000, 6000, 8000, 10000, 10000, 10000, 10000]
const transientStatuses = new Set([502, 503, 504])

const waitForRetry = (delay, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason)
    return
  }
  const onAbort = () => {
    clearTimeout(timer)
    reject(signal.reason)
  }
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, delay)
  signal?.addEventListener('abort', onAbort, { once: true })
})

// Send credentials only through the API client; never patch global fetch.
export const apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers)
  headers.delete('Authorization')
  const method = (init.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-MedNexus-Request', '1')
  }
  const options = { ...init, headers, credentials: 'include' }
  const retryRead = ['GET', 'HEAD'].includes(method) && typeof input === 'string' && input.startsWith('/api/')

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(input, options)
      if (!retryRead || !transientStatuses.has(response.status) || attempt === readRetryDelays.length) {
        return response
      }
    } catch (error) {
      if (!retryRead || attempt === readRetryDelays.length || init.signal?.aborted) throw error
    }
    await waitForRetry(readRetryDelays[attempt], init.signal)
  }
}
