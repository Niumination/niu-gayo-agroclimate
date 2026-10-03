/**
 * F5 — Nowcast resmi BMKG (ADR-10).
 * Sumber: RSS feed resmi https://www.bmkg.go.id/alerts/nowcast/id
 * (CAP/Common Alerting Protocol, terdokumentasi di data.bmkg.go.id/peringatan-dini-cuaca).
 * Parse XML sederhana via regex (tanpa dependensi). Filter: peringatan provinsi Aceh.
 * Atribusi wajib: "BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)".
 */

export const BMKG_RSS_URL = 'https://www.bmkg.go.id/alerts/nowcast/id'
export const BMKG_SOURCE_URL = 'https://data.bmkg.go.id/peringatan-dini-cuaca/'

/** Decode entitas XML minimal. */
function decodeXml(s) {
  return (s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function pickTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return m ? decodeXml(m[1].trim()) : ''
}

/**
 * Parse RSS nowcast BMKG → array item { title, link, description, pubDate, isAceh }.
 * Murni (tanpa fetch) agar mudah di-test dengan fixture.
 */
export function parseBmkgRss(xml) {
  const items = []
  const blocks = String(xml).split(/<item>/).slice(1)
  for (const block of blocks) {
    const item = {
      title: pickTag(block, 'title'),
      link: pickTag(block, 'link'),
      description: pickTag(block, 'description'),
      pubDate: pickTag(block, 'pubDate'),
    }
    if (!item.title) continue
    item.isAceh = /di\s+Aceh\b/i.test(item.title) || /\bAceh\b/i.test(item.title)
    items.push(item)
  }
  return items
}

/** Kecamatan sentra (map nama BMKG → id lokasi internal). */
const KECEMATAN_MAP = {
  BEBESEN: 'bebesan', 'DANAU LAUT TAWAR': 'luttawar', LAUT: 'luttawar',
  TAKENGON: 'takengon', 'KUTE PANANG': 'kutepanang', ATULINTANG: 'atulintang',
  'JAGONG JEGET': 'jagongjeget', PEGASING: 'pegasing', BIES: 'bies',
  BINTANG: 'bintang', KEBAYAKAN: 'kebayakan', 'SILIH NARA': 'silihnara',
  KETOL: 'ketol', CELALA: 'celala', LINGE: 'linge', 'RUSIP ANTARA': 'rusipantara',
}

/** Kecamatan mana dari sentra yang terdampak dalam teks peringatan. */
export function affectedLocations(description) {
  const up = String(description).toUpperCase()
  const hits = []
  for (const [name, id] of Object.entries(KECEMATAN_MAP)) {
    if (up.includes(name)) {
      if (!hits.includes(id)) hits.push(id)
    }
  }
  return hits
}

/**
 * Fetch + filter RSS. Return:
 * { authority: 'BMKG', retrievedAt, active, alerts: [{title, description, link, pubDate, affectedLocations}], source }
 * Tidak pernah throw — error menghasilkan { active:false, degraded:true }.
 */
export async function fetchBmkgNowcast({ fetchImpl = fetch, url = BMKG_RSS_URL } = {}) {
  try {
    const resp = await fetchImpl(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) throw new Error(`BMKG RSS HTTP ${resp.status}`)
    const xml = await resp.text()
    const aceh = parseBmkgRss(xml)
      .filter((i) => i.isAceh)
      .map((i) => ({ ...i, affectedLocations: affectedLocations(i.description) }))
    return {
      authority: 'BMKG',
      retrievedAt: new Date().toISOString(),
      source: BMKG_SOURCE_URL,
      active: aceh.length > 0,
      alerts: aceh,
      degraded: false,
    }
  } catch (err) {
    return {
      authority: 'BMKG',
      retrievedAt: new Date().toISOString(),
      source: BMKG_SOURCE_URL,
      active: false,
      alerts: [],
      degraded: true,
      error: err?.message ?? String(err),
    }
  }
}
