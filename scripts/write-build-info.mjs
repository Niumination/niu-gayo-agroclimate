#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const git = (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}
const revision = process.env.NIU_BUILD_REVISION || git(['rev-parse', 'HEAD']) || 'unknown'
const status = git(['status', '--porcelain'])
const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((src) => src.startsWith('/assets/'))
const styles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((href) => href.startsWith('/assets/'))

const info = {
  app: 'Niu',
  version: pkg.version,
  revision,
  dirty: status == null ? null : status.length > 0,
  builtAt: new Date().toISOString(),
  assets: { scripts, styles },
}
writeFileSync(path.join(dist, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
console.log(`[build-info] ${info.version} · ${info.revision} · ${info.dirty === false ? 'clean' : info.dirty === true ? 'working tree kotor' : 'Git tidak tersedia'}`)
