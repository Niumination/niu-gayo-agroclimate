import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  decideDispatch, buildAlert, buildGroupAlert, toCapXml, renderTelegram, renderWhatsApp, renderSms, certaintyOf, capTime,
  shouldPush, PUSH_POLICY, SEVERITY, SENDER, MIN_INTERVAL_H,
} from '../src/domain/alert.js'
import { runAlertCycle, readFeed, loadState, sendTelegram } from '../server/alerts.js'
import { archiveSnapshot, readArchive, getHazardsForLocation, getHazardsAll, toIsoWib } from '../server/hazards.js'

const NOW = '2026-10-15T10:00:00Z'
const LOC = { id: 'bintang', name: 'Bintang', lat: 4.72, lon: 96.95 }
const result = (over = {}) => ({
  id: 'angin', group: 'hidromet', label: { id: 'Angin Kencang' }, level: 'bahaya', score: 70,
  headline: 'Hembusan 62 km/jam', detail: 'Hembusan maksimum 24 jam ke depan 65 km/jam.',
  metrics: [{ key: 'gust', label: 'Hembusan', value: 62, unit: 'km/jam' }],
  advice: { umum: ['Jauhi pohon besar & baliho.', 'Amankan atap seng.'], kebun: ['Tunda panen di lereng terbuka.'] },
  sources: [{ name: 'Open-Meteo ECMWF' }], flags: {}, degraded: false, ...over,
})

test('decideDispatch: Alert pertama, diam dalam 6 jam, Update saat naik level, pengingat setelah 6 jam, Cancel saat reda', () => {
  assert.equal(decideDispatch({ level: 'rendah', last: null, now: NOW }), null)
  assert.equal(decideDispatch({ level: 'waspada', last: null, now: NOW }), 'Alert')
  const last = { level: 'waspada', sentAt: '2026-10-15T08:00:00Z', identifier: 'x' }
  assert.equal(decideDispatch({ level: 'waspada', last, now: NOW }), null) // 2 jam → diam
  assert.equal(decideDispatch({ level: 'bahaya', last, now: NOW }), 'Update') // naik → segera
  assert.equal(decideDispatch({ level: 'waspada', last, now: '2026-10-15T14:30:00Z' }), 'Update') // ≥ 6 jam → pengingat
  assert.equal(decideDispatch({ level: 'rendah', last, now: NOW }), 'Cancel')
  assert.equal(decideDispatch({ level: 'n/a', last, now: NOW }), 'Cancel') // pemanggil harus menyaring n/a lebih dulu
  const lastHigh = { level: 'ekstrem', sentAt: '2026-10-15T09:00:00Z' }
  assert.equal(decideDispatch({ level: 'bahaya', last: lastHigh, now: NOW }), null) // turun tapi masih aktif → tunggu jendela
  assert.equal(MIN_INTERVAL_H, 6)
})

test('shouldPush: karat tidak pernah, kekeringan hanya ≥ bahaya, lainnya ≥ waspada', () => {
  assert.equal(PUSH_POLICY.karat, null)
  assert.equal(shouldPush('karat', 'ekstrem'), false)
  assert.equal(shouldPush('kekeringan', 'waspada'), false)
  assert.equal(shouldPush('kekeringan', 'bahaya'), true)
  assert.equal(shouldPush('asap', 'waspada'), true)
  assert.equal(shouldPush('longsor', 'rendah'), false)
})

