import React from 'react'
import { Trade } from '../../utils/dataParser'
import { formatCurrency, formatDuration } from '../../utils/analytics'
import SortableTable, { Column } from '../SortableTable'

interface Props {
  trades: Trade[]
}

// "2026.04.07 07:54:58.725" → "2026.04.07 07:54:58"
function fmtDate(s: string): string {
  return s.replace(/(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\.\d+/, '$1')
}

function tradeColumns(label: string): Column<Trade>[] {
  return [
    { key: 'Ticket', label: 'Ticket' },
    { key: 'Login', label: 'Login' },
    {
      key: 'Name', label: 'Nombre / Email',
      render: r => (
        <div>
          <div className="text-gray-400 text-xs">{r.Name.replace('OGM International Ltd - ', '').trim()}</div>
          {r.Email && <div className="text-indigo-400 text-[10px] font-mono">{r.Email}</div>}
        </div>
      ),
    },
    { key: 'Symbol', label: 'Symbol' },
    {
      key: 'Type', label: 'Side',
      render: r => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.Type === 'buy' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
          {r.Type.toUpperCase()}
        </span>
      ),
    },
    { key: 'Volume', label: 'Vol', sortValue: r => r.Volume },
    {
      key: 'NetProfit', label: label,
      render: r => (
        <span className={`font-bold ${r.NetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatCurrency(r.NetProfit)}
        </span>
      ),
      sortValue: r => r.NetProfit,
    },
    {
      key: 'PnlPercent', label: 'P&L %',
      render: r => r.PnlPercent !== null
        ? <span className={r.PnlPercent >= 0 ? 'text-emerald-300' : 'text-red-300'}>{r.PnlPercent.toFixed(2)}%</span>
        : <span className="text-gray-600">N/A</span>,
      sortValue: r => r.PnlPercent ?? -Infinity,
    },
    {
      key: 'Balance', label: 'Cuenta $',
      render: r => r.Balance !== null
        ? <span className="text-gray-300">{formatCurrency(r.Balance)}</span>
        : <span className="text-gray-600">N/A</span>,
      sortValue: r => r.Balance ?? -Infinity,
    },
    {
      key: 'DurationMs', label: 'Duración',
      render: r => <span className="text-gray-400 text-xs">{formatDuration(r.DurationMs)}</span>,
      sortValue: r => r.DurationMs,
    },
    {
      key: 'Time', label: 'Apertura',
      render: r => <span className="text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.Time)}</span>,
      sortValue: r => r.Time,
    },
    {
      key: 'CloseTime', label: 'Cierre',
      render: r => <span className="text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.CloseTime)}</span>,
      sortValue: r => r.CloseTime,
    },
  ]
}

export default function ExtremeTradesTab({ trades }: Props) {
  const sorted = [...trades].sort((a, b) => b.NetProfit - a.NetProfit)
  const top10 = sorted.slice(0, 10)
  const bottom10 = sorted.slice(-10).reverse()

  return (
    <div className="space-y-8">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">Top 10 Trades Ganadores</h3>
        <SortableTable
          columns={tradeColumns('Net Profit')}
          data={top10}
          rowKey={r => r.Ticket}
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-red-400 mb-4">Top 10 Trades Perdedores</h3>
        <SortableTable
          columns={tradeColumns('Net P&L')}
          data={bottom10}
          rowKey={r => r.Ticket}
        />
      </div>
    </div>
  )
}
