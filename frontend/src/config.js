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
  const retryRead = ['GET', 'HEAD'].includes(method) && typeof input === 'string' && input.startsWith('/api/')
  const controller = retryRead ? new AbortController() : null
  const onAbort = () => controller.abort(init.signal.reason)
  if (controller && init.signal?.aborted) onAbort()
  else if (controller) init.signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = controller && setTimeout(() => controller.abort(new Error('The server is taking too long to respond')), 90000)
  const options = { ...init, headers, credentials: 'include', signal: controller?.signal || init.signal }

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(input, options)
        if (!retryRead || !transientStatuses.has(response.status) || attempt === readRetryDelays.length) {
          return response
        }
      } catch (error) {
        if (!retryRead || attempt === readRetryDelays.length || controller.signal.aborted) throw error
      }
      await waitForRetry(readRetryDelays[attempt], controller.signal)
    }
  } finally {
    if (timeout) clearTimeout(timeout)
    init.signal?.removeEventListener('abort', onAbort)
  }
}