test('buildAlert: pemetaan CAP (severity/urgency/certainty), kedaluwarsa, area lingkaran, disclaimer', () => {
  const a = buildAlert({ result: result(), location: LOC, now: NOW, url: 'https://x/agroclimate/' })
  assert.match(a.identifier, /^nga-bintang-angin-20261015T100000$/)
  assert.equal(a.senderName, SENDER)
  assert.equal(a.msgType, 'Alert')
  assert.equal(a.status, 'Actual')
  assert.equal(a.info.severity, 'Severe')
  assert.equal(a.info.urgency, 'Immediate')
  assert.equal(a.info.certainty, 'Likely')
  assert.equal(a.info.category, 'Met')
  assert.match(a.info.headline, /^BAHAYA Angin Kencang — Bintang: Hembusan 62 km\/jam$/)
  assert.equal(a.info.expires, '2026-10-15T16:00:00.000Z')
  assert.equal(a.info.area.circle, '4.72,96.95 5')
  assert.match(a.info.instruction, /Jauhi pohon besar/)
  assert.match(a.info.disclaimer, /bukan peringatan resmi/)
  assert.deepEqual(a.info.parameters, [{ valueName: 'gust', value: '62 km/jam' }])
  assert.equal(SEVERITY.ekstrem, 'Extreme')
  assert.equal(buildAlert({ result: result({ level: 'waspada' }), location: LOC, now: NOW }).info.severity, 'Moderate')
  const c = buildAlert({ result: result({ level: 'rendah' }), location: LOC, now: NOW, msgType: 'Cancel', references: ['agroclimate@niumination.id,nga-x,2026-10-15T04:00:00Z'] })
  assert.equal(c.info.urgency, 'Past')
  assert.match(c.info.headline, /kembali rendah/)
  assert.equal(c.references.length, 1)
})

test('certaintyOf: Observed bila ada pengamatan (hotspot/laporan/siaga lokal), Possible bila degraded', () => {
  assert.equal(certaintyOf(result({ flags: { siagaLokal: true } })), 'Observed')
  assert.equal(certaintyOf(result({ flags: { reportEscalation: { escalate: true } } })), 'Observed')
  assert.equal(certaintyOf(result({ flags: { hotspotsDegraded: false }, metrics: [{ key: 'hotspots25km24h', value: 2 }] })), 'Observed')
  assert.equal(certaintyOf(result({ degraded: true })), 'Possible')
  assert.equal(certaintyOf(result()), 'Likely')
})

test('toCapXml: CAP 1.2 valid secara struktural, waktu +07:00, escape XML', () => {
  const a = buildAlert({ result: result({ headline: 'Hembusan > 60 km/jam & "kencang"' }), location: LOC, now: NOW, url: 'https://x/agroclimate/' })
  const xml = toCapXml(a)
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">/)
  assert.match(xml, /<sent>2026-10-15T17:00:00\+07:00<\/sent>/)
  assert.match(xml, /<expires>2026-10-15T23:00:00\+07:00<\/expires>/)
  assert.match(xml, /<severity>Severe<\/severity>/)
  assert.match(xml, /&gt; 60 km\/jam &amp; &quot;kencang&quot;/)
  assert.match(xml, /<circle>4.72,96.95 5<\/circle>/)
  assert.match(xml, /<web>https:\/\/x\/agroclimate\/<\/web>/)
  assert.doesNotMatch(xml, /<references>/)
  assert.equal(capTime('bukan-tanggal'), null)
  const order = ['<identifier>', '<sender>', '<sent>', '<status>', '<msgType>', '<scope>', '<info>', '<language>', '<category>', '<event>', '<urgency>', '<severity>', '<certainty>', '<headline>', '<description>', '<instruction>', '<expires>', '<area>']
  let pos = -1
  for (const tag of order) {
    const i = xml.indexOf(tag)
    assert.ok(i > pos, `urutan elemen CAP: ${tag}`)
    pos = i
  }
})

