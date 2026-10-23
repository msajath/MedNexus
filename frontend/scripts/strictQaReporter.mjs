// A successful Playwright process must represent actual, unskipped scenarios.
// `forbidOnly` rejects focused tests; this also rejects empty or skipped suites.
export default class StrictQaReporter {
  tests = []

  onBegin(config, suite) {
    this.tests = suite.allTests()
  }

  onEnd(result) {
    const invalid = this.tests.filter(test => test.outcome() !== 'expected')
    if (!this.tests.length || invalid.length) {
      console.error(`QA requires all selected tests to pass without skips or flakes (${this.tests.length} selected, ${invalid.length} invalid).`)
      return { status: 'failed' }
    }
    return { status: result.status }
  }
}
