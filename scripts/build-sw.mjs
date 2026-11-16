/**
 * Writes dist/sw.js with the precache list of the build that just happened.
 *
 * Vite gives assets hashed names, so the list cannot be static: this walks the
 * output, injects the file names and a build id into the template, and reports
 * what will be available offline.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const TEMPLATE = join(ROOT, 'scripts', 'sw-template.js')

/** Source maps are for debugging, not for the offline bundle. */
const EXCLUDED = /\.map$/

function walk(directory) {
  const entries = []
  for (const name of readdirSync(directory)) {
    const full = join(directory, name)
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full))
    } else {
      entries.push(full)
    }
  }
  return entries
}

const files = walk(DIST)
  .filter((file) => !EXCLUDED.test(file))
  .map((file) => `/${relative(DIST, file).split(sep).join('/')}`)
  .filter((url) => url !== '/sw.js')
  .sort()

if (!files.includes('/index.html')) {
  throw new Error('dist/index.html is missing — run the build first.')
}

const totalBytes = files.reduce(
  (total, url) => total + statSync(join(DIST, url.slice(1))).size,
  0,
)

// The id changes whenever any file name changes, which is what retires the old cache.
const buildId = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)

// replaceAll, not replace: a single-occurrence replace silently substitutes only
// the first match, which is how a placeholder ends up living on in the code.
const output = readFileSync(TEMPLATE, 'utf8')
  .replaceAll('__BUILD_ID__', buildId)
  .replaceAll('__PRECACHE__', JSON.stringify(files, null, 2))

const leftover = output.match(/__[A-Z_]+__/)
if (leftover) {
  throw new Error(`Placeholder ${leftover[0]} was not substituted in the service worker.`)
}

writeFileSync(join(DIST, 'sw.js'), output)

console.log(
  `sw.js — ${files.length} fichiers précachés, ${(totalBytes / 1024 / 1024).toFixed(2)} Mo (build ${buildId})`,
)