test('renderer: Telegram markdown, WhatsApp tanpa _miring_, SMS ≤ 160 dengan 112', () => {
  const a = buildAlert({ result: result(), location: LOC, now: NOW, url: 'https://x/agroclimate/' })
  const tg = renderTelegram(a)
  assert.match(tg, /^🟠🌬️ \*BAHAYA Angin Kencang — Bintang: Hembusan 62 km\/jam\*/)
  assert.match(tg, /➡️ Jauhi pohon besar/)
  assert.match(tg, /Sumber: Open-Meteo ECMWF/)
  assert.match(tg, /_Informasi pendukung.*_/)
  const wa = renderWhatsApp(a)
  assert.doesNotMatch(wa, /^_.*_$/m)
  const sms = renderSms(a)
  assert.ok(sms.length <= 160, sms)
  assert.match(sms, /^NGA Bintang 17:00: BAHAYA Angin kencang\. Jauhi pohon besar & baliho\./)
  assert.match(sms, /Darurat 112$/)
  const long = buildAlert({ result: result({ advice: { umum: ['Kalimat anjuran yang sangat panjang sekali tanpa titik agar melebihi batas seratus enam puluh karakter pesan singkat yang diizinkan operator'] } }), location: { id: 'jagongjeget', name: 'Jagong Jeget' }, now: NOW })
  const s2 = renderSms(long)
  assert.ok(s2.length <= 160, `${s2.length}`)
  assert.match(s2, /…\s*Info model,bkn resmi\. Darurat 112$/)
  const upd = renderTelegram(buildAlert({ result: result(), location: LOC, now: NOW, msgType: 'Update' }))
  assert.match(upd, /\(pembaruan\)/)
  const can = renderTelegram(buildAlert({ result: result({ level: 'rendah' }), location: LOC, now: NOW, msgType: 'Cancel' }))
  assert.match(can, /\(dicabut\)/)
  assert.doesNotMatch(can, /➡️/)
})

test('buildGroupAlert: satu pesan untuk banyak sentra, sentra berskor tertinggi memimpin, banyak <circle>', () => {
  const items = [
    { result: result({ score: 50, headline: 'Hembusan 55 km/jam' }), location: { id: 'bies', name: 'Bies', lat: 4.6, lon: 96.8 } },
    { result: result({ score: 80, headline: 'Hembusan 70 km/jam' }), location: LOC },
    { result: result({ score: 60, headline: 'Hembusan 60 km/jam' }), location: { id: 'linge', name: 'Linge', lat: 4.5, lon: 96.9 } },
  ]
  const g = buildGroupAlert({ items, now: NOW })
  assert.match(g.identifier, /^nga-multi3-angin-/)
  assert.equal(g.location.name, '3 sentra')
  assert.match(g.info.headline, /^BAHAYA Angin Kencang — 3 sentra \(tertinggi Bintang: Hembusan 70 km\/jam\)/)
  assert.match(g.info.description, /^Bintang, Linge, Bies\./)
  assert.equal(g.locations.length, 3)
  assert.equal(g.info.area.circles.length, 3)
  const xml = toCapXml(g)
  assert.equal((xml.match(/<circle>/g) || []).length, 3)
})

function fakeAll(rows) {
  return { _full: rows.map((r) => ({ id: r.id, name: r.name ?? r.id, hazards: r.hazards })) }
}

