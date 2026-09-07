import React from 'react'

export default function MetricCard({ title, value, unit, subtitle, badge, statusColor = 'text-slate-100', icon }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="flex items-baseline space-x-1.5">
        <span className={`text-2xl font-bold tracking-tight ${statusColor}`}>{value}</span>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </div>
      {(subtitle || badge) && (
        <div className="mt-2 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
          {badge && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${badge}`}>
              Status
            </span>
          )}
        </div>
      )}
    </div>
  )
}
