/**
 * Hook pemuat untuk uji DOM/SSR: mengubah `.jsx` memakai esbuild milik Vite
 * (tanpa menambah dependensi) dan mengosongkan impor CSS.
 */
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

export async function load(url, context, nextLoad) {
  if (url.endsWith('.jsx')) {
    const sumber = await readFile(new URL(url), 'utf8')
    const { code } = await transformWithOxc(sumber, url, { lang: 'jsx' })
    return { format: 'module', source: code, shortCircuit: true }
  }
  if (url.endsWith('.css')) {
    return { format: 'module', source: 'export default {}', shortCircuit: true }
  }
  // Impor JSON tanpa atribut (`import data from './x.json'`) dipakai beberapa komponen.
  // Node 20 menolaknya; hook ini mengubahnya jadi modul ESM biasa supaya komponen
  // benar-benar bisa dirender di uji (bukan dilewati).
  if (url.endsWith('.json')) {
    const isi = await readFile(new URL(url), 'utf8')
    return { format: 'module', source: `export default ${isi.trim()}`, shortCircuit: true }
  }
  return nextLoad(url, context)
}

/** Impor tanpa ekstensi (`./MetricChip`) diarahkan ke berkas .jsx lalu .js. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (galat) {
    if (!specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw galat
    for (const ext of ['.jsx', '.js']) {
      try {
        return await nextResolve(specifier + ext, context)
      } catch {
        /* coba ekstensi berikutnya */
      }
    }
    throw galat
  }
}
