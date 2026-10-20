// @vitest-environment node
import { afterEach, beforeEach, expect, test } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { packageShowcase, parseArguments, showcaseConfig, validateApiOrigin } from '../../scripts/packageShowcase'

const apiOrigin = 'https://mednexus-showcase-api.example.test'
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  rewrites: [{ source: '/api/:path*', destination: 'https://mednexus-hngd.onrender.com/api/:path*' },
    { source: '/((?!api(?:/|$)|assets(?:/|$)|.*\\.[^/]+$).*)', destination: '/index.html' }],
  headers: [{ source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }],
}
let directory, distDirectory, productionConfigFile, outputDirectory
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mednexus-package-test-'))
  distDirectory = path.join(directory, 'dist')
  productionConfigFile = path.join(directory, 'vercel.json')
  outputDirectory = path.join(directory, 'demo.local')
  await fs.mkdir(path.join(distDirectory, 'assets'), { recursive: true })
  await fs.writeFile(path.join(distDirectory, 'index.html'), '<div id="root"></div>')
  await fs.writeFile(path.join(distDirectory, 'assets', 'app.js'), 'console.log("sample")')
  await fs.writeFile(productionConfigFile, JSON.stringify(config))
})
afterEach(async () => {
  const target = path.resolve(directory)
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('mednexus-package-test-')) {
    throw new Error('Refusing cleanup outside the temporary package test directory')
  }
  await fs.rm(target, { recursive: true, force: true })
})
const pack = (overrides = {}) => packageShowcase({ apiOrigin, distDirectory, productionConfigFile, outputDirectory, ...overrides })

test('requires an explicit HTTPS origin and rejects production destinations and deceptive variants', () => {
  for (const value of [undefined, 'http://demo.example.test', `${apiOrigin}/api`, `${apiOrigin}?token=secret`,
    `${apiOrigin}#fragment`, 'https://user:password@demo.example.test', 'https://mednexus-hngd.onrender.com',
    'https://MEDNEXUS-HNGD.onrender.com.:443/', 'https://med-nexus-pi.vercel.app']) {
    expect(() => validateApiOrigin(value)).toThrow()
  }
  expect(validateApiOrigin(`${apiOrigin}/`)).toBe(apiOrigin)
})

test('copies the build into a new folder with isolated API routing and unchanged security and SPA settings', async () => {
  const original = await fs.readFile(productionConfigFile, 'utf8')
  expect(await pack()).toMatchObject({ outputDirectory, apiOrigin, files: 2 })
  expect(await fs.readFile(path.join(outputDirectory, 'assets', 'app.js'), 'utf8')).toBe('console.log("sample")')
  const packaged = JSON.parse(await fs.readFile(path.join(outputDirectory, 'vercel.json'), 'utf8'))
  expect(packaged.rewrites).toEqual([{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }, config.rewrites[1]])
  expect(packaged.headers).toEqual(config.headers)
  expect(await fs.readFile(productionConfigFile, 'utf8')).toBe(original)
  await expect(fs.stat(path.join(outputDirectory, '.vercel'))).rejects.toMatchObject({ code: 'ENOENT' })
})

test('does not copy Vercel project links or local secrets from the build', async () => {
  await fs.mkdir(path.join(distDirectory, '.vercel'))
  await fs.writeFile(path.join(distDirectory, '.vercel', 'project.json'), '{"projectId":"production"}')
  await fs.writeFile(path.join(distDirectory, 'credentials.local'), 'private')
  await fs.writeFile(path.join(distDirectory, '.env'), 'PRIVATE_TOKEN=not-a-real-token')
  await fs.writeFile(path.join(distDirectory, 'vercel.json'), '{"rewrites":[]}')
  await pack()
  for (const name of ['.vercel', 'credentials.local', '.env']) await expect(fs.stat(path.join(outputDirectory, name))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(JSON.parse(await fs.readFile(path.join(outputDirectory, 'vercel.json'), 'utf8')).rewrites[0].destination).toBe(`${apiOrigin}/api/:path*`)
})

test('never deletes or overwrites an existing output folder', async () => {
  await fs.mkdir(outputDirectory)
  await fs.writeFile(path.join(outputDirectory, 'keep.txt'), 'preserve me')
  await expect(pack()).rejects.toThrow('already exists')
  expect(await fs.readdir(outputDirectory)).toEqual(['keep.txt'])
  expect(await fs.readFile(path.join(outputDirectory, 'keep.txt'), 'utf8')).toBe('preserve me')
})

test('fails clearly for a missing build, an unignored folder, or recursive output', async () => {
  await expect(pack({ distDirectory: path.join(directory, 'missing') })).rejects.toThrow('npm run build')
  await expect(pack({ outputDirectory: path.join(directory, 'unsafe') })).rejects.toThrow('.local')
  await expect(pack({ outputDirectory: path.join(distDirectory, 'nested.local') })).rejects.toThrow('outside')
  await expect(fs.stat(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('rejects additional remote/API rewrites and honors a changed production backend block', () => {
  const changed = structuredClone(config)
  changed.rewrites[0].destination = 'https://new-production.example.test/api/:path*'
  expect(() => showcaseConfig(changed, 'https://new-production.example.test')).toThrow('production')
  changed.rewrites.push({ source: '/api/ready', destination: 'https://other.example.test/api/ready' })
  expect(() => showcaseConfig(changed, apiOrigin)).toThrow('additional')
})

test('parses only explicit known CLI arguments', () => {
  expect(parseArguments(['--api-origin', apiOrigin, '--output', 'demo.local'])).toEqual({ apiOrigin, outputDirectory: 'demo.local' })
  for (const args of [['--api-origin'], ['--unknown', 'value'], ['--api-origin', apiOrigin, '--api-origin', apiOrigin]]) {
    expect(() => parseArguments(args)).toThrow()
  }
})

test.skipIf(process.platform === 'win32')('refuses symlinks instead of packaging files outside dist', async () => {
  await fs.symlink(productionConfigFile, path.join(distDirectory, 'outside.json'))
  await expect(pack()).rejects.toThrow('symbolic link')
  await expect(fs.stat(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
})