test('runAlertCycle: dryRun tidak menulis; Alert → diam → Update naik → Cancel; karat tidak di-push; pengelompokan ≥ 3 sentra', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nga-alerts-'))
  const sentTexts = []
  const send = async (text) => { sentTexts.push(text); return { ok: true } }
  const all1 = fakeAll([
    { id: 'bintang', name: 'Bintang', hazards: [result({ level: 'waspada', score: 40 }), result({ id: 'karat', level: 'bahaya', label: { id: 'Karat' } })] },
    { id: 'linge', name: 'Linge', hazards: [result({ id: 'banjir', level: 'n/a', label: { id: 'Banjir' } })] },
  ])
  const dry = await runAlertCycle(all1, { now: NOW, dryRun: true, dir, send })
  assert.equal(dry.sent.length, 1)
  assert.equal(dry.sent[0].dryRun, true)
  assert.equal(sentTexts.length, 0)
  assert.deepEqual(loadState(dir), {})

  const r1 = await runAlertCycle(all1, { now: NOW, dir, send })
  assert.equal(r1.sent.length, 1)
  assert.equal(r1.sent[0].msgType, 'Alert')
  assert.equal(r1.sent[0].hazard, 'angin')
  assert.equal(sentTexts.length, 1)
  assert.deepEqual(Object.keys(loadState(dir)), ['bintang:angin'])

  const r2 = await runAlertCycle(all1, { now: '2026-10-15T11:00:00Z', dir, send })
  assert.equal(r2.sent.length, 0) // dalam jendela 6 jam → diam

  const all2 = fakeAll([{ id: 'bintang', name: 'Bintang', hazards: [result({ level: 'ekstrem', score: 90 })] }])
  const r3 = await runAlertCycle(all2, { now: '2026-10-15T12:00:00Z', dir, send })
  assert.equal(r3.sent[0].msgType, 'Update')
  assert.equal(r3.sent[0].references.length, 1)
  assert.match(r3.sent[0].references[0], /nga-bintang-angin-20261015T100000/)

  const all3 = fakeAll([{ id: 'bintang', name: 'Bintang', hazards: [result({ level: 'rendah', score: 5 })] }])
  const r4 = await runAlertCycle(all3, { now: '2026-10-15T13:00:00Z', dir, send })
  assert.equal(r4.sent[0].msgType, 'Cancel')
  assert.deepEqual(loadState(dir), {})

  // pengelompokan: 4 sentra asap waspada → 1 pesan gabungan; 1 sentra longsor bahaya → pesan sendiri; urutan level tertinggi dulu
  const asap = (id, name) => ({ id, name, hazards: [result({ id: 'asap', label: { id: 'Kabut Asap' }, level: 'waspada', score: 30, headline: 'ISPU 120' })] })
  const all4 = fakeAll([asap('bies', 'Bies'), asap('ketol', 'Ketol'), asap('celala', 'Celala'), asap('linge', 'Linge'), { id: 'bintang', name: 'Bintang', hazards: [result({ id: 'longsor', label: { id: 'Longsor' }, level: 'bahaya', score: 75 })] }])
  const r5 = await runAlertCycle(all4, { now: '2026-10-15T14:00:00Z', dir, send })
  assert.equal(r5.decided.length, 5)
  assert.equal(r5.messages, 2)
  assert.equal(r5.sent[0].hazard, 'longsor')
  assert.equal(r5.sent[1].hazard, 'asap')
  assert.equal(r5.sent[1].locations.length, 4)
  assert.equal(Object.keys(loadState(dir)).length, 5)

  const feed = readFeed({ now: '2026-10-15T15:00:00Z', dir })
  assert.equal(feed.length, 5) // Alert, Update, Cancel, longsor, asap-gabungan
  assert.equal(feed[0].hazard, 'asap') // terbaru dulu
  assert.equal(readFeed({ now: '2026-10-15T15:00:00Z', dir, hazard: 'longsor' }).length, 1)
  assert.equal(readFeed({ now: '2026-10-15T15:00:00Z', dir, location: 'bintang' }).length, 4)
  assert.equal(readFeed({ now: '2026-10-17T15:00:00Z', dir, hours: 24 }).length, 0)

  // kegagalan kirim → state tidak berubah untuk kunci itu
  const failSend = async () => ({ ok: false, error: 'telegram 429' })
  const r6 = await runAlertCycle(fakeAll([{ id: 'bies', name: 'Bies', hazards: [result({ level: 'bahaya' })] }]), { now: '2026-10-15T16:00:00Z', dir, send: failSend })
  assert.equal(r6.sent.length, 0)
  assert.equal(r6.errors.length, 1)
  assert.equal(loadState(dir)['bies:angin'], undefined)
})

test('sendTelegram: tanpa token → ok:false tanpa fetch; dengan token → POST sendMessage ke topik', async () => {
  const noTok = await sendTelegram('x', { token: '', chatId: '' })
  assert.equal(noTok.ok, false)
  let captured
  const fetchImpl = async (url, opts) => { captured = { url, body: JSON.parse(opts.body) }; return { ok: true } }
  const ok = await sendTelegram('halo', { fetchImpl, token: 'T', chatId: '-100', topicId: '55' })
  assert.equal(ok.ok, true)
  assert.match(captured.url, /^https:\/\/api\.telegram\.org\/botT\/sendMessage$/)
  assert.equal(captured.body.message_thread_id, 55)
  assert.equal(captured.body.text, 'halo')
})

