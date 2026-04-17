import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import SortableTable, { Column } from '../SortableTable'
import { SideStats, formatCurrency, formatPct } from '../../utils/analytics'

interface Props {
  stats: SideStats[]
}

export default function SidesTab({ stats }: Props) {
  // Win rate chart: buy vs sell per symbol (top 15 by trades)
  const bySymbol = new Map<string, { symbol: string; buyWR: number; sellWR: number; buyTrades: number; sellTrades: number }>()
  for (const s of stats) {
    if (!bySymbol.has(s.symbol)) {
      bySymbol.set(s.symbol, { symbol: s.symbol, buyWR: 0, sellWR: 0, buyTrades: 0, sellTrades: 0 })
    }
    const entry = bySymbol.get(s.symbol)!
    if (s.side === 'buy') { entry.buyWR = s.winRate; entry.buyTrades = s.trades }
    if (s.side === 'sell') { entry.sellWR = s.winRate; entry.sellTrades = s.trades }
  }
  const chartData = Array.from(bySymbol.values())
    .sort((a, b) => (b.buyTrades + b.sellTrades) - (a.buyTrades + a.sellTrades))
    .slice(0, 15)

  const top5 = [...stats]
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 5)

  const columns: Column<SideStats>[] = [
    { key: 'symbol', label: 'Symbol' },
    {
      key: 'side', label: 'Side',
      render: r => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.side === 'buy' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
          {r.side.toUpperCase()}
        </span>
      ),
    },
    { key: 'trades', label: 'Trades', sortValue: r => r.trades },
    {
      key: 'netProfit', label: 'Net Profit',
      render: r => (
        <span className={r.netProfit >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
          {formatCurrency(r.netProfit)}
        </span>
      ),
      sortValue: r => r.netProfit,
    },
    {
      key: 'winRate', label: 'Win Rate',
      render: r => (
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${r.winRate >= 50 ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${r.winRate}%` }}
            />
          </div>
          <span className={r.winRate >= 50 ? 'text-emerald-400' : 'text-orange-400'}>
            {formatPct(r.winRate)}
          </span>
        </div>
      ),
      sortValue: r => r.winRate,
    },
    {
      key: 'avgProfit', label: 'Avg/Trade',
      render: r => (
        <span className={r.avgProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}>
          {formatCurrency(r.avgProfit)}
        </span>
      ),
      sortValue: r => r.avgProfit,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Top 5 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 5 Combinaciones Lado/Activo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {top5.map((s, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-100 text-sm">{s.symbol}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${s.side === 'buy' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
                  {s.side.toUpperCase()}
                </span>
              </div>
              <p className="text-emerald-400 font-bold text-sm">{formatCurrency(s.netProfit)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.trades} trades · {formatPct(s.winRate)} WR</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Win Rate BUY vs SELL por Activo (top 15)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 50 }}>
            <XAxis dataKey="symbol" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'buyWR' ? 'Buy WR' : 'Sell WR']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
            />
            <Legend formatter={v => v === 'buyWR' ? 'Buy Win Rate' : 'Sell Win Rate'} />
            <Bar dataKey="buyWR" name="buyWR" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="sellWR" name="sellWR" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Detalle por Lado y Activo</h3>
        <SortableTable
          columns={columns}
          data={stats}
          rowKey={r => `${r.symbol}_${r.side}`}
        />
      </div>
    </div>
  )
}
