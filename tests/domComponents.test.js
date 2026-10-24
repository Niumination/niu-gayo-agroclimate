/**
 * F-38 — uji DOM nyata (render ke string) untuk komponen kritis.
 *
 * Berbeda dari uji lain yang membaca teks sumber, uji ini menjalankan komponennya:
 * JSX diubah di memori memakai transformer milik Vite (tanpa menambah dependensi),
 * lalu dirender dengan `react-dom/server`, sehingga yang diperiksa adalah keluaran
 * (peran ARIA, label, angka, keadaan kosong) — bukan potongan kode.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'

register('./helpers/jsx-hooks.mjs', import.meta.url)

const tr = (kunci) =>
  ({
    appName: 'Niu Gayo',
    elevation: 'Ketinggian',
    mdpl: 'mdpl',
    airTemp: 'Suhu udara',
    min: 'Min',
    max: 'Maks',
    humidity: 'Kelembapan',
    rainNow: 'Hujan sekarang',
    rainProb: 'Peluang hujan',
    windSpeed: 'Angin',
  })[kunci] || kunci

test('DOM · EmptyState: judul, petunjuk, dan aksi tampil; nada waspada memakai garis waspada', async () => {
  const { default: EmptyState } = await import('../src/components/EmptyState.jsx')
  const html = render(
    h(EmptyState, {
      title: 'Data angin belum tersedia',
      hint: 'Coba muat ulang dalam satu menit.',
      action: h('button', { type: 'button' }, 'Muat ulang'),
      tone: 'waspada',
    }),
  )
  assert.match(html, /<p[^>]*>Data angin belum tersedia<\/p>/)
  assert.match(html, /<p[^>]*>Coba muat ulang dalam satu menit\.<\/p>/)
  assert.match(html, /<button type="button">Muat ulang<\/button>/)
  assert.match(html, /border-level-waspada\/40/, 'nada waspada dipakai')
  assert.doesNotMatch(html, /border-line-strong/, 'nada default tidak ikut terpasang')
})

test('DOM · EmptyState: tanpa aksi tidak merender tombol', async () => {
  const { default: EmptyState } = await import('../src/components/EmptyState.jsx')
  const html = render(h(EmptyState, { title: 'Kosong' }))
  assert.doesNotMatch(html, /<button/, 'tidak ada tombol bila aksi tidak diberikan')
  assert.match(html, /border-line-strong/, 'nada default dipakai saat tone tidak diberikan')
})

test('DOM · InstrumentPanel: satu pembacaan besar + empat metrik pendukung', async () => {
  const { default: InstrumentPanel } = await import('../src/components/InstrumentPanel.jsx')
  const current = { temp: 21.4, rh: 91, rain: 0.4, wind: 6.2 }
  const daily = { minTemp: 17.8, maxTemp: 26.1, rainProb: 64 }
  const html = render(h(InstrumentPanel, { current, daily, location: { name: 'Bebesan', elevation: 1210 }, tr }))

  assert.match(html, /data-niu-card="instrument"/, 'penanda kartu instrumen ada')
  assert.match(html, /aria-label="Niu Gayo"/, 'kartu punya nama aksesibel')
  assert.match(html, />21\.4</, 'suhu dominan dari data')
  assert.match(html, />26\.1°C</, 'maks harian dari data')
  assert.match(html, /Kelembapan/, 'label metrik kelembapan')
  assert.notEqual(
    html,
    render(h(InstrumentPanel, { current: { ...current, rh: 40 }, daily, location: { name: 'Bebesan', elevation: 1210 }, tr })),
    'kelembapan > 85 mengubah nada tampilan',
  )
  for (const angka of ['91', '0,4', '64', '6,2']) {
    assert.ok(html.includes(`>${angka}<`), `nilai metrik ${angka} tampil`)
  }
  assert.match(html, /grid-cols-2[^"]*sm:grid-cols-4/, 'metrik tetap empat kolom di layar lebar')
})

test('DOM · InstrumentPanel: tanpa data tidak merender apa pun', async () => {
  const { default: InstrumentPanel } = await import('../src/components/InstrumentPanel.jsx')
  assert.equal(render(h(InstrumentPanel, { current: null, daily: null, location: null, tr })), '')
})

test('DOM · MetricChip: nilai dan satuan tidak pernah tertukar', async () => {
  const { default: MetricChip } = await import('../src/components/MetricChip.jsx')
  const html = render(h(MetricChip, { label: 'Angin', value: 12.5, unit: 'km/jam', tone: 'warn' }))
  assert.match(html, />Angin</)
  assert.match(html, />12,5</, 'nilai dirapikan ke format id-ID')
  assert.match(html, />km\/jam</)
  assert.notEqual(
    html,
    render(h(MetricChip, { label: 'Angin', value: 12.5, unit: 'km/jam' })),
    'tone mengubah tampilan chip',
  )
})

// ── 2.3.4 — ClimateBanner: satu-satunya banner iklim yang dulu hanya diuji via regex ──
test('DOM · ClimateBanner: peran status, ringkasan terkurasi, dan tombol terlipat', async () => {
  const { default: ClimateBanner } = await import('../src/components/ClimateBanner.jsx')
  const html = render(h(ClimateBanner, { now: new Date('2026-10-24T00:00:00Z'), tr }))
  assert.match(html, /role="status"/, 'pembaca layar mengumumkan banner saat muncul')
  assert.match(html, /data-niu-banner="climate"/)
  assert.match(html, /<h[1-6][^>]*>|<span class="font-semibold">Perkiraan iklim musiman</)
  assert.match(html, /Kemarau dapat berlangsung lebih panjang/, 'ringkasan dari data terkurasi ikut dirender')
  assert.match(html, /rilis 2026-10-13/, 'tanggal rilis BMKG tampil, bukan tanggal hari ini')
  assert.match(html, /aria-expanded="false"/, 'rincian mulai terlipat')
  assert.doesNotMatch(html, /Angka dan istilah teknis/, 'rincian tidak membocor sebelum dibuka')
  assert.doesNotMatch(html, /undefined|\[object Object\]|NaN/, 'tidak ada nilai kosong yang bocor ke layar')
})

test('DOM · ClimateBanner: nada tinggi memakai garis cherry, bukan nada aman', async () => {
  const { default: ClimateBanner } = await import('../src/components/ClimateBanner.jsx')
  const html = render(h(ClimateBanner, { now: new Date('2026-10-24T00:00:00Z'), tr }))
  assert.match(html, /border-cherry\/30/, 'nada "tinggi" = garis waspada (cherry)')
  assert.doesNotMatch(html, /border-leaf\/30/)
})

test('DOM · ClimateBanner: melewati masa berlaku → judul & catatan berubah, bukan diam-diam basi', async () => {
  const { default: ClimateBanner } = await import('../src/components/ClimateBanner.jsx')
  const dalam = render(h(ClimateBanner, { now: new Date('2026-10-24T00:00:00Z'), tr }))
  const lewat = render(h(ClimateBanner, { now: new Date('2026-12-01T00:00:00Z'), tr }))
  assert.match(dalam, /Perkiraan iklim musiman/)
  assert.doesNotMatch(dalam, /perlu pembaruan/)
  assert.match(lewat, /Perkiraan iklim — perlu pembaruan/)
  assert.match(lewat, /Informasi prakiraan musim perlu diperbarui/)
  assert.match(lewat, /border-husk\/30/, 'nada turun ke "sedang" saat data kedaluwarsa')
  // Catatan "berlaku sampai …" hanya tampil setelah rincian dibuka; isinya dijaga
  // `tests/climate.test.js`, jadi di sini cukup judul + nada yang diverifikasi.
})
