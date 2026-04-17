import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import SortableTable, { Column } from '../SortableTable'
import { AssetStats } from '../../utils/analytics'
import { formatCurrency, formatPct } from '../../utils/analytics'

interface Props {
  stats: AssetStats[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const v = payload[0].value as number
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
        <p className="font-semibold text-gray-200">{label}</p>
        <p className={v >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(v)}</p>
      </div>
    )
  }
  return null
}

export default function AssetsTab({ stats }: Props) {
  const sorted = [...stats].sort((a, b) => b.netProfit - a.netProfit)
  const top10 = sorted.slice(0, 10)
  const bottom10 = [...stats].sort((a, b) => a.netProfit - b.netProfit).slice(0, 10).reverse()

  const columns: Column<AssetStats>[] = [
    { key: 'symbol', label: 'Symbol', sortValue: r => r.symbol },
    {
      key: 'netProfit', label: 'Net Profit',
      render: r => (
        <span className={r.netProfit >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
          {formatCurrency(r.netProfit)}
        </span>
      ),
      sortValue: r => r.netProfit,
    },
    { key: 'trades', label: 'Trades', sortValue: r => r.trades },
    {
      key: 'winRate', label: 'Win Rate',
      render: r => (
        <span className={r.winRate >= 50 ? 'text-emerald-400' : 'text-orange-400'}>
          {formatPct(r.winRate)}
        </span>
      ),
      sortValue: r => r.winRate,
    },
    {
      key: 'avgPerTrade', label: 'Avg/Trade',
      render: r => (
        <span className={r.avgPerTrade >= 0 ? 'text-emerald-300' : 'text-red-300'}>
          {formatCurrency(r.avgPerTrade)}
        </span>
      ),
      sortValue: r => r.avgPerTrade,
    },
    { key: 'wins', label: 'Wins', render: r => <span className="text-emerald-400">{r.wins}</span>, sortValue: r => r.wins },
    { key: 'losses', label: 'Losses', render: r => <span className="text-red-400">{r.losses}</span>, sortValue: r => r.losses },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 10 Activos por Net Profit</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top10} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <XAxis
                dataKey="symbol"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                {top10.map((entry, i) => (
                  <Cell key={i} fill={entry.netProfit >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom 10 chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Peores 10 Activos por Net Profit</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bottom10} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <XAxis
                dataKey="symbol"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                {bottom10.map((entry, i) => (
                  <Cell key={i} fill={entry.netProfit >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Todos los activos</h3>
        <SortableTable
          columns={columns}
          data={stats}
          rowKey={r => r.symbol}
        />
      </div>
    </div>
  )
}
