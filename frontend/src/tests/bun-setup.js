import { JSDOM } from 'jsdom'
import '@testing-library/jest-dom'
import * as vitest from 'vitest'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
  pretendToBeVisual: true,
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.navigator = dom.window.navigator
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.Text = dom.window.Text
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.customElements = dom.window.customElements
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame || ((cb) => setTimeout(cb, 0))
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame || ((id) => clearTimeout(id))
if (!globalThis.crypto) {
  globalThis.crypto = dom.window.crypto || { randomUUID: () => 'test-uuid-1234' }
}

if (vitest.vi && !vitest.vi.advanceTimersByTimeAsync) {
  vitest.vi.advanceTimersByTimeAsync = async (ms) => {
    vitest.vi.advanceTimersByTime(ms)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
