import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const versionJsonPath = resolve(__dirname, '../public/version.json')

let appVersionConfig = {}
try {
  appVersionConfig = JSON.parse(readFileSync(resolve(__dirname, '../config/app-version.json'), 'utf-8'))
} catch {
  // config/app-version.json missing or invalid — fall through to defaults
}

const version = pkg.version
console.log(`version: ${version} (from package.json)`)

let minimumSupportedVersion
let minSource

if (process.env.MINIMUM_SUPPORTED_VERSION) {
  minimumSupportedVersion = process.env.MINIMUM_SUPPORTED_VERSION
  minSource = 'env MINIMUM_SUPPORTED_VERSION'
} else if (appVersionConfig.minimumSupportedVersion) {
  minimumSupportedVersion = appVersionConfig.minimumSupportedVersion
  minSource = 'config/app-version.json'
} else {
  minimumSupportedVersion = version
  minSource = 'package.json (fallback)'
}

console.log(`minimumSupportedVersion: ${minimumSupportedVersion} (from ${minSource})`)

writeFileSync(
  versionJsonPath,
  JSON.stringify({ version, minimumSupportedVersion }, null, 2) + '\n',
)
