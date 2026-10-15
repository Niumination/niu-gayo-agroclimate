import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import kecamatan from '../src/data/geo/kecamatan.json' with { type: 'json' }
import healthAdvice from '../src/data/hazards/healthAdvice.json' with { type: 'json' }
import climateOutlook from '../src/data/hazards/climateOutlook.json' with { type: 'json' }
import additions from '../src/data/hazards/disasterHistory.additions.json' with { type: 'json' }
import sentraKecamatan from '../src/data/hazards/sentraKecamatan.json' with { type: 'json' }
import { LOCATIONS } from '../src/data/locations.js'
import { contactsFor, EMERGENCY_CONTACTS } from '../src/data/hazards/contacts.hazards.js'

// Aset data multi-bahaya yang disiapkan sebelum implementasi (docs/dev/09-DATA-PREP.md)

test('kecamatan.json: 22 fitur (14 kec. Aceh Tengah + danau + 7 kec. Bener Meriah), koordinat lon/lat valid, ≤ 50 kB', () => {
  assert.equal(kecamatan.type, 'FeatureCollection')
  assert.equal(kecamatan.features.length, 22)
  const at = kecamatan.features.filter((f) => f.properties.kab === 'Aceh Tengah' && f.properties.kind === 'kecamatan')
  assert.equal(at.length, 14)
  assert.equal(kecamatan.features.filter((f) => f.properties.kind === 'lake').length, 1)
  for (const f of kecamatan.features) {
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat()
    for (const ring of rings) for (const [lon, lat] of ring) {
      assert.ok(lon > 96 && lon < 97.6 && lat > 4 && lat < 5.2, `koordinat di luar Gayo: ${lon},${lat} (${f.properties.id})`)
    }
  }
  const bytes = readFileSync(new URL('../src/data/geo/kecamatan.json', import.meta.url)).length
  assert.ok(bytes <= 50 * 1024, `kecamatan.json ${bytes} B > 50 kB`)
})

test('sentraKecamatan.json: semua sentra terpetakan ke id kecamatan yang ada', () => {
  const kecIds = new Set(kecamatan.features.map((f) => f.properties.id))
  for (const loc of LOCATIONS) {
    const row = sentraKecamatan.sentra[loc.id]
    assert.ok(row, `sentra ${loc.id} belum dipetakan`)
    assert.ok(kecIds.has(row.kecamatan), `kecamatan ${row.kecamatan} tidak ada di GeoJSON`)
  }
})

test('healthAdvice.json: 5 kategori ISPU berurutan & tiap kategori punya 4 kelompok anjuran (id)', () => {
  const cats = healthAdvice.categories
  assert.deepEqual(cats.map((c) => c.key), ['baik', 'sedang', 'tidak_sehat', 'sangat_tidak_sehat', 'berbahaya'])
  assert.deepEqual(cats.map((c) => c.min), [0, 51, 101, 201, 301])
  for (const c of cats) for (const g of ['umum', 'rentan', 'kebun', 'sekolah']) {
    assert.ok(c.advice[g]?.id?.length > 5, `${c.key}.${g}`)
  }
  assert.ok(cats[2].policy && cats[3].policy && cats[4].policy, 'kebijakan sekolah ≥ 101 wajib ada')
  assert.ok(healthAdvice.cleanRoomChecklist.items.length >= 5)
})

test('climateOutlook.json: field inti & tanggal valid', () => {
  const c = climateOutlook.current
  assert.ok(['El Niño', 'La Niña', 'Netral'].includes(c.enso.phase))
  assert.ok(!Number.isNaN(Date.parse(c.validUntil)))
  assert.ok(Array.isArray(c.implications.id) && c.implications.id.length >= 1)
})

test('disasterHistory.additions.json: skema kompatibel dengan file utama + lokasi dikenal', () => {
  const ids = new Set(LOCATIONS.map((l) => l.id))
  const types = new Set(['longsor', 'banjir', 'kebakaran', 'gempa', 'vulkanik', 'angin', 'asap'])
  for (const ev of additions.events) {
    assert.ok(types.has(ev.type), `type ${ev.type}`)
    assert.equal(ev.hazard, ev.type)
    assert.ok(ev.date && ev.year && ev.source?.startsWith('http'), `event ${ev.id}`)
    assert.ok(ev.locations.length >= 1)
    for (const loc of ev.locations) assert.ok(ids.has(loc), `lokasi ${loc} pada ${ev.id}`)
  }
  assert.ok(additions.events.some((e) => e.type === 'kebakaran' && e.year === 2026), 'karhutla 2026 harus ada')
})

test('contacts.hazards.js: hanya kontak terverifikasi & bernomor yang ditampilkan', () => {
  const shown = contactsFor('asap', 'celala')
  assert.ok(shown.every((c) => c.phone))
  assert.ok(shown.some((c) => c.id === 'bpbd-aceh-tengah'))
  assert.ok(EMERGENCY_CONTACTS.filter((c) => !c.verified).every((c) => !shown.find((s) => s.id === c.id)))
})

test('fixtures hazards: ada & JSON valid', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/hazards/MANIFEST.json', import.meta.url), 'utf8'))
  assert.ok(manifest.results.filter((r) => r.ok).length >= 12)
  for (const name of ['openmeteo-airquality-takengon.json', 'bmkg-autogempa.json', 'openmeteo-flood-peusangan-4cells.json', 'openmeteo-gfs-cape-li.json']) {
    const j = JSON.parse(readFileSync(new URL(`./fixtures/hazards/${name}`, import.meta.url), 'utf8'))
    assert.ok(j)
  }
  const magma = readFileSync(new URL('./fixtures/hazards/magma-tingkat-aktivitas.html', import.meta.url), 'utf8')
  assert.ok(magma.includes('Bur Ni Telong'))
})
