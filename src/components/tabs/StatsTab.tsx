import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts'
import { GeneralStats, formatCurrency, formatDuration, formatPct } from '../../utils/analytics'
import KpiCard from '../KpiCard'

interface Props {
  stats: GeneralStats
}

export default function StatsTab({ stats }: Props) {
  const maxVol = Math.max(...stats.volumeByHour.map(h => h.count), 1)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Trades"
          value={stats.totalTrades.toLocaleString()}
          color="blue"
        />
        <KpiCard
          title="Cuentas Activas"
          value={stats.activeAccounts.toLocaleString()}
          color="blue"
        />
        <KpiCard
          title="Win Rate Global"
          value={formatPct(stats.winRate)}
          sub={`${stats.totalTrades} trades evaluados`}
          color={stats.winRate >= 50 ? 'green' : 'yellow'}
        />
        <KpiCard
          title="Duración Promedio"
          value={formatDuration(stats.avgDurationMs)}
          color="purple"
        />
      </div>

      {/* P&L breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Profit (col Q)"
          value={formatCurrency(stats.totalProfit)}
          color={stats.totalProfit >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Swap (col P)"
          value={formatCurrency(stats.totalSwap)}
          color={stats.totalSwap >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Comisiones (col N)"
          value={formatCurrency(stats.totalCommission)}
          color={stats.totalCommission >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Volume by hour heatmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Volumen de Trades por Hora (UTC)</h3>
        <div className="flex gap-1 flex-wrap">
          {stats.volumeByHour.map(({ hour, count }) => {
            const intensity = count / maxVol
            const alpha = Math.max(0.1, intensity)
            return (
              <div key={hour} className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-10 rounded-md flex items-end justify-center pb-1 transition-all"
                  style={{
                    backgroundColor: `rgba(99, 102, 241, ${alpha})`,
                    border: `1px solid rgba(99, 102, 241, ${alpha * 0.5 + 0.1})`,
                  }}
                  title={`${hour}:00 — ${count} trades`}
                >
                  {count > 0 && (
                    <span className="text-[9px] text-indigo-200 font-semibold leading-none">{count}</span>
                  )}
                </div>
                <span className="text-[10px] text-gray-600">{hour.toString().padStart(2, '0')}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Profit by hour chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Net Profit Acumulado por Hora</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.profitByHour} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="hour"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={v => `${v}h`}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number) => [formatCurrency(v), 'Net Profit']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
            />
            <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
              {stats.profitByHour.map((entry, i) => (
                <Cell key={i} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
