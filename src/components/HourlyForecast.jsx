import React from 'react'

export default function HourlyForecast({ hourly }) {
  if (!hourly || hourly.length === 0) return null

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Tren Per Jam (12 Jam Kedepan)</h2>
          <p className="text-xs text-slate-400">Prakiraan suhu, curah hujan, dan radiasi surya</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex items-center space-x-3 min-w-[650px]">
          {hourly.map((item, idx) => (
            <div
              key={idx}
              className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center flex flex-col justify-between"
            >
              <span className="text-xs font-mono text-slate-400 block mb-1">{item.time}</span>
              <span className="text-sm font-bold text-slate-100 block mb-2">{item.temp}°C</span>
              
              <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Hujan:</span>
                  <span className={`font-mono ${item.rain > 0 ? 'text-cyan-400 font-semibold' : 'text-slate-500'}`}>
                    {item.rain} mm
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Surya:</span>
                  <span className={`font-mono ${item.solar > 200 ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
                    {Math.round(item.solar)} W/m²
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
