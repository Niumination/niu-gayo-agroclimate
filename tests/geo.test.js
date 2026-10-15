import test from 'node:test'
import assert from 'node:assert/strict'
import kecamatan from '../src/data/geo/kecamatan.json' with { type: 'json' }
import { LOCATIONS } from '../src/data/locations.js'
import { makeProjection, geometryToPath, featureBbox, haversineKm, BURNI_TELONG } from '../src/domain/geo.js'

test('featureBbox & makeProjection: semua sentra jatuh di dalam kanvas; skala km konsisten', () => {
  const bbox = featureBbox(kecamatan.features)
  assert.ok(bbox[0] < 96.3 && bbox[2] > 97.3 && bbox[1] < 4.2 && bbox[3] > 4.9, JSON.stringify(bbox))
  const p = makeProjection(bbox, { width: 600, height: 460, padding: 14 })
  for (const l of LOCATIONS) {
    const [x, y] = p.project(l.lon, l.lat)
    assert.ok(x >= 14 && x <= 586 && y >= 14 && y <= 446, `${l.id} di luar kanvas (${x},${y})`)
  }
  // 1° lintang = 111,32 km → kmToPx(111.32) = scale
  assert.ok(Math.abs(p.kmToPx(111.32) - p.scale) < 1e-9)
  // sumbu y terbalik (utara di atas)
  const [, yN] = p.project(96.8, 4.9)
  const [, yS] = p.project(96.8, 4.3)
  assert.ok(yN < yS)
})

test('geometryToPath: Polygon & MultiPolygon → path tertutup', () => {
  const p = makeProjection([96, 4, 97, 5])
  const poly = { type: 'Polygon', coordinates: [[[96, 4], [97, 4], [97, 5], [96, 4]]] }
  const d = geometryToPath(poly, p.project)
  assert.match(d, /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+Z$/)
  const multi = { type: 'MultiPolygon', coordinates: [poly.coordinates, poly.coordinates] }
  assert.equal((geometryToPath(multi, p.project).match(/Z/g) || []).length, 2)
  assert.equal(geometryToPath(null, p.project), '')
  for (const f of kecamatan.features) assert.ok(geometryToPath(f.geometry, p.project).length > 10, f.properties.id)
})

test('Burni Telong: koordinat PVMBG & jarak ke sentra terdekat (Ketol ≈ 8 km, Kute Panang ≈ 10,5 km)', () => {
  assert.equal(BURNI_TELONG.lat, 4.769)
  assert.equal(BURNI_TELONG.lon, 96.821)
  assert.equal(BURNI_TELONG.radiusKm, 3)
  const d = (id) => { const l = LOCATIONS.find((x) => x.id === id); return haversineKm(l.lat, l.lon, BURNI_TELONG.lat, BURNI_TELONG.lon) }
  assert.ok(Math.abs(d('ketol') - 8.1) < 0.3, d('ketol'))
  assert.ok(Math.abs(d('kutepanang') - 10.5) < 0.3, d('kutepanang'))
  assert.ok(Math.abs(d('takengon') - 15.7) < 0.3, d('takengon'))
  // tidak ada sentra di dalam radius rekomendasi 3 km
  for (const l of LOCATIONS) assert.ok(haversineKm(l.lat, l.lon, BURNI_TELONG.lat, BURNI_TELONG.lon) > BURNI_TELONG.radiusKm, l.id)
})

test('placeLabels: prioritas tinggi ditempatkan dulu; label bertabrakan dipindah atau disembunyikan', async () => {
  const { placeLabels } = await import('../src/domain/geo.js')
  const pts = [
    { id: 'a', x: 100, y: 100, text: 'Takengon Kota', priority: 1 },
    { id: 'b', x: 102, y: 101, text: 'Bebesan', priority: 5 }, // hampir berimpit → b menang di kanan
    { id: 'c', x: 300, y: 300, text: 'Linge', priority: 0 },
  ]
  const out = placeLabels(pts)
  assert.equal(out.b.anchor, 'start')
  assert.ok(out.a === null || out.a.anchor !== 'start') // a tidak boleh di kanan (bertabrakan dengan b)
  assert.equal(out.c.anchor, 'start')
  // kotak terlarang memaksa pindah
  const blocked = placeLabels([{ id: 'c', x: 300, y: 300, text: 'Linge', priority: 0 }], { boxes: [{ x1: 305, x2: 400, y1: 290, y2: 310 }] })
  assert.notEqual(blocked.c.anchor, 'start')
})