test('archiveSnapshot: 1 cuplikan per sentra per jam WIB, file per tanggal WIB; readArchive menandai hari kosong', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nga-archive-'))
  const all = { locations: [{ id: 'bintang', worst: 'waspada', levels: { angin: 'waspada' }, active: ['angin'], degraded: false }, { id: 'bies', worst: 'n/a', levels: {}, active: [], degraded: true }] }
  const a = archiveSnapshot(all, { now: '2026-10-15T17:30:00Z', dir }) // 00:30 WIB 16 Okt
  assert.equal(a.date, '2026-10-16')
  assert.equal(a.added, 1)
  const b = archiveSnapshot(all, { now: '2026-10-15T17:50:00Z', dir })
  assert.equal(b.added, 0) // jam WIB sama
  const c = archiveSnapshot(all, { now: '2026-10-15T18:10:00Z', dir })
  assert.equal(c.added, 1)
  assert.equal(c.total, 2)
  const days = readArchive({ days: 2, now: '2026-10-15T18:10:00Z', dir })
  assert.equal(days[0].date, '2026-10-16')
  assert.equal(days[0].snapshots.length, 2)
  assert.equal(days[1].missing, true)
})

test('getHazardsForLocation: fetcher disuntikkan, kegagalan sumber → warnings + n/a, bukan throw', async () => {
  const raw = (() => {
    const time = []
    const start = Date.UTC(2026, 9, 14, 17) // 00:00 WIB 15 Okt
    for (let i = 0; i < 72; i++) time.push(new Date(start + i * 3_600_000).toISOString().slice(0, 16))
    const fill = (v) => Array.from({ length: 72 }, () => v)
    // Format Open-Meteo timezone=Asia/Jakarta: waktu lokal tanpa offset
    const local = time.map((t) => new Date(new Date(`${t}:00Z`).getTime() + 7 * 3_600_000).toISOString().slice(0, 16))
    return { current: { time: local[10], wind_gusts_10m: 65, wind_speed_10m: 20, precipitation: 0, temperature_2m: 22, relative_humidity_2m: 80 }, hourly: { time: local, precipitation: fill(0), soil_moisture_0_to_7cm: fill(0.3), wind_speed_10m: fill(20), wind_gusts_10m: fill(65), leaf_wetness_probability: fill(0), temperature_2m: fill(22) }, daily: { precipitation_sum: [0] } }
  })()
  const deps = {
    weatherGet: async () => ({ raw }),
    aqGet: async () => { throw new Error('cams down') },
    fireGet: async () => ({ degraded: true, error: 'arsip gagal' }),
    archiveGet: async () => { throw new Error('archive down') },
    reportsGet: async () => ({ reports: [] }),
  }
  const r = await getHazardsForLocation('bintang', deps)
  assert.equal(r.location.id, 'bintang')
  assert.equal(r.worst, 'bahaya')
  assert.deepEqual(r.active, ['angin'])
  assert.ok(r.warnings.some((w) => w.startsWith('udara: cams down')))
  assert.ok(r.warnings.some((w) => w.startsWith('arsip:')))
  assert.equal(r.summary.levels.kekeringan, 'n/a')
  assert.equal(r.summary.levels.kebakaran, 'n/a')
  assert.match(r.evaluatedAt, /^2026-10-15T03:00:00\.000Z$/) // 10:00 WIB → UTC
  const bad = await getHazardsForLocation('nowhere', deps)
  assert.equal(bad.degraded, true)
  assert.equal(toIsoWib('2026-10-15T17:00'), '2026-10-15T10:00:00.000Z')
  assert.equal(toIsoWib('2026-10-15T10:00:00Z'), '2026-10-15T10:00:00.000Z')

  const all = await getHazardsAll(async (id) => (id === 'bies' ? Promise.reject(new Error('boom')) : r), { locations: [{ id: 'bintang', name: 'Bintang' }, { id: 'bies', name: 'Bies' }] })
  assert.equal(all.total, 2)
  assert.equal(all.degradedCount, 1)
  assert.equal(all.worst.id, 'bintang')
  assert.deepEqual(all.activeByHazard.angin, ['bintang'])
  assert.equal(all.locations[1].error, 'boom')
  assert.ok(Array.isArray(all._full[0].hazards))
})
