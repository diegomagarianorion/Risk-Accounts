import React, { useState } from 'react'
import { SuspiciousGroup } from '../../utils/copyDetection'
import { formatCurrency, formatDuration } from '../../utils/analytics'

interface Props {
  groups: SuspiciousGroup[]
}

const riskColors = {
  ALTO:  { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-800',    dot: 'bg-red-500'    },
  MEDIO: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-800', dot: 'bg-yellow-500' },
  BAJO:  { bg: 'bg-blue-900/30',   text: 'text-blue-300',   border: 'border-blue-800',   dot: 'bg-blue-500'   },
}

const patternLabels = {
  COPY_EXACT: { label: 'Copy Exacto', color: 'text-orange-400' },
  HEDGING:    { label: 'Hedging',     color: 'text-purple-400' },
  MIXED:      { label: 'Mixto',       color: 'text-yellow-400' },
}

function fmtDate(s: string): string {
  return s.replace(/(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\.\d+/, '$1')
}

const HIGHLIGHT_TD        = 'bg-indigo-950/60 ring-1 ring-inset ring-indigo-700/50'
const HIGHLIGHT_SIDE_BUY  = 'bg-emerald-950/70 ring-1 ring-inset ring-emerald-700/60'
const HIGHLIGHT_SIDE_SELL = 'bg-red-950/70 ring-1 ring-inset ring-red-700/60'

function ClientBadge({ crossClient }: { crossClient: boolean }) {
  return crossClient
    ? (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-900/60 text-red-300 border border-red-700">
        ⚠ CLIENTES DIFERENTES
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-800 text-gray-400 border border-gray-700">
        MISMO CLIENTE
      </span>
    )
}

function GroupTable({ g }: { g: SuspiciousGroup }) {
  return (
    <div className="overflow-x-auto scrollbar-thin rounded-xl border border-gray-700">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="bg-gray-800 border-b border-gray-700">
            <Th>Login / Email</Th>
            <Th highlight>Side ★</Th>
            <Th>Volumen</Th>
            <Th>P. Apertura</Th>
            <Th>P. Cierre</Th>
            <Th>Stop Loss</Th>
            <Th>Take Profit</Th>
            <Th highlight>Apertura ★</Th>
            <Th highlight>Cierre ★</Th>
            <Th>Duración</Th>
            <Th>Razón</Th>
            <Th>Profit Bruto</Th>
            <Th>Comisión</Th>
            <Th>Fee</Th>
            <Th>Swap</Th>
            <Th>Net Profit</Th>
            <Th>Cuenta $</Th>
          </tr>
        </thead>
        <tbody>
          {g.trades.map((t, i) => {
            const isBuy = t.Type === 'buy'
            const rowBase = i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'
            return (
              <tr key={t.Ticket} className={`${rowBase} border-b border-gray-800/60 hover:brightness-110 transition-all`}>
                {/* Login + email */}
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-gray-200">{t.Login}</div>
                  <div className="text-gray-500 text-[10px] truncate max-w-[160px]">
                    {t.Name.replace('OGM International Ltd - ', '').trim()}
                  </div>
                  {t.Email && (
                    <div className="text-indigo-400 text-[10px] truncate max-w-[160px] mt-0.5">
                      {t.Email}
                    </div>
                  )}
                </td>

                <td className={`px-3 py-2.5 ${isBuy ? HIGHLIGHT_SIDE_BUY : HIGHLIGHT_SIDE_SELL}`}>
                  <span className={`px-2 py-1 rounded font-bold text-xs ${isBuy ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-900/80 text-red-300'}`}>
                    {t.Type.toUpperCase()}
                  </span>
                </td>

                <td className="px-3 py-2.5 text-gray-300">{t.Volume}</td>
                <td className="px-3 py-2.5 text-gray-300 font-mono">{t.Price}</td>
                <td className="px-3 py-2.5 text-gray-300 font-mono">{t.ClosePrice}</td>
                <td className="px-3 py-2.5 text-gray-400">{t.SL > 0 ? t.SL : '—'}</td>
                <td className="px-3 py-2.5 text-gray-400">{t.TP > 0 ? t.TP : '—'}</td>

                <td className={`px-3 py-2.5 font-mono text-indigo-200 ${HIGHLIGHT_TD}`}>{fmtDate(t.Time)}</td>
                <td className={`px-3 py-2.5 font-mono text-indigo-200 ${HIGHLIGHT_TD}`}>{fmtDate(t.CloseTime)}</td>

                <td className="px-3 py-2.5 text-gray-400">{formatDuration(t.DurationMs)}</td>
                <td className="px-3 py-2.5 text-gray-500">{t.Reason || '—'}</td>

                <td className={`px-3 py-2.5 font-medium ${t.Profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(t.Profit)}
                </td>
                <td className={`px-3 py-2.5 ${t.Commission < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                  {formatCurrency(t.Commission)}
                </td>
                <td className={`px-3 py-2.5 ${t.Fee < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                  {formatCurrency(t.Fee)}
                </td>
                <td className={`px-3 py-2.5 ${t.Swap < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                  {formatCurrency(t.Swap)}
                </td>
                <td className={`px-3 py-2.5 font-bold ${t.NetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(t.NetProfit)}
                  {t.PnlPercent !== null && (
                    <span className="block text-[10px] font-normal opacity-60">{t.PnlPercent.toFixed(2)}%</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-300">
                  {t.Balance !== null ? formatCurrency(t.Balance) : <span className="text-gray-600">N/A</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-800/60 border-t border-gray-700 text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-950/80 ring-1 ring-indigo-700/50" />
          Criterio de matching (apertura/cierre)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-950/70 ring-1 ring-emerald-700/60" />
          BUY
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-950/70 ring-1 ring-red-700/60" />
          SELL
        </span>
        <span className="text-indigo-400">● Email del cliente</span>
      </div>
    </div>
  )
}

function Th({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <th className={`px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px]
      ${highlight ? 'text-indigo-300 bg-indigo-950/40' : 'text-gray-500'}`}>
      {children}
    </th>
  )
}

const TIME_OPTIONS = [
  { label: '5s',    value: 5   },
  { label: '15s',   value: 15  },
  { label: '30s',   value: 30  },
  { label: '1min',  value: 60  },
  { label: '5min',  value: 300 },
  { label: '10min', value: 600 },
] as const

export default function CopyDetectionTab({ groups }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [riskFilter, setRiskFilter]       = useState<'ALL' | 'ALTO' | 'MEDIO' | 'BAJO'>('ALL')
  const [patternFilter, setPatternFilter] = useState<'ALL' | 'COPY_EXACT' | 'HEDGING' | 'MIXED'>('ALL')
  const [clientFilter, setClientFilter]   = useState<'ALL' | 'CROSS' | 'SAME'>('ALL')
  const [timeLimit, setTimeLimit]         = useState<5 | 15 | 30 | 60 | 300 | 600>(30)
  const [compareMode, setCompareMode]     = useState<'both' | 'open' | 'close'>('both')
  const [searchQuery, setSearchQuery]     = useState('')

  const matchesTime = (g: { openDeltaSecs: number; closeDeltaSecs: number }) => {
    if (compareMode === 'open')  return g.openDeltaSecs  <= timeLimit
    if (compareMode === 'close') return g.closeDeltaSecs <= timeLimit
    return g.openDeltaSecs <= timeLimit && g.closeDeltaSecs <= timeLimit
  }

  const matchesSearch = (g: SuspiciousGroup) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.trim().toLowerCase()
    return (
      g.accounts.some(a => a.toLowerCase().includes(q)) ||
      g.uniqueEmails.some(e => e.toLowerCase().includes(q))
    )
  }

  const filtered = groups.filter(g => {
    if (!matchesTime(g)) return false
    if (riskFilter  !== 'ALL' && g.riskLevel !== riskFilter) return false
    if (patternFilter !== 'ALL' && g.pattern !== patternFilter) return false
    if (clientFilter === 'CROSS' && !g.crossClient) return false
    if (clientFilter === 'SAME'  &&  g.crossClient) return false
    if (!matchesSearch(g)) return false
    return true
  })

  // Base filtered by time only (for per-filter counts)
  const byTime = groups.filter(g => matchesTime(g))

  const top5 = groups.slice(0, 5)
  const countByRisk = {
    ALTO:  byTime.filter(g => g.riskLevel === 'ALTO').length,
    MEDIO: byTime.filter(g => g.riskLevel === 'MEDIO').length,
    BAJO:  byTime.filter(g => g.riskLevel === 'BAJO').length,
  }
  const crossCount = byTime.filter(g => g.crossClient).length
  const sameCount  = byTime.filter(g => !g.crossClient).length

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['ALTO', 'MEDIO', 'BAJO'] as const).map(level => {
          const c = riskColors[level]
          return (
            <button key={level}
              onClick={() => setRiskFilter(riskFilter === level ? 'ALL' : level)}
              className={`${c.bg} border ${c.border} rounded-xl p-4 text-left transition-all
                ${riskFilter === level ? 'ring-2 ring-offset-1 ring-offset-gray-950 ring-current' : 'hover:opacity-80'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{level}</span>
              </div>
              <p className="text-2xl font-bold text-gray-100">{countByRisk[level]}</p>
              <p className="text-xs text-gray-500 mt-0.5">grupos</p>
            </button>
          )
        })}
      </div>

      {/* Top 5 */}
      {top5.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 5 Grupos Más Sospechosos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {top5.map(g => {
              const c = riskColors[g.riskLevel]
              const p = patternLabels[g.pattern]
              return (
                <div key={g.groupId} className={`${c.bg} border ${c.border} rounded-lg p-3`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-100">{g.symbol}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{g.riskLevel}</span>
                  </div>
                  <p className={`text-xs font-semibold ${p.color}`}>{p.label}</p>
                  <div className="mt-1">
                    <ClientBadge crossClient={g.crossClient} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{g.accounts.length} cuentas · {g.uniqueEmails.length} email{g.uniqueEmails.length > 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-500">Δopen: {g.openDeltaSecs.toFixed(1)}s · Δclose: {g.closeDeltaSecs.toFixed(1)}s</p>
                  <p className="text-xs text-gray-500">Score: {g.riskScore}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nº de cuenta o email…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {/* Time window */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">Tiempo:</span>
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTimeLimit(opt.value as 5 | 15 | 30 | 60 | 300 | 600)}
              className={`text-xs px-3 py-1 rounded-full border transition-all
                ${timeLimit === opt.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              ≤ {opt.label}
            </button>
          ))}
        </div>

        {/* Compare mode */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">Comparar:</span>
          {([
            { id: 'open',  label: 'Solo apertura' },
            { id: 'close', label: 'Solo cierre'   },
            { id: 'both',  label: 'Apertura y cierre' },
          ] as const).map(m => (
            <button key={m.id} onClick={() => setCompareMode(m.id)}
              className={`text-xs px-3 py-1 rounded-full border transition-all
                ${compareMode === m.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Risk */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">Riesgo:</span>
          {(['ALL', 'ALTO', 'MEDIO', 'BAJO'] as const).map(level => (
            <button key={level} onClick={() => setRiskFilter(level)}
              className={`text-xs px-3 py-1 rounded-full border transition-all
                ${riskFilter === level ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {level === 'ALL' ? `Todos (${byTime.length})` : `${level} (${countByRisk[level]})`}
            </button>
          ))}
        </div>

        {/* Pattern */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">Patrón:</span>
          {([
            { id: 'ALL',        label: 'Todos' },
            { id: 'COPY_EXACT', label: `Copy Exacto (${byTime.filter(g => g.pattern === 'COPY_EXACT').length})` },
            { id: 'HEDGING',    label: `Hedging (${byTime.filter(g => g.pattern === 'HEDGING').length})` },
            { id: 'MIXED',      label: `Mixto (${byTime.filter(g => g.pattern === 'MIXED').length})` },
          ] as const).map(p => (
            <button key={p.id} onClick={() => setPatternFilter(p.id)}
              className={`text-xs px-3 py-1 rounded-full border transition-all
                ${patternFilter === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Client filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">Cliente:</span>
          <button onClick={() => setClientFilter('ALL')}
            className={`text-xs px-3 py-1 rounded-full border transition-all
              ${clientFilter === 'ALL' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            Todos ({byTime.length})
          </button>
          <button onClick={() => setClientFilter('CROSS')}
            className={`text-xs px-3 py-1 rounded-full border transition-all
              ${clientFilter === 'CROSS' ? 'bg-red-700 border-red-600 text-white' : 'border-red-900 text-red-400 hover:border-red-700'}`}>
            ⚠ Clientes diferentes ({crossCount})
          </button>
          <button onClick={() => setClientFilter('SAME')}
            className={`text-xs px-3 py-1 rounded-full border transition-all
              ${clientFilter === 'SAME' ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            Mismo cliente ({sameCount})
          </button>
        </div>
      </div>

      {/* Detection count */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl">
        <span className="text-2xl font-bold text-indigo-400">{filtered.length}</span>
        <span className="text-sm text-gray-400">
          detección{filtered.length !== 1 ? 'es' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-gray-600 ml-1">con los filtros actuales (ventana ≤ {timeLimit}s)</span>
      </div>

      {/* Groups list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            No se encontraron grupos con los filtros actuales
          </div>
        )}

        {filtered.map(g => {
          const c = riskColors[g.riskLevel]
          const p = patternLabels[g.pattern]
          const isOpen = expandedId === g.groupId

          return (
            <div key={g.groupId} className={`border ${c.border} rounded-xl overflow-hidden`}>
              <button
                className={`w-full ${c.bg} px-5 py-3.5 flex items-center gap-4 hover:opacity-90 transition-opacity text-left`}
                onClick={() => setExpandedId(isOpen ? null : g.groupId)}
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />

                <div className="flex-1 min-w-0">
                  {/* Top row */}
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="font-bold text-gray-100">{g.symbol}</span>
                    <span className={`text-xs font-semibold ${p.color}`}>{p.label}</span>
                    <ClientBadge crossClient={g.crossClient} />
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-x-4 gap-y-0.5 text-xs">
                    <div><span className="text-gray-500">Grupo </span><span className="text-gray-300 font-semibold">#{g.groupId}</span></div>
                    <div><span className="text-gray-500">Cuentas </span><span className="text-gray-300 font-semibold">{g.accounts.length}</span></div>
                    <div><span className="text-gray-500">Emails únicos </span><span className={`font-semibold ${g.crossClient ? 'text-red-300' : 'text-gray-400'}`}>{g.uniqueEmails.length}</span></div>
                    <div><span className="text-gray-500">Δopen </span><span className="text-gray-300">{g.openDeltaSecs.toFixed(1)}s</span></div>
                    <div><span className="text-gray-500">Δclose </span><span className="text-gray-300">{g.closeDeltaSecs.toFixed(1)}s</span></div>
                    <div><span className="text-gray-500">Score </span><span className={`font-bold ${c.text}`}>{g.riskScore}</span></div>
                  </div>
                  {/* Emails preview */}
                  {g.uniqueEmails.length > 0 && (
                    <div className="mt-1 flex gap-2 flex-wrap">
                      {g.uniqueEmails.map(email => (
                        <span key={email} className="text-[10px] text-indigo-400 font-mono">{email}</span>
                      ))}
                    </div>
                  )}
                </div>

                <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${c.bg} ${c.text} border ${c.border}`}>
                  {g.riskLevel}
                </span>
                <span className="text-gray-500 flex-shrink-0 ml-2">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="bg-gray-900/80 border-t border-gray-800 p-4">
                  <GroupTable g={g} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
