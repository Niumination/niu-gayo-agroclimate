/**
 * Fase 1.6b — proyeksi & bantuan geometri untuk peta skematik SVG (tanpa pustaka peta).
 * Proyeksi ekuirektangular berskala cos(lat tengah) — cukup akurat untuk bbox ~1° di ekuator.
 */
export function makeProjection(bbox, { width = 600, height = 440, padding = 16 } = {}) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const midLat = (minLat + maxLat) / 2
  const kx = Math.cos((midLat * Math.PI) / 180)
  const w = (maxLon - minLon) * kx
  const h = maxLat - minLat
  const scale = Math.min((width - 2 * padding) / w, (height - 2 * padding) / h)
  const ox = (width - w * scale) / 2
  const oy = (height - h * scale) / 2
  const project = (lon, lat) => [ox + (lon - minLon) * kx * scale, oy + (maxLat - lat) * scale]
  /** km → piksel (pada lintang tengah). */
  const kmToPx = (km) => (km / 111.32) * scale
  return { project, kmToPx, width, height, scale }
}

/** GeoJSON Polygon/MultiPolygon → atribut `d` path SVG. */
export function geometryToPath(geometry, project, digits = 1) {
  if (!geometry) return ''
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  const f = (n) => Number(n.toFixed(digits))
  let d = ''
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat)
        d += `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`
      })
      d += 'Z'
    }
  }
  return d
}

/** Bbox [minLon, minLat, maxLon, maxLat] dari FeatureCollection. */
export function featureBbox(features) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    } else coords.forEach(visit)
  }
  for (const f of features) if (f.geometry) visit(f.geometry.coordinates)
  return [minLon, minLat, maxLon, maxLat]
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Gunung api Burni Telong (PVMBG): puncak 4,769 LU 96,821 BT; Level II (Waspada) radius rekomendasi 3 km (Sep 2026). */
export const BURNI_TELONG = { name: 'Burni Telong', lat: 4.769, lon: 96.821, level: 'II (Waspada)', radiusKm: 3, source: 'PVMBG/MAGMA Indonesia' }

/**
 * Penempatan label sederhana anti-tumpang tindih (greedy): coba kanan → kiri → bawah → atas; lewati bila tetap bertabrakan.
 * @param {Array<{id:string,x:number,y:number,text:string,priority:number,force?:boolean}>} points prioritas lebih tinggi ditempatkan lebih dulu;
 *   `force: true` = label wajib tampil (dipakai untuk sentra terpilih) meski bertabrakan
 * @returns {Record<string,{x:number,y:number,anchor:string}|null>} posisi label per id (null = disembunyikan)
 */
export function placeLabels(points, { fontSize = 8.5, charW = 0.55, gap = 7, boxes = [] } = {}) {
  const placed = [...boxes]
  const out = {}
  const h = fontSize
  const hit = (b) => placed.some((o) => !(b.x2 < o.x1 || b.x1 > o.x2 || b.y2 < o.y1 || b.y1 > o.y2))
  const sorted = [...points].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  for (const p of sorted) {
    const w = p.text.length * fontSize * charW
    const cands = [
      { x: p.x + gap, y: p.y + h * 0.35, anchor: 'start', box: { x1: p.x + gap, x2: p.x + gap + w, y1: p.y - h / 2, y2: p.y + h / 2 } },
      { x: p.x - gap, y: p.y + h * 0.35, anchor: 'end', box: { x1: p.x - gap - w, x2: p.x - gap, y1: p.y - h / 2, y2: p.y + h / 2 } },
      { x: p.x, y: p.y + gap + h * 0.9, anchor: 'middle', box: { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y + gap, y2: p.y + gap + h } },
      { x: p.x, y: p.y - gap - h * 0.2, anchor: 'middle', box: { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y - gap - h, y2: p.y - gap } },
    ]
    // `force` hanya untuk label yang tidak boleh hilang (sentra terpilih):
    // kalau keempat posisi bertabrakan, pakai posisi kanan apa adanya.
    const ok = cands.find((c) => !hit(c.box)) ?? (p.force ? cands[0] : null)
    if (ok) {
      placed.push(ok.box)
      out[p.id] = { x: ok.x, y: ok.y, anchor: ok.anchor }
    } else out[p.id] = null
  }
  // kotak titik (agar label lain tidak menutupi titik)
  return out
}
