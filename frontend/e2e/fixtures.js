import { test as base, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

export { expect }
export const test = base.extend({
  browserEvents: [async ({ browserName }, runEvents, testInfo) => {
    const events = { browserName, pageErrors: [], consoleErrors: [], failedRequests: [], apiResponses: [] }
    const pages = new WeakSet()
    const contexts = new WeakSet()
    const trackPage = page => {
      if (pages.has(page)) return
      pages.add(page)
      page.on('pageerror', error => events.pageErrors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') events.consoleErrors.push(message.text()) })
      page.on('requestfailed', request => events.failedRequests.push({ method: request.method(), url: request.url(), error: request.failure()?.errorText }))
      page.on('response', response => {
        if (new URL(response.url()).pathname.startsWith('/api/')) events.apiResponses.push({ method: response.request().method(), url: response.url(), status: response.status() })
      })
    }
    const trackContext = context => {
      if (contexts.has(context)) return
      contexts.add(context)
      context.on('page', trackPage)
      context.pages().forEach(trackPage)
    }
    await runEvents({ trackContext })
    // Expected validation/conflict responses and injected network failures are
    // checked by their workflows; unhandled browser exceptions always fail QA.
    await testInfo.attach('browser-events.json', { body: Buffer.from(JSON.stringify(events, null, 2)), contentType: 'application/json' })
    expect(events.pageErrors, 'Unhandled browser exceptions').toEqual([])
  }, { auto: true }],
  context: async ({ context, browserEvents }, runContext) => {
    browserEvents.trackContext(context)
    await runContext(context)
  },
  newContext: async ({ browser, browserEvents, contextOptions, baseURL, viewport, screen, userAgent,
    deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, colorScheme, reducedMotion, forcedColors, contrast }, runFactory) => {
    const contexts = []
    // Additional roles need isolated cookies while retaining the project's full
    // device emulation, rather than silently reverting to a desktop context.
    const createContext = async (options = {}) => {
      const context = await browser.newContext({ ...contextOptions, baseURL, viewport, screen, userAgent,
        deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, colorScheme, reducedMotion, forcedColors, contrast, ...options })
      contexts.push(context)
      browserEvents.trackContext(context)
      return context
    }
    await runFactory(createContext)
    await Promise.all(contexts.map(context => context.close()))
  },
})
