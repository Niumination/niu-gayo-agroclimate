/**
 * server/routes.js — router HTTP Niu Gayo Agro-Climate.
 *
 * Dipisah dari server/index.js (temuan audit F-09); handler hanya memakai konteks (ctx)
 * yang disuntikkan oleh index.js sehingga alur data eksplisit dan mudah dirawat.
 * Semua dependensi berstatus (cache/getter) tetap dibangun di index.js.
 *
 * F-12: token cron dibandingkan constant-time (crypto.timingSafeEqual).
 * F-13: header keamanan dasar terpasang pada semua respons (JSON & CAP XML).
 */
import crypto from 'node:crypto'

/** F-13 — header keamanan dasar untuk seluruh respons. */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
}

/** Header respons CAP 1.2 XML (F-13 + CORS publik). */
export const CAP_HEADERS = {
  'Content-Type': 'application/cap+xml; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  ...SECURITY_HEADERS,
}

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...SECURITY_HEADERS,
  })
  res.end(data)
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** F-12 — bandingkan token tanpa membocorkan waktu (constant-time). */
export function tokenMatches(provided, expected) {
  if (typeof provided !== 'string' || !provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Bangun handler HTTP dari konteks (lihat perakitan `ctx` di server/index.js). */
export function createHandler(ctx) {
  const {
    VALID_LOCATIONS, LOCATIONS, peek, cacheStats, clearCache,
      weatherGet, ensembleGet, alertsGet, bmkgGet, aqGet, aqSummaryGet, archiveGet,
      hotspotsGet, hotspotsForLocation, fireGet, fireSummaryGet,
      quakesAllGet, quakesForLocation, volcanoGet, convectiveGet, floodGet, externalReportsGet,
      hazardsGet, hazardsAllGet, consensusGet,
      SPI_BASELINE, computeSpi, assessDrought, seasonalInfoExtended, climateOutlook, disasterHistory,
      readFeed, runAlertCycle, toCapXml,
      validateReport, rateLimited, submitReport, recentReports, clientIp,
      PKG_VERSION, BUILD_INFO = {}, HAZARDS_ON, FIRMS_MAP_KEY, readToken,
  } = ctx
  return async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const path = url.pathname
    try {
      if (path === '/healthz') {
        // NFR: status per sumber dari cache (tanpa memicu fetch) + fitur aktif
        const src = (key) => {
          const p = peek(key)
          if (!p) return { state: 'belum-dimuat' }
          const v = p.value ?? {}
          return { state: v.degraded ? 'degraded' : 'ok', fresh: p.fresh, retrievedAt: v.retrievedAt ?? v.generatedAt ?? null, error: v.error ?? v.reason ?? undefined }
        }
        return json(res, 200, {
          ok: true,
          version: PKG_VERSION,
          build: {
            revision: BUILD_INFO.revision ?? 'unknown',
            dirty: BUILD_INFO.dirty ?? null,
            frontendRevision: BUILD_INFO.frontendRevision ?? null,
            frontendVersion: BUILD_INFO.frontendVersion ?? null,
            frontendBuiltAt: BUILD_INFO.frontendBuiltAt ?? null,
          },
          uptime: process.uptime(),
          cache: cacheStats(),
          features: { hazardsEnabled: HAZARDS_ON, firmsKey: !!FIRMS_MAP_KEY, telegram: !!readToken('TELEGRAM_BOT_TOKEN'), cronToken: !!process.env.ALERTS_CRON_TOKEN },
          sources: { alerts: src('alerts:all'), bmkgNowcast: src('bmkg:nowcast'), airQuality: src('aq:all'), hotspots: src('firms:all'), fireDanger: src('fire:all'), hazards: src('hazards:all'), quakes: src('quakes:all'), volcano: src('volcano:status'), flood: src('flood:all'), petabencana: src('petabencana:aceh') },
        })
      }
      if (path === '/api/weather') {
        const id = url.searchParams.get('location')
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
        }
        try {
          const { raw, ...data } = await weatherGet(id)
          return json(res, 200, data)
        } catch (err) {
          const location = LOCATIONS.find((item) => item.id === id)
          return json(res, 200, {
            location: location ? { id: location.id, name: location.name } : { id },
            retrievedAt: new Date().toISOString(),
            degraded: true,
            error: err?.message || 'Data cuaca belum tersedia',
            current: null,
            times: [],
            precipitation: [],
            temperature_2m: [],
            leaf_wetness_probability: [],
            soil_moisture_0_to_7cm: [],
            wind_gusts_10m: [],
          })
        }
      }
      if (path === '/api/ensemble') {
        const id = url.searchParams.get('location')
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
        }
        try {
          const data = await ensembleGet(id)
          return json(res, 200, data)
        } catch (err) {
          // Upstream ensemble is best-effort: an unavailable model must not turn
          // the documented JSON endpoint into a 502 or break the dashboard.
          const location = LOCATIONS.find((item) => item.id === id)
          return json(res, 200, {
            location: location ? { id: location.id, name: location.name } : { id },
            retrievedAt: new Date().toISOString(),
            degraded: true,
            error: err?.message || 'Data ensemble belum tersedia',
            data: null,
          })
        }
      }
      if (path === '/api/alerts') {
        // 1.8: agregat lama + ringkasan ISPU (H-ASAP) + level registry per sentra (best-effort, tidak memblokir bila gagal)
        const [base, aq, hz] = await Promise.allSettled([alertsGet(), aqSummaryGet(), hazardsAllGet()])
        const sourceErrors = {}
        const data = base.status === 'fulfilled'
          ? { ...base.value }
          : { generatedAt: new Date().toISOString(), watershedRainIndex24h: null, locations: [], staleness: null }
        if (base.status !== 'fulfilled') sourceErrors.alerts = base.reason?.message || 'Ringkasan cuaca belum tersedia'
        data.airQuality = aq.status === 'fulfilled'
          ? { retrievedAt: aq.value.retrievedAt, count: aq.value.count ?? null, worst: aq.value.worst ?? null, degradedCount: aq.value.degradedCount ?? 0, locations: (aq.value.locations ?? []).map((l) => ({ id: l.id, level: l.level, ispu: l.ispu, category: l.category ?? null, haze: l.haze ?? null })) }
          : { degraded: true, error: aq.reason?.message || 'Ringkasan kualitas udara belum tersedia' }
        data.hazards = hz.status === 'fulfilled'
          ? { retrievedAt: hz.value.retrievedAt, total: hz.value.total ?? null, degradedCount: hz.value.degradedCount ?? 0, worst: hz.value.worst, activeByHazard: hz.value.activeByHazard, locations: (hz.value.locations ?? []).map((l) => ({ id: l.id, worst: l.worst, active: l.active, levels: l.levels })) }
          : { degraded: true, error: hz.reason?.message || 'Ringkasan bahaya belum tersedia' }
        if (aq.status !== 'fulfilled') sourceErrors.airQuality = data.airQuality.error
        if (hz.status !== 'fulfilled') sourceErrors.hazards = data.hazards.error
        const degradedSources = []
        if (base.status !== 'fulfilled' || base.value?.degraded) degradedSources.push('alerts')
        if (aq.status !== 'fulfilled' || data.airQuality.degradedCount > 0) degradedSources.push('airQuality')
        if (hz.status !== 'fulfilled' || data.hazards.degradedCount > 0) degradedSources.push('hazards')
        data.degraded = degradedSources.length > 0
        if (data.degraded) data.degradedSources = degradedSources
        if (Object.keys(sourceErrors).length) data.sourceErrors = sourceErrors
        return json(res, 200, data)
      }
      // v2 — registry bahaya per lokasi / ringkasan semua sentra
      if (path === '/api/hazards') {
        const id = url.searchParams.get('location')
        if (id === 'all') {
          const { _full, ...all } = await hazardsAllGet()
          return json(res, 200, all)
        }
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib: id lokasi yang valid atau 'all'" })
        }
        return json(res, 200, await hazardsGet(id))
      }
      // 1.8b — feed peringatan (JSON) / satu peringatan sebagai CAP 1.2 XML
      if (path === '/api/alerts/feed') {
        const hours = Math.min(24 * 14, Math.max(1, Number(url.searchParams.get('hours')) || 24))
        const location = url.searchParams.get('location')
        const hazard = url.searchParams.get('hazard')
        const feed = readFeed({ hours, location: location && VALID_LOCATIONS.has(location) ? location : null, hazard })
        if (url.searchParams.get('format') === 'cap') {
          const wanted = url.searchParams.get('id')
          const alert = wanted ? feed.find((a) => a.identifier === wanted) : feed[0]
          if (!alert) return json(res, 404, { error: 'peringatan tidak ditemukan dalam jendela feed' })
          res.writeHead(200, CAP_HEADERS)
          return res.end(toCapXml(alert))
        }
        return json(res, 200, { generatedAt: new Date().toISOString(), hours, count: feed.length, alerts: feed })
      }
      // 1.8 — siklus peringatan (dipanggil scripts/alerts-cron.mjs). Server hanya mendengar 127.0.0.1; token opsional.
      if (path === '/api/alerts/run') {
        if (req.method !== 'POST') return json(res, 405, { error: 'gunakan POST' })
        const token = process.env.ALERTS_CRON_TOKEN
        if (token && !tokenMatches(req.headers['x-cron-token'], token)) return json(res, 403, { error: 'token cron tidak cocok' })
        const dryRun = ['1', 'true'].includes(url.searchParams.get('dryRun'))
        // FR-GEMPA-6: ?only=gempa,vulkanik → siklus cepat (timer 5 menit) hanya mengevaluasi bahaya kejadian-segera
        const only = (url.searchParams.get('only') || '').split(',').map((x) => x.trim()).filter(Boolean)
        const [all, bmkg] = await Promise.all([hazardsAllGet(), bmkgGet().catch(() => null)])
        // ADR-22: rujukan peringatan resmi BMKG yang aktif untuk Aceh disertakan di setiap pesan
        const official = bmkg?.active ? (bmkg.alerts ?? []).filter((a) => a.isAceh !== false).slice(0, 3).map((a) => ({ authority: 'BMKG', title: a.title, link: a.link, pubDate: a.pubDate })) : []
        const result = await runAlertCycle(all, { dryRun, official, only })
        return json(res, 200, result)
      }
      // Fase 2.1 H-GEMPA — FR-GEMPA-1: gempa relevan (≤ 300 km / disebut Aceh) + jarak per sentra bila ?location=
      if (path === '/api/quakes') {
        const id = url.searchParams.get('location')
        const all = await quakesAllGet()
        if (!id) return json(res, 200, all)
        if (!VALID_LOCATIONS.has(id)) return json(res, 400, { error: "parameter 'location' harus id lokasi yang valid" })
        return json(res, 200, quakesForLocation(all, LOCATIONS.find((l) => l.id === id)))
      }
      // Fase 2.2b H-VULKANIK — FR-VULK-1/2: tingkat aktivitas Burni Telong (MAGMA) + angin puncak + sentra di bawah angin
      if (path === '/api/volcano') {
        return json(res, 200, await volcanoGet())
      }
      // Fase 2.3 H-PETIR — FR-KONV-1: CAPE/LI/CIN GFS + CAPE/kode cuaca/hembusan ECMWF per lokasi
      if (path === '/api/convective') {
        const id = url.searchParams.get('location')
        if (!id || !VALID_LOCATIONS.has(id)) return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
        return json(res, 200, await convectiveGet(id))
      }
      // Fase 2.4 H-BANJIR+ — FR-BJR-1/2/3: debit GloFAS 4 sel DAS Peusangan + anomali vs klimatologi
      if (path === '/api/flood') {
        return json(res, 200, await floodGet())
      }
      // Fase 2.4b — FR-BJR-6: laporan warga PetaBencana.id (CC BY-NC 4.0) tersaring Gayo
      if (path === '/api/external-reports') {
        return json(res, 200, await externalReportsGet())
      }
      if (path === '/api/consensus') {
        const id = url.searchParams.get('location')
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
        }
        const data = await consensusGet(id)
        return json(res, 200, data)
      }
      if (path === '/api/bmkg-nowcast') {
        const data = await bmkgGet()
        return json(res, 200, data)
      }
      // H-ASAP — ISPU estimasi + proksi kabut asap (Fase 1)
      if (path === '/api/air-quality') {
        const id = url.searchParams.get('location')
        if (id === 'all') return json(res, 200, await aqSummaryGet())
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid (atau 'all')" })
        }
        const data = await aqGet(id)
        return json(res, 200, data)
      }
      // H-API — hotspot FIRMS (semua / per sentra ≤ 50 km)
      if (path === '/api/hotspots') {
        const id = url.searchParams.get('location')
        let all
        try {
          all = await hotspotsGet()
        } catch (err) {
          const message = err?.message || 'Data titik panas belum tersedia'
          all = { retrievedAt: new Date().toISOString(), degraded: true, reason: message, warnings: [message], hotspots: [], perLocation: {} }
        }
        if (!id) return json(res, 200, all)
        if (!VALID_LOCATIONS.has(id)) return json(res, 400, { error: "parameter 'location' harus id lokasi yang valid" })
        return json(res, 200, hotspotsForLocation(all, id))
      }
      // H-API — bahaya kebakaran: FWI harian + hotspot + HTH
      if (path === '/api/fire-danger') {
        const id = url.searchParams.get('location')
        if (id === 'all') return json(res, 200, await fireSummaryGet())
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid (atau 'all')" })
        }
        return json(res, 200, await fireGet(id))
      }
      // H-KERING — HTH kelas BMKG + neraca air 30 hari
      if (path === '/api/drought') {
        const id = url.searchParams.get('location')
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
        }
        let archive
        try {
          archive = await archiveGet(id)
        } catch (err) {
          return json(res, 200, { location: { id }, retrievedAt: new Date().toISOString(), degraded: true, error: err.message, assessment: null })
        }
        const assessment = assessDrought(archive.daily, { today: archive.today, hourly: archive.hourly })
        const spi = computeSpi(archive.daily, SPI_BASELINE?.locations?.[id], { today: archive.today })
        return json(res, 200, {
          location: archive.location,
          retrievedAt: new Date().toISOString(),
          source: archive.source,
          degraded: !assessment || archive.degraded,
          warnings: archive.warnings,
          archive: { archiveEnd: archive.archiveEnd, lagDays: archive.lagDays, today: archive.today, fromFile: archive.fromFile },
          assessment,
          spi,
        })
      }
      // F7 — kalender musiman (bulan WIB saat ini)
      if (path === '/api/seasonal') {
        const month = Number(url.searchParams.get('month')) || Number(
          new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', month: 'numeric' }).format(new Date())
        )
        if (!(month >= 1 && month <= 12)) return json(res, 400, { error: "parameter 'month' harus 1–12" })
        // Fase 3.4 — kalender diperluas: fase kering + jendela embun upas + penyesuaian ENSO/IOD (climateOutlook.json)
        return json(res, 200, seasonalInfoExtended(month, { outlook: climateOutlook }))
      }
      // F4 — riwayat bencana per sentra (statis terkurasi; upgrade DIBI API menunggu endpoint)
      if (path === '/api/disaster-history') {
        const id = url.searchParams.get('location')
        if (!id || !VALID_LOCATIONS.has(id)) {
          return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
        }
        // 1.9d (FR-X-8): filter opsional ?hazard=<id>; respons memuat `hazard`, `emergencyStatus`, ringkasan per bahaya
        const hazardFilter = url.searchParams.get('hazard')
        const events = disasterHistory.events
          .filter((e) => e.locations.includes(id) && (!hazardFilter || (e.hazard ?? e.type) === hazardFilter))
          .sort((a, b) => b.date.localeCompare(a.date))
        const byHazard = {}
        for (const e of events) byHazard[e.hazard ?? e.type] = (byHazard[e.hazard ?? e.type] ?? 0) + 1
        return json(res, 200, {
          count: events.length,
          hazard: hazardFilter || null,
          byHazard,
          lastEvents: events.slice(0, 8).map((e) => ({ id: e.id, type: e.type, hazard: e.hazard ?? e.type, date: e.date, year: e.year, title: e.title, summary: e.summary ?? null, emergencyStatus: e.emergencyStatus ?? null, district: e.district ?? null, source: e.source })),
          source: 'curated-public-reports',
        })
      }
      // F8 — laporan warga (POST simpan + relay Telegram #55; GET riwayat 7 hari)
      if (path === '/api/reports') {
        if (req.method === 'POST') {
          // F-36: kunci rate limit tidak boleh berasal dari header yang ditulis klien.
          const ip = clientIp(req)
          if (rateLimited(ip)) return json(res, 429, { error: 'batas 5 laporan/jam terlampaui' })
          let body = ''
          for await (const chunk of req) {
            body += chunk
            if (body.length > 10_000) return json(res, 413, { error: 'payload terlalu besar' })
          }
          const parsed = validateReport(safeJson(body))
          if (parsed.error) return json(res, 400, { error: parsed.error })
          const result = await submitReport(parsed.report)
          return json(res, 201, result)
        }
        const location = url.searchParams.get('location')
        if (location && !VALID_LOCATIONS.has(location)) {
          return json(res, 400, { error: "parameter 'location' harus id lokasi yang valid" })
        }
        const reports = recentReports(location)
        return json(res, 200, { count: reports.length, reports })
      }
      // Audit F-03 — /api/cache/flush sebelumnya terbuka: siapa pun yang bisa menjangkau
      // /api/* dapat mengosongkan cache produksi dan memicu puluhan fetch upstream.
      // Aturan: token cron bila ALERTS_CRON_TOKEN diset; tanpa token, hanya permintaan
      // langsung dari loopback yang tidak melewati proxy (tanpa header Cloudflare).
      if (path === '/api/cache/flush') {
        if (req.method !== 'POST') return json(res, 405, { error: 'gunakan POST' })
        const expected = process.env.ALERTS_CRON_TOKEN
        const viaProxy = Boolean(
          req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-for'] || req.headers['x-real-ip'],
        )
        const remote = req.socket?.remoteAddress ?? ''
        const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
        const allowed = expected ? tokenMatches(req.headers['x-cron-token'], expected) : (loopback && !viaProxy)
        if (!allowed) return json(res, 403, { error: 'flush cache butuh token cron (x-cron-token) dari host lokal' })
        clearCache()
        return json(res, 200, { ok: true })
      }
      return json(res, 404, { error: 'not found' })
    } catch (err) {
      console.error(`[api] ${path}:`, err.message)
      return json(res, 502, { error: err.message })
    }
  }
}
