// Vite proxies /api in development; production routes /api on the same HTTPS origin.
export const API_BASE = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : '';
export const SESSION_EXPIRED_EVENT = 'mednexus:session-expired'
let sessionRevision = 0
export const getSessionRevision = () => sessionRevision

const notifyInvalidSession = async (input, response, requestRevision) => {
  if (response.status !== 401 || typeof window === 'undefined' || typeof input !== 'string') return
  // A wrong password also returns 401. Only authentication middleware can
  // declare the existing session invalid; preserve other validation errors.
  try {
    const url = new URL(input, window.location.origin)
    const apiOrigin = new URL(API_BASE || window.location.origin, window.location.origin).origin
    if (![window.location.origin, apiOrigin].includes(url.origin) || !url.pathname.startsWith('/api/')) return
    if (/^\/api\/auth\/(login|register|forgot-password|reset-password)\/?$/.test(url.pathname)) return
    const data = await response.clone().json()
    if (data.code === 'AUTH_SESSION_INVALID' && requestRevision === sessionRevision) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  } catch { /* Preserve the original response when a gateway returns non-JSON. */ }
}

// A sleeping API host can briefly return gateway errors while it starts.
const readRetryDelays = [2000, 4000, 6000, 8000, 10000, 10000, 10000, 10000]
const transientStatuses = new Set([502, 503, 504])
const readAttemptTimeout = 15000
const readTimeout = 90000

class ApiTimeoutError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TimeoutError'
    this.code = 'API_TIMEOUT'
  }
}

const waitForRetry = (delay, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason)
    return
  }
  const onAbort = () => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    reject(signal.reason)
  }
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, delay)
  signal?.addEventListener('abort', onAbort, { once: true })
})

const fetchAndRead = async (input, options, readResponse) => {
  const response = await fetch(input, options)
  if (options.signal?.aborted) throw options.signal.reason
  return { response, value: await readResponse(response) }
}

const fetchReadAttempt = async (input, options, signal, readResponse) => {
  if (signal.aborted) throw signal.reason
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  const timeoutError = new ApiTimeoutError('API request attempt timed out')
  const timeout = setTimeout(() => controller.abort(timeoutError), readAttemptTimeout)
  let onAttemptAbort
  const aborted = new Promise((_, reject) => {
    onAttemptAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', onAttemptAbort, { once: true })
  })

  try {
    // Keep the deadline and caller cancellation active through JSON body reads.
    return await Promise.race([
      fetchAndRead(input, { ...options, signal: controller.signal }, readResponse),
      aborted,
    ])
  } catch (error) {
    // Some fetch implementations reject with AbortError instead of the signal reason.
    if (controller.signal.reason === timeoutError) throw timeoutError
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', onAbort)
    controller.signal.removeEventListener('abort', onAttemptAbort)
  }
}

// Send credentials only through the API client; never patch global fetch.
const request = async (input, init = {}, json = false) => {
  const requestRevision = sessionRevision
  if (init.signal?.aborted) throw init.signal.reason
  const headers = new Headers(init.headers)
  headers.delete('Authorization')
  const method = (init.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-MedNexus-Request', '1')
  }
  const retryRead = ['GET', 'HEAD'].includes(method) && typeof input === 'string' && input.startsWith('/api/')
  const controller = retryRead || json ? new AbortController() : null
  const onAbort = () => controller.abort(init.signal.reason)
  if (controller && init.signal?.aborted) onAbort()
  else if (controller) init.signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = controller && setTimeout(() => controller.abort(new ApiTimeoutError('The server is taking too long to respond')), readTimeout)
  const options = { ...init, headers, credentials: 'include', signal: controller?.signal || init.signal }
  const readResponse = async response => {
    // An older request may finish after sign-in has established a new cookie.
    // Its 401 must not invalidate that newer session.
    if (response.ok && method !== 'GET' && typeof input === 'string') {
      const url = new URL(input, window.location.origin)
      if (url.origin === new URL(API_BASE || window.location.origin, window.location.origin).origin &&
          /^\/api\/auth\/(login|register|logout|password|profile)\/?$/.test(url.pathname)) sessionRevision += 1
    }
    await notifyInvalidSession(input, response, requestRevision)
    if (!json) return response
    if (!response.ok) {
      throw Object.assign(new Error('The request could not be completed'), {
        code: 'API_HTTP_ERROR',
        status: response.status,
      })
    }
    return method === 'HEAD' ? null : response.json()
  }

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const { response, value } = controller
          ? await fetchReadAttempt(input, options, controller.signal, readResponse)
          : await fetchAndRead(input, options, readResponse)
        if (!retryRead || !transientStatuses.has(response.status) || attempt === readRetryDelays.length) {
          return value
        }
      } catch (error) {
        if (controller?.signal.aborted) throw controller.signal.reason
        const transientFailure = error instanceof ApiTimeoutError || error instanceof TypeError
          || transientStatuses.has(error?.status)
        if (!retryRead || !transientFailure || attempt === readRetryDelays.length) throw error
      }
      await waitForRetry(readRetryDelays[attempt], controller.signal)
    }
  } finally {
    if (timeout) clearTimeout(timeout)
    init.signal?.removeEventListener('abort', onAbort)
  }
}

export const apiFetch = (input, init = {}) => request(input, init)

// Use for JSON reads that need recovery through the full response body.
export const apiFetchJson = async (input, init = {}) => {
  if (!['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase())) {
    throw new Error('JSON reads only support GET and HEAD requests')
  }
  return request(input, init, true)
}
