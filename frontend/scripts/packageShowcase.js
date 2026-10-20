import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutput = path.resolve(frontendDirectory, '../showcase-frontend.local')
const productionHosts = new Set(['mednexus-hngd.onrender.com', 'med-nexus-pi.vercel.app'])

export const validateApiOrigin = (value, extraProductionOrigins = []) => {
  let url
  try { url = new URL(value) } catch { throw new Error('Pass an explicit HTTPS showcase API origin with --api-origin.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('The showcase API must be an HTTPS origin without credentials, a path, a query, or a fragment.')
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const blocked = new Set([...productionHosts, ...extraProductionOrigins.map((origin) => new URL(origin).hostname.toLowerCase().replace(/\.$/, ''))])
  if (blocked.has(host)) throw new Error('The production site and API cannot be used as the showcase API.')
  return url.origin
}

export const showcaseConfig = (productionConfig, apiOrigin) => {
  const api = productionConfig.rewrites?.find((rule) => rule.source === '/api/:path*')
  if (!api) throw new Error('The production configuration has no expected API rewrite; review it before packaging.')
  const origin = validateApiOrigin(apiOrigin, [new URL(api.destination).origin])
  const localRewrites = productionConfig.rewrites.filter((rule) => rule !== api)
  if (localRewrites.some((rule) => typeof rule.destination !== 'string' || !rule.destination.startsWith('/') || rule.destination.startsWith('//') || /^\/api(?:\/|$)/.test(rule.source))) {
    throw new Error('An additional API or remote rewrite needs review before packaging the showcase.')
  }
  return {
    $schema: productionConfig.$schema,
    rewrites: [{ source: '/api/:path*', destination: `${origin}/api/:path*` }, ...structuredClone(localRewrites)],
    headers: structuredClone(productionConfig.headers || []),
  }
}

// Copy only built public files. Never transfer project links or local secrets.
const inventory = async (directory, prefix = '') => {
  const entries = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.local') || (!prefix && entry.name === 'vercel.json')) continue
    const relative = path.join(prefix, entry.name)
    if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) {
      throw new Error('The frontend build contains a symbolic link or unsupported file; packaging stopped.')
    }
    entries.push({ relative, directory: entry.isDirectory() })
    if (entry.isDirectory()) entries.push(...await inventory(path.join(directory, entry.name), relative))
  }
  return entries
}

export const packageShowcase = async ({ apiOrigin, outputDirectory = defaultOutput,
  distDirectory = path.join(frontendDirectory, 'dist'), productionConfigFile = path.join(frontendDirectory, 'vercel.json') } = {}) => {
  const config = showcaseConfig(JSON.parse(await fs.readFile(productionConfigFile, 'utf8')), apiOrigin)
  const source = path.resolve(distDirectory)
  const output = path.resolve(outputDirectory)
  if (!path.basename(output).endsWith('.local')) throw new Error('Use a NEW output folder ending in .local so Git ignores the showcase package.')
  const withinSource = path.relative(source, output)
  if (!withinSource || (!withinSource.startsWith(`..${path.sep}`) && withinSource !== '..' && !path.isAbsolute(withinSource))) {
    throw new Error('The showcase output folder must be outside the frontend dist directory.')
  }
  try {
    const [directory, index] = await Promise.all([fs.lstat(source), fs.lstat(path.join(source, 'index.html'))])
    if (!directory.isDirectory() || directory.isSymbolicLink() || !index.isFile() || index.isSymbolicLink()) throw new Error('invalid build')
  } catch { throw new Error('The frontend dist/index.html build is missing or invalid. Run npm run build in frontend first.') }
  const entries = await inventory(source)
  try { await fs.mkdir(output) } catch (error) {
    if (error.code === 'EEXIST') throw new Error('The output folder already exists. Choose a NEW .local folder; existing files are never deleted or overwritten.', { cause: error })
    throw new Error('Could not create the new output folder. Its parent directory must already exist.', { cause: error })
  }
  // If a copy fails, retain the partial folder for inspection. Never remove it automatically.
  for (const entry of entries) {
    const destination = path.join(output, entry.relative)
    if (entry.directory) await fs.mkdir(destination)
    else await fs.copyFile(path.join(source, entry.relative), destination, constants.COPYFILE_EXCL)
  }
  await fs.writeFile(path.join(output, 'vercel.json'), `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' })
  return { outputDirectory: output, apiOrigin: new URL(config.rewrites[0].destination).origin, files: entries.filter((entry) => !entry.directory).length }
}

export const parseArguments = (args) => {
  const options = {}
  for (let i = 0; i < args.length; i++) {
    if (!['--api-origin', '--output'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: node frontend/scripts/packageShowcase.js --api-origin https://YOUR-SHOWCASE-API.onrender.com [--output NEW-FOLDER.local]')
    }
    const key = args[i] === '--api-origin' ? 'apiOrigin' : 'outputDirectory'
    if (options[key]) throw new Error('Specify each showcase packaging option only once.')
    options[key] = args[++i]
  }
  return options
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  Promise.resolve().then(() => packageShowcase(parseArguments(process.argv.slice(2))))
    .then((result) => {
      console.log(`Showcase package created: ${result.outputDirectory}`)
      console.log(`Its /api proxy uses only: ${result.apiOrigin}`)
      console.log('Deploy this folder as a NEW Vercel project. The production configuration and project link were not changed.')
    })
    .catch((error) => { console.error(error.message); process.exitCode = 1 })
}
