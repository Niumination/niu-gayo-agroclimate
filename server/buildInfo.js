import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}
const git = (args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null }
}
const pkg = readJson(path.join(root, 'package.json')) || {}
const frontend = readJson(path.join(root, 'dist', 'build-info.json'))
const revision = process.env.NIU_BUILD_REVISION || git(['rev-parse', 'HEAD']) || frontend?.revision || 'unknown'
const dirty = git(['status', '--porcelain'])

export const BUILD_INFO = Object.freeze({
  version: pkg.version || null,
  revision,
  dirty: dirty == null ? null : dirty.length > 0,
  frontendRevision: frontend?.revision || null,
  frontendVersion: frontend?.version || null,
  frontendBuiltAt: frontend?.builtAt || null,
})
