import React from 'react'

// Grafik hujan SVG ringan (tanpa recharts) — 24 jam, batang mm/jam.
// Props: data = [{ time: 'HH:MM', rain: number }], labelRain, labelNow (index jam sekarang)
export default function RainChart({ data = [], labelRain = 'Hujan' }) {
  if (!data.length) return null
  const W = 720
  const H = 160
  const padL = 34
  const padB = 22
  const padT = 12
  const maxRain = Math.max(1, ...data.map((d) => d.rain ?? 0))
  const bw = (W - padL - 8) / data.length

  const y = (v) => H - padB - (v / maxRain) * (H - padB - padT)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Grafik ${labelRain} 24 jam, maksimum ${maxRain.toFixed(1)} mm/jam`}
        className="w-full min-w-[560px]"
      >
        {/* gridlines 25/50/75/100% */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL}
              x2={W - 4}
              y1={y(maxRain * f)}
              y2={y(maxRain * f)}
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeDasharray="3 4"
            />
            <text x={padL - 6} y={y(maxRain * f) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5">
              {(maxRain * f).toFixed(0)}
            </text>
          </g>
        ))}
        {/* batang */}
        {data.map((d, i) => {
          const v = d.rain ?? 0
          const h = Math.max(v > 0 ? 2 : 0, y(0) - y(v))
          return (
            <rect
              key={i}
              x={padL + i * bw + 1}
              y={y(v)}
              width={Math.max(1.5, bw - 2)}
              height={h}
              rx="1.5"
              className={v >= 5 ? 'fill-cyan-400' : v > 0 ? 'fill-cyan-600' : 'fill-slate-700'}
            >
              <title>{`${d.time} — ${v} mm`}</title>
            </rect>
          )
        })}
        {/* sumbu x */}
        <line x1={padL} x2={W - 4} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.3" />
        {data.map((d, i) =>
          i % 4 === 0 ? (
            <text
              key={i}
              x={padL + i * bw + bw / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity="0.6"
            >
              {d.time}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}
