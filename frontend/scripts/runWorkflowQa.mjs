import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli')
const filters = process.argv.slice(2)
if (filters.some(filter => filter.startsWith('-'))) throw new Error('Use npx playwright test for advanced filtering; this runner accepts spec filename filters.')
const files = (await readdir(path.join(root, 'e2e'))).filter(name => name.endsWith('.spec.js') &&
  (!filters.length || filters.some(filter => name.includes(filter)))).sort()
if (!files.length) throw new Error('No workflow specs selected')
const output = path.join(root, 'test-results', `workflow-${randomUUID()}`)
const blobs = path.join(output, 'blobs')
await mkdir(blobs, { recursive: true })
const run = (args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1))
})
let failed = false
for (const file of files) {
  const name = file.replace('.spec.js', '')
  const jsonFile = path.join(output, `${name}.json`)
  // A fresh QA process/database/inbox also gives each workflow its own genuine
  // rate-limit buckets. Production limits and authentication remain active.
  console.log(`\nWorkflow QA: ${file} (fresh disposable environment)`)
  const code = await run(['test', `e2e/${file}`, '--reporter=list,blob,json', '--output', path.join(output, name)], {
    PLAYWRIGHT_BLOB_OUTPUT_FILE: path.join(blobs, `${name}.zip`), PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile,
  })
  try {
    const report = JSON.parse(await readFile(jsonFile, 'utf8'))
    if (!report.stats?.expected || report.stats.unexpected || report.stats.skipped || report.stats.flaky || report.errors?.length) {
      console.error(`Workflow QA had failed, skipped, flaky or missing tests: ${file}`)
      failed = true
    }
  } catch (error) {
    console.error(`Workflow QA result unavailable for ${file}: ${error.message}`)
    failed = true
  }
  if (code !== 0) failed = true
}
const merged = await run(['merge-reports', '--reporter=html,json', blobs], {
  PLAYWRIGHT_HTML_OPEN: 'never',
  PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(root, 'test-results', 'real-api-results.json'),
})
process.exitCode = failed || merged !== 0 ? 1 : 0
