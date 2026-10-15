import test from 'node:test'
import assert from 'node:assert/strict'
import { whatsappText, smsText, waShareUrl, smsShareUrl } from '../src/domain/share.js'

const hz = (() => {
  const results = [
    { id: 'angin', level: 'ekstrem', headline: 'Hembusan 65 km/jam', advice: { umum: ['Jauhi pohon besar & baliho.'] }, evaluatedAt: '2026-10-15T10:00:00Z' },
    { id: 'longsor', level: 'bahaya', headline: 'Skor longsor 72/100 — Bahaya' },
    { id: 'asap', level: 'waspada', headline: 'ISPU 120 — Tidak Sehat' },
    { id: 'karat', level: 'rendah', headline: 'Skor 10/100' },
    { id: 'banjir', level: 'n/a', headline: 'Bukan sentra hulu' },
  ]
  return { results, active: results.slice(0, 3), worst: 'ekstrem', counts: { total: 5, active: 3, degraded: 1 } }
})()

test('whatsappText: judul sentra, bahaya aktif + saran pertama, disclaimer & tautan', () => {
  const t = whatsappText(hz, { name: 'Bintang' }, { url: 'https://contoh/agroclimate/' })
  assert.match(t, /^\*Niu Gayo Agro-Climate — Bintang\*/)
  assert.match(t, /Angin: \*Ekstrem\* — Hembusan 65 km\/jam/)
  assert.match(t, /↳ Jauhi pohon besar/)
  assert.match(t, /Asap\/ISPU: \*Waspada\*/)
  assert.match(t, /Rendah: Karat daun/)
  assert.doesNotMatch(t, /Banjir DAS/) // n/a tidak ditampilkan
  assert.match(t, /bukan peringatan resmi/)
  assert.ok(t.trim().endsWith('https://contoh/agroclimate/'))
})

test('whatsappText: tanpa bahaya aktif', () => {
  const t = whatsappText({ results: [{ id: 'karat', level: 'rendah' }], active: [] }, { name: 'Linge' })
  assert.match(t, /Tidak ada bahaya aktif/)
})

test('smsText: ≤ 160 karakter, level tertinggi dulu, disclaimer & 112 selalu ada', () => {
  const s = smsText(hz, { name: 'Jagong Jeget' }, { now: '2026-10-15T10:00:00Z' })
  assert.ok(s.length <= 160, `${s.length}: ${s}`)
  assert.match(s, /^NGA JagongJeget 17:00: Angin EKSTREM; Longsor BAHAYA; Asap\/ISPU WASPADA\./)
  assert.match(s, /Darurat 112$/)
  const quiet = smsText({ results: [], active: [] }, { name: 'Bies' }, { now: '2026-10-15T01:00:00Z' })
  assert.match(quiet, /^NGA Bies 08:00: tdk ada bahaya aktif\./)
  assert.ok(quiet.length <= 160)
})

test('smsText: banyak bahaya aktif tetap ≤ 160 (dipotong per item, bukan di tengah kata)', () => {
  const many = { results: [], active: ['angin', 'longsor', 'asap', 'kebakaran', 'kekeringan', 'karat', 'banjir'].map((id) => ({ id, level: 'bahaya', headline: 'x' })) }
  const s = smsText(many, { name: 'Silih Nara' }, { now: '2026-10-15T10:00:00Z' })
  assert.ok(s.length <= 160, `${s.length}`)
  assert.match(s, /\. Info model,bkn resmi\. Darurat 112$/)
  assert.doesNotMatch(s, /;\s*\./)
})

test('share URL encode teks', () => {
  assert.match(waShareUrl('a b&c'), /^https:\/\/wa\.me\/\?text=a%20b%26c$/)
  assert.match(smsShareUrl('x y'), /^sms:\?body=x%20y$/)
})
