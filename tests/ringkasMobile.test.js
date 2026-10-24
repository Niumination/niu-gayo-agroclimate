// Uji kontrak P7.4 — beranda mobile "Ringkas".
// Fokus: susunan baru memakai komponen P7.3, tidak menghapus kartu lama,
// tidak memunculkan istilah teknis di lapisan Ringkas, dan strip mobile
// mempertahankan gulir mendatar v4; desktop menambah scrubber interaktif v6.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const stripComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

const PAGE = read('src/pages/RingkasMobile.jsx')
const PAGE_CODE = stripComments(PAGE)
const TECHNICAL = stripComments(read('src/components/niu/InstrumentTechnicalDetail.jsx'))
const METRIC = stripComments(read('src/components/MetricChip.jsx'))
const THEME = read('src/styles/theme-directions.css')
const WEATHER = stripComments(read('src/services/weatherService.js'))
const STRIP = stripComments(read('src/components/niu/HourStrip.jsx'))
const ATTN = stripComments(read('src/components/niu/HazardAttention.jsx'))
const DETAIL = stripComments(read('src/components/niu/HazardDetail.jsx'))
const APP = stripComments(read('src/App.jsx'))

test('P7.4: RingkasMobile ada dan memakai ketiga komponen baru', () => {
  assert.match(PAGE, /StatusHeadline/)
  assert.match(PAGE, /HazardAttention/)
  assert.match(PAGE, /HourStrip/)
})

test('P7.4: catatan min/maks memakai istilah Indonesia dari messages', () => {
  assert.match(PAGE, /tr\('min'\)/)
  assert.match(PAGE, /tr\('max'\)/)
})

test('P7.4: instrumen mengikuti kepala prototipe dengan lokasi, konteks, dan arah suhu', () => {
  assert.match(PAGE, /tr\('nowAt'\)/)
  assert.match(PAGE, /subtitle=\{locationSubtitle\}/)
  assert.match(PAGE, /tr\('elevationLine'\)/)
  assert.match(PAGE, /tr\('humidContext'\)/)
  assert.match(PAGE, /tr\('weakWindContext'\)/)
  assert.match(PAGE, /kicker=\{tr\('airTemp'\)\}/)
})

test('P7.4: rincian teknis cuaca tetap ada di DOM dan terbuka lewat disclosure berlabel', () => {
  assert.match(PAGE, /aria-expanded=\{technicalOpen\}/)
  assert.match(PAGE, /aria-controls=\{technicalId\}/)
  assert.match(PAGE, /<InstrumentTechnicalDetail/)
  assert.match(TECHNICAL, /hidden=\{!open\}/)
  for (const row of ['Titik', 'Ketinggian model', 'Hembusan angin', 'Arah angin', 'Kode cuaca WMO', 'Kemiringan lahan']) {
    assert.ok(TECHNICAL.includes(row), `rincian ${row} hilang`)
  }
  assert.match(TECHNICAL, /Sumber: Open-Meteo ECMWF IFS/)
  assert.match(WEATHER, /windDirection: curr\.wind_direction_10m/)
  assert.match(WEATHER, /modelElevation: data\.elevation/)
  assert.match(APP, /modelElevation=\{data\.modelElevation\}/)
})

test('P7.4: empat metrik pendukung tetap ada (RH, hujan, peluang, angin)', () => {
  for (const key of ['humidity', 'rainNow', 'rainProb', 'windSpeed']) {
    assert.match(PAGE, new RegExp(`tr\\('${key}'\\)`), `metrik ${key} hilang`)
  }
})

