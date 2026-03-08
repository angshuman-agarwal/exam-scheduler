import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const versionJsonPath = resolve(__dirname, '../public/version.json')

const version = pkg.version
console.log(`version: ${version} (from package.json)`)

let minimumSupportedVersion
let minSource

if (process.env.MINIMUM_SUPPORTED_VERSION) {
  minimumSupportedVersion = process.env.MINIMUM_SUPPORTED_VERSION
  minSource = 'env MINIMUM_SUPPORTED_VERSION'
} else {
  try {
    const existing = JSON.parse(readFileSync(versionJsonPath, 'utf-8'))
    if (existing.minimumSupportedVersion) {
      minimumSupportedVersion = existing.minimumSupportedVersion
      minSource = 'existing version.json'
    }
  } catch {
    // file doesn't exist or invalid JSON — first-ever generation
  }
  if (!minimumSupportedVersion) {
    minimumSupportedVersion = version
    minSource = 'package.json (first generation)'
  }
}

console.log(`minimumSupportedVersion: ${minimumSupportedVersion} (from ${minSource})`)

writeFileSync(
  versionJsonPath,
  JSON.stringify({ version, minimumSupportedVersion }, null, 2) + '\n',
)
