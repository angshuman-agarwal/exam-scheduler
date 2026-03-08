import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))

const version = pkg.version
const minimumSupportedVersion = process.env.MINIMUM_SUPPORTED_VERSION || version

writeFileSync(
  resolve(__dirname, '../public/version.json'),
  JSON.stringify({ version, minimumSupportedVersion }, null, 2) + '\n',
)

console.log(`version.json: version=${version}, minimumSupportedVersion=${minimumSupportedVersion}`)
