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

const columns: Column<Trade>[] = [
  { key: 'Ticket', label: 'Ticket', sortValue: r => r.Ticket },
  { key: 'Login', label: 'Login', sortValue: r => r.Login },
  {
    key: 'Name', label: 'Nombre / Email',
    render: r => (
      <div>
        <div className="text-gray-400 text-xs">{r.Name.replace('OGM International Ltd - ', '').trim()}</div>
        {r.Email && <div className="text-indigo-400 text-[10px] font-mono">{r.Email}</div>}
      </div>
    ),
    sortValue: r => r.Name,
  },
  { key: 'Symbol', label: 'Symbol', sortValue: r => r.Symbol },
  {
    key: 'Type', label: 'Side',
    render: r => (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.Type === 'buy' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
        {r.Type.toUpperCase()}
      </span>
    ),
    sortValue: r => r.Type,
  },
  { key: 'Volume', label: 'Vol', sortValue: r => r.Volume },
  {
    key: 'NetProfit', label: 'Net Profit',
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

export default function AllTradesTab({ trades }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">
          Todos los Trades
          <span className="ml-2 text-xs text-gray-500 font-normal">({trades.length.toLocaleString()} registros)</span>
        </h3>
      </div>
      <SortableTable
        columns={columns}
        data={trades}
        rowKey={r => r.Ticket}
      />
    </div>
  )
}