test('P7.4: label metrik sempit dipadatkan tanpa kehilangan label aksesibel', () => {
  for (const key of ['humidityCompact', 'rainNowCompact', 'rainProbCompact', 'windSpeedCompact']) {
    assert.match(PAGE, new RegExp(`compactLabel=\\{tr\\('${key}'\\)\\}`), `label ringkas ${key} hilang`)
  }
  assert.match(METRIC, /niu-metric-label-full">\{label\}<\/span>/)
  assert.match(METRIC, /niu-metric-label-compact/)
  assert.match(METRIC, /aria-hidden="true"/)
  assert.match(METRIC, /flex-wrap/)
  assert.match(THEME, /@media \(max-width: 430px\)/)
  assert.match(THEME, /@container niu-status \(max-width: 430px\)/)
  assert.match(THEME, /container-type: inline-size/)
})

test('P7.4: lencana tingkat memakai label resmi, bukan teks bebas', () => {
  assert.match(PAGE, /LEVEL_LABEL\[worst\]/)
})

test('P7.4: "Perlu perhatian" dibatasi tiga kartu dan bisa menuju Risiko', () => {
  assert.match(PAGE, /limit=\{3\}/)
  assert.match(PAGE, /onOpenRisk/)
})

test('P7.4: Ringkas tidak memuat istilah teknis model', () => {
  const banned = ['ECMWF', 'IFS', 'Open-Meteo', 'CAPE', 'ensemble', 'API', 'm³/s', 'Lifted Index']
  for (const word of banned) {
    assert.ok(!PAGE_CODE.includes(word), `istilah "${word}" muncul di Ringkas`)
  }
})

test('P7.4: App memakai RingkasMobile di tab Kini (mobile)', () => {
  assert.match(APP, /<RingkasMobile/)
  assert.ok(APP.indexOf('<RingkasMobile') < APP.indexOf('const mobileForecast'))
})

test('P7.4: kartu lama tidak dihapus dari tab Kini', () => {
  for (const comp of ['AirQualityCard', 'CoffeeAdvisory', 'SeasonalBanner', 'ClimateBanner', 'ReportButton']) {
    assert.ok(APP.includes(`<${comp}`), `${comp} hilang dari App`)
  }
})

test('P7.4: RingkasMobile tetap kepala status mobile; desktop punya ringkasan sendiri', () => {
  // F-32 — kepala status desktop kini `.lm-summary` milik Peta Hidup, bukan RingkasMobile kembar.
  assert.equal(APP.split('<RingkasMobile').length, 2, 'RingkasMobile hanya untuk jalur mobile')
  assert.match(read('src/pages/LivingMapDesktop.jsx'), /className="lm-summary"/, 'ringkasan desktop hilang')
  assert.ok(fs.existsSync(path.join(ROOT, 'src/components/InstrumentPanel.jsx')))
})

test('P7.4: strip mobile mengikuti v4, satu baris horizontal dengan scroll-snap dan minimum 56 px', () => {
  assert.match(STRIP, /niu-hour-list-mobile/)
  assert.match(read('src/styles/theme-directions.css'), /grid-auto-flow: column/)
  assert.match(read('src/styles/theme-directions.css'), /grid-auto-columns: minmax\(56px, 1fr\)/)
  assert.match(read('src/styles/theme-directions.css'), /overflow-x: auto/)
  assert.match(read('src/styles/theme-directions.css'), /scroll-snap-type: x proximity/)
})

test('P7.4: strip menampilkan jam data yang sebenarnya (bukan mengganti jam pertama dengan "Kini")', () => {
  assert.match(STRIP, /timeLabel\(hour\.time\)/)
  assert.match(STRIP, /const timeLabel =/)
  assert.doesNotMatch(STRIP, /now \? 'Kini'/)
})

test('P7.4: batang hujan dekoratif dan nilai hujan tetap tampil/terbaca', () => {
  assert.match(STRIP, /niu-hour-rainbar/)
  assert.match(STRIP, /aria-hidden="true"/)
  assert.match(STRIP, /r1\(hour\.rain\)/)
  // Audit F-07b: aria-label diganti teks tersembunyi agar nama aksesibel memuat teks
  // angka yang terlihat (axe label-content-name-mismatch). Cabang non-interaktif (mobile)
  // tetap memakai <li> tanpa atribut tambahan.
  assert.match(STRIP, /<span className="sr-only"> — suhu \{r1\(hour\.temp\)\} derajat, hujan \{r1\(hour\.rain\)\} mm\/jam<\/span>/)
  assert.doesNotMatch(STRIP, /aria-label=\{hourText\(hour\)\}/, 'aria-label lama tidak boleh kembali')
})

test('P7.6: desktop menyediakan tombol jam, panah, scrubber, pembacaan hidup, solar dan hembusan', () => {
  assert.match(STRIP, /interactive = false/)
  assert.match(STRIP, /role="group" aria-label="Prakiraan 12 jam"/)
  assert.match(STRIP, /aria-pressed=\{index === selectedIndex\}/)
  assert.match(STRIP, /type="range"/)
  assert.match(STRIP, /aria-live="polite"/)
  assert.match(STRIP, /selected\.solar/)
  assert.match(STRIP, /selected\.gusts/)
  assert.match(STRIP, /ArrowRight/)
  assert.match(STRIP, /ArrowLeft/)
})

test('P7.4: HourStrip aman saat data kosong', () => {
  assert.match(STRIP, /hours\.length === 0\) return null/)
})

test('P7.4: daftar perhatian menyaring level waspada ke atas', () => {
  assert.match(ATTN, /LEVEL_ORDER\[r\.level\] >= LEVEL_ORDER\.waspada/)
})

test('P7.4: hanya satu rincian terbuka pada satu waktu (akordeon)', () => {
  assert.match(ATTN, /setOpenId\(open \? null : r\.id\)/)
})

test('P7.4: rincian memakai DetailPanel bare dengan tiga tab', () => {
  assert.match(ATTN, /<DetailPanel/)
  assert.match(ATTN, /bare/)
  assert.match(ATTN, /HAZARD_TABS/)
  assert.match(ATTN, /panels=\{hazardPanels\(r\)\}/)
  assert.match(DETAIL, /label: 'Ringkas'/)
  assert.match(DETAIL, /label: 'Angka'/)
  assert.match(DETAIL, /label: 'Saran'/)
})

test('P7.4: tiap tab berisi hal berbeda (bukan isi sama)', () => {
  assert.match(DETAIL, /ringkas: \(/)
  assert.match(DETAIL, /angka: \(/)
  assert.match(DETAIL, /saran: \(/)
  assert.match(DETAIL, /return \{/)
})

test('P7.4: angka memakai definisi istilah (dl/dt/dd), bukan div tanpa makna', () => {
  assert.match(DETAIL, /<dl/)
  assert.match(DETAIL, /<dt/)
  assert.match(DETAIL, /<dd/)
})

test('P7.4: sumber data disebut di tab Angka', () => {
  assert.match(DETAIL, /Sumber: \{r\.sources/)
})

test('P7.4: keadaan tanpa bahaya aktif punya kalimat menenangkan', () => {
  assert.match(ATTN, /emptyText/)
  assert.match(ATTN, /Tidak ada bahaya aktif/)
})

test('P7.4: tombol "Lihat semua" memenuhi target 44 px', () => {
  assert.match(ATTN, /min-h-11/)
})

test('P7.4: tidak ada pemotongan teks di beranda baru', () => {
  for (const [name, text] of [
    ['RingkasMobile', PAGE_CODE],
    ['HourStrip', STRIP],
    ['HazardAttention', ATTN],
  ]) {
    assert.ok(!/\btruncate\b/.test(text), `${name} memakai truncate`)
  }
})
