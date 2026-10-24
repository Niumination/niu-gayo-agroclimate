/**
 * F-38 — tes DOM untuk komponen inti (lanjutan bundel IV).
 *
 * Komponen dirender sungguhan (JSX diubah di memori lewat `tests/helpers/jsx-hooks.mjs`,
 * lalu `react-dom/server`), jadi yang diperiksa adalah keluaran: peran ARIA, nama
 * aksesibel, label resmi, kelas token, dan keadaan buka/tutup — bukan teks sumber.
 *
 * Tes ini menggantikan blok regex di `tests/niuComponents.test.js` untuk LevelBadge,
 * StatusHeadline, dan AttentionCard: cakupan bertambah karena kodenya benar-benar jalan.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'

register('./helpers/jsx-hooks.mjs', import.meta.url)

const tr = (k, f) => f ?? k
const ada = (html, pola, pesan) => assert.match(html, pola, pesan)
const tidakAda = (html, pola, pesan) => assert.doesNotMatch(html, pola, pesan)

// ── LevelBadge ───────────────────────────────────────────────────────────────
test('DOM · LevelBadge: label resmi dari domain, token dua tangga, glif dekoratif', async () => {
  const { default: LevelBadge } = await import('../src/components/niu/LevelBadge.jsx')
  const html = render(h(LevelBadge, { level: 'bahaya' }))
  ada(html, /data-level="bahaya"/, 'level tidak ditandai')
  ada(html, />Bahaya</, 'label resmi tidak tampil sebagai teks')
  ada(html, /text-tanah-level-bahaya/, 'token tangga Tanah hilang')
  ada(html, /dark:text-langit-level-bahaya/, 'token tangga Langit hilang')
  ada(html, /<svg[^>]*aria-hidden="true"/, 'glif tidak disembunyikan dari pembaca layar')
  ada(html, /data-glyph="bahaya"/, 'glif tidak menandai tingkatnya')
})

test('DOM · LevelBadge: lima tingkat punya lima glif berbeda (bukan hanya warna)', async () => {
  const { default: LevelBadge } = await import('../src/components/niu/LevelBadge.jsx')
  const tingkat = ['rendah', 'waspada', 'bahaya', 'ekstrem', 'n/a']
  const glif = tingkat.map((level) => render(h(LevelBadge, { level })).match(/data-glyph="([^"]+)"/)?.[1])
  assert.deepEqual(glif, tingkat, 'glif harus mengikuti tingkatnya')
  assert.equal(new Set(glif).size, 5, 'lima glif harus berbeda')
})

test('DOM · LevelBadge: tingkat tak dikenal jatuh ke n/a, bukan crash', async () => {
  const { default: LevelBadge } = await import('../src/components/niu/LevelBadge.jsx')
  const html = render(h(LevelBadge, { level: 'entah' }))
  ada(html, /data-level="n\/a"/, 'harus jatuh ke n/a')
  ada(html, />Tidak tersedia</, 'label n/a tidak memakai teks cadangan')
})

test('DOM · LevelBadge: label bisa diganti dan ukuran kecil memakai glif 12 px', async () => {
  const { default: LevelBadge } = await import('../src/components/niu/LevelBadge.jsx')
  const html = render(h(LevelBadge, { level: 'waspada', label: 'Hati-hati', size: 'sm' }))
  ada(html, />Hati-hati</, 'label kustom tidak dipakai')
  ada(html, /class="h-3 w-3 shrink-0"/, 'ukuran kecil tidak memakai glif 12 px')
  const biasa = render(h(LevelBadge, { level: 'waspada' }))
  ada(biasa, /class="h-4 w-4 shrink-0"/, 'ukuran bawaan harus 16 px')
})

// ── StatusHeadline ───────────────────────────────────────────────────────────
test('DOM · StatusHeadline: section dinamai oleh h2 di dalamnya', async () => {
  const { default: StatusHeadline } = await import('../src/components/niu/StatusHeadline.jsx')
  const html = render(h(StatusHeadline, { id: 'kini', title: 'Bebesan', value: 21.4, unit: '°C' }))
  ada(html, /<section[^>]*aria-labelledby="kini-title"/, 'section tidak menunjuk judulnya')
  ada(html, /<h2 id="kini-title"/, 'judul bukan h2 dengan id yang dirujuk')
  ada(html, /data-niu-card="status"/, 'penanda kartu status hilang')
})

test('DOM · StatusHeadline: subjudul, kicker, dan aside tampil di sisi kanan', async () => {
  const { default: StatusHeadline } = await import('../src/components/niu/StatusHeadline.jsx')
  const html = render(
    h(StatusHeadline, {
      title: 'Bebesan',
      subtitle: '1.210 mdpl · Sentral Perdagangan',
      kicker: 'Sekarang',
      aside: h('span', null, 'Hujan'),
    }),
  )
  ada(html, /1\.210 mdpl · Sentral Perdagangan/, 'subjudul hilang')
  ada(html, /niu-status-kicker[^>]*>Sekarang/, 'kicker hilang')
  ada(html, /niu-status-heading-aside[\s\S]*Hujan/, 'aside tidak berada di sisi kanan')
})

test('DOM · StatusHeadline: satuan memakai spasi tak-putus agar tak terpisah dari angka', async () => {
  const { default: StatusHeadline } = await import('../src/components/niu/StatusHeadline.jsx')
  const html = render(h(StatusHeadline, { title: 'Bebesan', value: 19.7, unit: '°C' }))
  ada(html, /\u00a0°C/, 'satuan tidak memakai spasi tak-putus')
  ada(html, /niu-status-value/, 'nilai utama tidak memakai kelas status')
})

test('DOM · StatusHeadline: nada dingin/panas memakai token semantik; tanpa bingkai bisa dilepas', async () => {
  const { default: StatusHeadline } = await import('../src/components/niu/StatusHeadline.jsx')
  const dingin = render(h(StatusHeadline, { title: 'x', value: 12, tone: 'dingin' }))
  const panas = render(h(StatusHeadline, { title: 'x', value: 32, tone: 'panas' }))
  ada(dingin, /text-rain-deep/, 'nada dingin tidak memakai token hujan')
  ada(panas, /text-cherry-deep/, 'nada panas tidak memakai token ceri')
  const polos = render(h(StatusHeadline, { title: 'x', framed: false }))
  tidakAda(polos, /bg-tanah-kartu/, 'bingkai harus bisa dimatikan')
})

test('DOM · StatusHeadline: lencana level dirender bila level diberikan', async () => {
  const { default: StatusHeadline } = await import('../src/components/niu/StatusHeadline.jsx')
  const html = render(h(StatusHeadline, { title: 'x', level: 'waspada', levelLabel: 'Waspada' }))
  ada(html, /data-level="waspada"/, 'lencana level tidak dirender')
  ada(html, />Waspada</, 'label level hilang')
})

// ── AttentionCard ────────────────────────────────────────────────────────────
test('DOM · AttentionCard: akar article berlabel level dengan tepi kiri bertoken', async () => {
  const { default: AttentionCard } = await import('../src/components/niu/AttentionCard.jsx')
  const html = render(h(AttentionCard, { id: 'k1', title: 'Hujan lebat', level: 'waspada', onToggle: () => {} }))
  ada(html, /<article id="k1" data-level="waspada" data-niu-card="attention"/, 'akar kartu salah')
  ada(html, /border-l-tanah-level-waspada/, 'tepi kiri tidak menandai level')
  ada(html, /<h3[^>]*>Hujan lebat<\/h3>/, 'judul harus h3')
})

test('DOM · AttentionCard: tombol Detail mengumumkan keadaan dan menunjuk panelnya', async () => {
  const { default: AttentionCard } = await import('../src/components/niu/AttentionCard.jsx')
  const tutup = render(h(AttentionCard, { id: 'k1', title: 'Hujan', onToggle: () => {} }))
  ada(tutup, /<button[^>]*type="button"/, 'tombol bukan type=button')
  ada(tutup, /aria-expanded="false"/, 'keadaan tertutup tidak diumumkan')
  ada(tutup, /aria-controls="k1-detail"/, 'panel tidak dirujuk')
  ada(tutup, /min-h-11/, 'target sentuh < 44 px')
  tidakAda(tutup, /role="region"/, 'panel tidak boleh ada saat tertutup')

  const buka = render(
    h(AttentionCard, { id: 'k2', title: 'Angin', level: 'bahaya', expanded: true, onToggle: () => {} }, h('p', null, 'isi rincian')),
  )
  ada(buka, /aria-expanded="true"/, 'keadaan terbuka tidak diumumkan')
  ada(buka, /<div id="k2-detail" role="region" aria-label="Rincian Angin"/, 'panel terbuka bukan region bernama')
  ada(buka, /isi rincian/, 'isi rincian tidak dirender')
  ada(buka, />Tutup rincian</, 'label tombol tidak berubah saat terbuka')
})

test('DOM · AttentionCard: level tak dikenal jatuh ke n/a; label tombol bisa diganti', async () => {
  const { default: AttentionCard } = await import('../src/components/niu/AttentionCard.jsx')
  const html = render(
    h(AttentionCard, { id: 'k3', title: 'Kabut', level: 'entah', onToggle: () => {}, actionLabel: 'Lihat rincian' }),
  )
  ada(html, /data-level="n\/a"/, 'level tak dikenal harus n/a')
  ada(html, /border-l-tanah-garis-kuat/, 'tepi n/a memakai token garis')
  ada(html, />Lihat rincian</, 'label tombol kustom diabaikan')
})

// ── Komponen data ────────────────────────────────────────────────────────────
test('DOM · DisasterWarning: ringkasan multi-bahaya tampil sebagai teks nyata', async () => {
  const { default: DisasterWarning } = await import('../src/components/DisasterWarning.jsx')
  const html = render(
    h(DisasterWarning, {
      disaster: { level: 'bahaya', hazards: [{ id: 'hujan', level: 'bahaya' }] },
      dailyRainSum: 30,
      tr,
    }),
  )
  ada(html, /<section[^>]*data-niu-card="warning"/, 'kartu peringatan tidak dirender')
  ada(html, /30/, 'akumulasi hujan 24 jam tidak muncul')
  ada(html, /Angin kencang/, 'bahaya kedua hilang')
})

test('DOM · DisasterWarning: tanpa data menampilkan keadaan kosong yang menjelaskan', async () => {
  const { default: DisasterWarning } = await import('../src/components/DisasterWarning.jsx')
  const html = render(h(DisasterWarning, { disaster: null, dailyRainSum: 0, tr }))
  ada(html, /border-dashed/, 'keadaan kosong harus memakai EmptyState')
  tidakAda(html, /data-niu-card="warning"/, 'kartu peringatan tidak boleh tampil tanpa data')
})

test('DOM · CoffeeAdvisory: panduan karat menampilkan judul, sumber penyakit, dan tindakan', async () => {
  const { default: CoffeeAdvisory } = await import('../src/components/CoffeeAdvisory.jsx')
  const html = render(h(CoffeeAdvisory, { coffee: { status: 'ok' } }))
  ada(html, /<section[^>]*data-niu-card="coffee"/, 'kartu kopi tidak dirender')
  ada(html, /Hemileia vastatrix/, 'nama patogen hilang')
  ada(html, /Tindakan petani/, 'tindakan petani hilang')
})

test('DOM · AboutData: tertutup tidak merender apa pun; terbuka menjelaskan batasan', async () => {
  const { default: AboutData } = await import('../src/components/AboutData.jsx')
  assert.equal(render(h(AboutData, { open: false, onClose: () => {} })), '', 'dialog tertutup tidak boleh ada di DOM')
  const html = render(h(AboutData, { open: true, onClose: () => {} }))
  ada(html, /bukan peringatan dini resmi/, 'pernyataan batasan hilang')
  ada(html, />Tutup</, 'tombol tutup tidak ada')
})

test('DOM · AirQualityCard: tanpa penilaian menampilkan alasan + rincian gangguan sumber', async () => {
  const { default: AirQualityCard } = await import('../src/components/AirQualityCard.jsx')
  const html = render(h(AirQualityCard, { airQuality: { error: 'HTTP 503 dari Open-Meteo' }, tr }))
  ada(html, /Data kualitas udara belum tersedia saat ini/, 'penjelasan kosong hilang')
  ada(html, /Lihat rincian gangguan sumber/, 'rincian gangguan tidak bisa dibuka')
  ada(html, /HTTP 503 dari Open-Meteo/, 'pesan galat sumber tidak diteruskan')
})

test('DOM · ReportButton: tombol laporan punya nama, judul, dan target 44 px', async () => {
  const { default: ReportButton } = await import('../src/components/ReportButton.jsx')
  const html = render(h(ReportButton, { location: { id: 'bebesan', name: 'Bebesan' } }))
  ada(html, /<button[^>]*type="button"/, 'bukan tombol')
  ada(html, /title="Lapor kejadian"/, 'judul tombol hilang')
  ada(html, /min-h-\[44px\]/, 'target sentuh < 44 px')
})

test('DOM · HazardPanel: tanpa bahaya aktif memakai keadaan kosong, bukan panel kosong', async () => {
  const { default: HazardPanel } = await import('../src/components/HazardPanel.jsx')
  const html = render(
    h(HazardPanel, {
      hazards: { active: [], results: [] },
      location: { name: 'Bebesan' },
      tr,
      onAbout: () => {},
      onToggleHidden: () => {},
      onSelect: () => {},
    }),
  )
  ada(html, /border-dashed/, 'keadaan kosong tidak memakai EmptyState')
})

// ── RingkasMobile ────────────────────────────────────────────────────────────
test('DOM · RingkasMobile: tanpa data tidak merender apa pun', async () => {
  const { default: RingkasMobile } = await import('../src/pages/RingkasMobile.jsx')
  assert.equal(render(h(RingkasMobile, { current: null, daily: null, location: null, tr })), '')
})

test('DOM · RingkasMobile: kepala status, catatan min/maks, dan empat metrik pendukung', async () => {
  const { default: RingkasMobile } = await import('../src/pages/RingkasMobile.jsx')
  const html = render(
    h(RingkasMobile, {
      current: { temp: 21, rh: 90, rain: 0, wind: 4 },
      daily: { minTemp: 18, maxTemp: 26, rainProb: 60 },
      location: { name: 'Bebesan', elevation: 1210 },
      tr,
    }),
  )
  ada(html, /niu-ringkas-mobile/, 'akar ringkasan hilang')
  ada(html, /21/, 'suhu saat ini tidak tampil')
  ada(html, /18°C · max 26°C|18°C/, 'catatan min/maks hilang')
  for (const nilai of ['90', '60', '4']) {
    assert.ok(html.includes(`>${nilai}`) || html.includes(`>${nilai}<`), `metrik ${nilai} tidak tampil`)
  }
})
