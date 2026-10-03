import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  parseEnsembleMembers,
  accumulate6hTo24h,
  accumulate1hTo24h,
  windowExceedance,
  consensusLevel,
} from '../server/consensus.js'
import { parseBmkgRss, affectedLocations, fetchBmkgNowcast } from '../server/bmkg.js'
import { antecedentIndex, accumulatedRain } from '../server/antecedent.js'

// ---------- F1: konsensus ----------

test('parseEnsembleMembers: hanya ambil kolom precipitation_memberNN', () => {
  const raw = { hourly: { time: ['t0'], precipitation_member01: [1], other: [2], precipitation_member02: [3] } }
  const members = parseEnsembleMembers(raw)
  assert.equal(members.length, 2)
  assert.deepEqual(members[0], [1])
})

test('accumulate6hTo24h: window 24 jam = sum 4 langkah 6-hourly', () => {
  // 2 member × 8 langkah (2 hari)
  const m1 = [1, 2, 3, 4, 5, 6, 7, 8]
  const m2 = [0, 0, 0, 10, 0, 0, 0, 0]
  const windows = accumulate6hTo24h([m1, m2])
  assert.equal(windows.length, 2)
  assert.deepEqual(windows[0], [10, 10]) // 1+2+3+4
  assert.deepEqual(windows[1], [26, 0]) // 5+6+7+8
})

test('accumulate1hTo24h: window 24 jam dari hourly', () => {
  const m = Array(48).fill(1)
  const windows = accumulate1hTo24h([m])
  assert.equal(windows.length, 2)
  assert.deepEqual(windows[0], [24])
})

test('windowExceedance: persentase member > threshold', () => {
  const w = [[30, 10, 26, 5]] // 2 dari 4 > 25
  const r = windowExceedance(w, 25)
  assert.equal(r.probability, 50)
  assert.equal(r.members, 4)
  assert.equal(windowExceedance([], 25).probability, 0)
})

test('consensusLevel: >=2 sumber setuju → tinggi', () => {
  const r = consensusLevel({
    ecmwf: { probability: 60, members: 50 },
    wn2: { probability: 45, members: 64 },
    bmkgAlertActive: false,
  })
  assert.equal(r.level, 'tinggi')
  assert.equal(r.votes, 2)
  assert.equal(r.sources, 2)
})

test('consensusLevel: 1 sumber → sedang; 0 → rendah', () => {
  assert.equal(
    consensusLevel({ ecmwf: { probability: 60, members: 50 }, wn2: { probability: 10, members: 64 } }).level,
    'sedang'
  )
  assert.equal(
    consensusLevel({ ecmwf: { probability: 10, members: 50 }, wn2: { probability: 10, members: 64 } }).level,
    'rendah'
  )
})

test('consensusLevel: BMKG nowcast aktif dihitung sebagai sumber', () => {
  const r = consensusLevel({
    ecmwf: { probability: 10, members: 50 },
    wn2: { probability: 10, members: 64 },
    bmkgAlertActive: true,
  })
  assert.equal(r.sources, 3)
  assert.equal(r.level, 'sedang') // 1 vote (bmkg)
})

test('consensusLevel: sumber kosong (degraded) → rendah, sources 0', () => {
  const r = consensusLevel({ bmkgAlertActive: false })
  assert.equal(r.level, 'rendah')
  assert.equal(r.sources, 0)
})

// ---------- F5: parser BMKG ----------

test('parseBmkgRss: ekstrak item + flag Aceh dari fixture resmi', async () => {
  const xml = await readFile(new URL('./fixtures/bmkg-nowcast-rss.xml', import.meta.url), 'utf8')
  const items = parseBmkgRss(xml)
  assert.ok(items.length >= 9)
  const aceh = items.filter((i) => i.isAceh)
  assert.equal(aceh.length, 1)
  assert.match(aceh[0].title, /Aceh/)
  assert.match(aceh[0].description, /DANAU LAUT TAWAR/)
  assert.ok(aceh[0].link.includes('_alert.xml'))
  assert.ok(aceh[0].pubDate.length > 0)
})

test('affectedLocations: map kecamatan BMKG → id lokasi sentra', () => {
  const desc =
    'Hujan lebat di DANAU LAUT TAWAR, BIES, KEBAYAKAN, dan SILIH NARA.'
  assert.deepEqual(affectedLocations(desc), ['luttawar', 'bies', 'kebayakan', 'silihnara'])
  assert.deepEqual(affectedLocations('Tidak ada sentra terdampak.'), [])
})

test('fetchBmkgNowcast: fetch gagal → degraded, tidak throw', async () => {
  const r = await fetchBmkgNowcast({
    fetchImpl: async () => {
      throw new Error('timeout')
    },
  })
  assert.equal(r.authority, 'BMKG')
  assert.equal(r.active, false)
  assert.equal(r.degraded, true)
  assert.ok(r.error)
})

test('fetchBmkgNowcast: RSS tanpa peringatan Aceh → active false', async () => {
  const r = await fetchBmkgNowcast({
    fetchImpl: async () => ({
      ok: true,
      text: async () => '<rss><channel><item><title>Hujan Lebat di Riau</title></item></channel></rss>',
    }),
  })
  assert.equal(r.active, false)
  assert.equal(r.degraded, false)
})

// ---------- F2: ARI accumulation ----------

test('accumulatedRain: sum n jam ke belakang dari indeks', () => {
  const hourly = Array(100).fill(1)
  assert.equal(accumulatedRain(hourly, 99, 24), 24)
  assert.equal(accumulatedRain(hourly, 99, 72), 72)
  assert.equal(accumulatedRain(hourly, 2, 24), 3) // indeks dekat awal
  assert.equal(accumulatedRain([], 5, 24), 0)
})

test('antecedentIndex: ari24/ari72 + sumber model', () => {
  const hourly = Array(80).fill(1)
  const ari = antecedentIndex(hourly, 79)
  assert.equal(ari.ari24, 24)
  assert.equal(ari.ari72, 72)
  assert.equal(ari.source, 'model-ecmwf')
})

test('antecedentIndex: nilai desimal dibulatkan 1 angka', () => {
  const hourly = Array(72).fill(0.333)
  const ari = antecedentIndex(hourly, 71)
  assert.equal(ari.ari24, 8)
  assert.equal(ari.ari72, 24)
})
