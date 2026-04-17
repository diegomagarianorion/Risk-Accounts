import React, { useState } from 'react'
import { EAGroup } from '../../utils/eaDetection'
import { formatCurrency, formatDuration } from '../../utils/analytics'

interface Props {
  groups: EAGroup[]
}

function fmtDate(s: string): string {
  return s.replace(/(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\.\d+/, '$1')
}

const riskColors = {
  ALTO:  { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-800',    dot: 'bg-red-500'    },
  MEDIO: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-800', dot: 'bg-yellow-500' },
  BAJO:  { bg: 'bg-blue-900/30',   text: 'text-blue-300',   border: 'border-blue-800',   dot: 'bg-blue-500'   },
}

const matchColors = {
  EXACT:   { label: 'Exacto',  cls: 'bg-orange-900/50 text-orange-300 border-orange-800' },
  PATTERN: { label: 'Patrón',  cls: 'bg-purple-900/50 text-purple-300 border-purple-800' },
}

function ClientBadge({ crossClient }: { crossClient: boolean }) {
  return crossClient
    ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-900/60 text-red-300 border border-red-700">⚠ CLIENTES DIFERENTES</span>
    : <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-800 text-gray-400 border border-gray-700">MISMO CLIENTE</span>
}

export default function EADetectionTab({ groups }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [riskFilter, setRiskFilter]   = useState<'ALL' | 'ALTO' | 'MEDIO' | 'BAJO'>('ALL')
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'EXACT' | 'PATTERN'>('ALL')
  const [clientFilter, setClientFilter] = useState<'ALL' | 'CROSS' | 'SAME'>('ALL')
  const [searchQuery, setSearchQuery]   = useState('')

  const matchesSearch = (g: EAGroup) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.trim().toLowerCase()
    return (
      g.accounts.some(a => a.toLowerCase().includes(q)) ||
      g.uniqueEmails.some(e => e.toLowerCase().includes(q)) ||
      g.accountEmails.some(e => e.toLowerCase().includes(q))
    )
  }

  const filtered = groups.filter(g => {
    if (riskFilter  !== 'ALL' && g.riskLevel  !== riskFilter)  return false
    if (matchFilter !== 'ALL' && g.matchType  !== matchFilter)  return false
    if (clientFilter === 'CROSS' && !g.crossClient) return false
    if (clientFilter === 'SAME'  &&  g.crossClient) return false
    if (!matchesSearch(g)) return false
    return true
  })

  const countByRisk = {
    ALTO:  groups.filter(g => g.riskLevel === 'ALTO').length,
    MEDIO: groups.filter(g => g.riskLevel === 'MEDIO').length,
    BAJO:  groups.filter(g => g.riskLevel === 'BAJO').length,
  }
  const crossCount = groups.filter(g => g.crossClient).length
  const sameCount  = groups.filter(g => !g.crossClient).length

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          Detecta cuentas que usan el mismo <strong className="text-gray-200">Expert Advisor (EA)</strong> agrupando por comentario de trade.
          Cuando múltiples cuentas tienen comentarios idénticos o con el mismo patrón (mismo nombre de EA, diferente número de ticket),
          se considera que operan con el mismo robot.
          <span className="ml-2 text-orange-400 font-medium">★ Exacto</span> = comentario 100% igual.
          <span className="ml-2 text-purple-400 font-medium">★ Patrón</span> = mismo prefijo, número de ticket diferente.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['ALTO', 'MEDIO', 'BAJO'] as const).map(level => {
          const c = riskColors[level]
          return (
            <button
              key={level}
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
      <div className="flex flex-wrap gap-4">
        {/* Risk filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Riesgo:</span>
          {(['ALL', 'ALTO', 'MEDIO', 'BAJO'] as const).map(level => (
            <button
              key={level}
              onClick={() => setRiskFilter(level)}
              className={`text-xs px-3 py-1 rounded-full border transition-all
                ${riskFilter === level
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
              {level === 'ALL' ? `Todos (${groups.length})` : `${level} (${countByRisk[level]})`}
            </button>
          ))}
        </div>

        {/* Match type filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Tipo:</span>
          {(['ALL', 'EXACT', 'PATTERN'] as const).map(type => (
            <button key={type} onClick={() => setMatchFilter(type)}
              className={`text-xs px-3 py-1 rounded-full border transition-all
                ${matchFilter === type ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {type === 'ALL' ? 'Todos' : type === 'EXACT'
                ? `Exacto (${groups.filter(g => g.matchType === 'EXACT').length})`
                : `Patrón (${groups.filter(g => g.matchType === 'PATTERN').length})`}
            </button>
          ))}
        </div>

        {/* Client filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Cliente:</span>
          <button onClick={() => setClientFilter('ALL')}
            className={`text-xs px-3 py-1 rounded-full border transition-all
              ${clientFilter === 'ALL' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            Todos ({groups.length})
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

      {/* Groups list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            {groups.length === 0
              ? 'No se detectaron EAs compartidos. Los trades no tienen comentarios o son todos distintos.'
              : 'Sin resultados con los filtros actuales.'}
          </div>
        )}

        {filtered.map(g => {
          const c = riskColors[g.riskLevel]
          const m = matchColors[g.matchType]
          const isOpen = expandedId === g.groupId

          return (
            <div key={g.groupId} className={`border ${c.border} rounded-xl overflow-hidden`}>
              {/* Header */}
              <button
                className={`w-full ${c.bg} px-5 py-3.5 flex items-center gap-4 hover:opacity-90 transition-opacity text-left`}
                onClick={() => setExpandedId(isOpen ? null : g.groupId)}
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-sm font-semibold text-gray-100 truncate max-w-xs">
                      "{g.commentKey}"
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${m.cls}`}>
                      {m.label}
                    </span>
                    <ClientBadge crossClient={g.crossClient} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span><span className="text-gray-300 font-medium">{g.accountCount}</span> cuentas</span>
                    <span><span className={`font-medium ${g.crossClient ? 'text-red-300' : 'text-gray-400'}`}>{g.uniqueEmails.length}</span> email{g.uniqueEmails.length > 1 ? 's' : ''}</span>
                    <span><span className="text-gray-300 font-medium">{g.tradeCount}</span> trades</span>
                    <span>Activos: <span className="text-gray-300">{g.symbols.slice(0, 4).join(', ')}{g.symbols.length > 4 ? '…' : ''}</span></span>
                    <span className={`font-semibold ${c.text}`}>Score {g.riskScore}</span>
                  </div>
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

              {/* Expanded */}
              {isOpen && (
                <div className="bg-gray-900/80 border-t border-gray-800 p-5 space-y-4">
                  {/* Comment samples */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Comentarios encontrados en los trades:</p>
                    <div className="flex flex-wrap gap-2">
                      {g.sampleComments.map((c, i) => (
                        <span key={i} className="font-mono text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-indigo-300">
                          "{c}"
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Accounts involved */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Cuentas usando este EA:</p>
                    <div className="flex flex-wrap gap-2">
                      {g.accounts.map((acct, i) => (
                        <span key={acct} className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs flex flex-col gap-0.5 min-w-0">
                          <span className="text-gray-300 font-semibold">{acct}</span>
                          {g.accountNames[i] && g.accountNames[i] !== acct && (
                            <span className="text-gray-500 text-[10px]">
                              {g.accountNames[i].replace('OGM International Ltd - ', '').trim()}
                            </span>
                          )}
                          {g.accountEmails[i] && (
                            <span className="text-indigo-400 text-[10px] font-mono">{g.accountEmails[i]}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Trades table */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">{g.trades.length} trades de este EA:</p>
                    <div className="overflow-x-auto scrollbar-thin rounded-xl border border-gray-700">
                      <table className="w-full text-xs whitespace-nowrap">
                        <thead>
                          <tr className="bg-gray-800 border-b border-gray-700">
                            <Th>Login</Th>
                            <Th highlight>Comentario ★</Th>
                            <Th>Symbol</Th>
                            <Th>Side</Th>
                            <Th>Vol</Th>
                            <Th>P. Apertura</Th>
                            <Th>P. Cierre</Th>
                            <Th>Apertura</Th>
                            <Th>Cierre</Th>
                            <Th>Duración</Th>
                            <Th>Razón</Th>
                            <Th>Net Profit</Th>
                            <Th>P&L %</Th>
                            <Th>Cuenta $</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.trades.map((t, i) => {
                            const isBuy = t.Type === 'buy'
                            const rowBase = i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'
                            return (
                              <tr key={t.Ticket} className={`${rowBase} border-b border-gray-800/60 hover:brightness-110`}>
                                <td className="px-3 py-2 text-gray-300">
                                  <div className="font-semibold">{t.Login}</div>
                                  <div className="text-gray-500 text-[10px]">
                                    {t.Name.replace('OGM International Ltd - ', '').trim()}
                                  </div>
                                  {t.Email && (
                                    <div className="text-indigo-400 text-[10px] font-mono">{t.Email}</div>
                                  )}
                                </td>
                                {/* Comment — the matching criterion, highlighted */}
                                <td className="px-3 py-2 font-mono text-indigo-200 bg-indigo-950/60 ring-1 ring-inset ring-indigo-700/50">
                                  {t.Comment}
                                </td>
                                <td className="px-3 py-2 text-gray-200 font-medium">{t.Symbol}</td>
                                <td className={`px-3 py-2 ${isBuy ? 'bg-emerald-950/70 ring-1 ring-inset ring-emerald-700/60' : 'bg-red-950/70 ring-1 ring-inset ring-red-700/60'}`}>
                                  <span className={`px-1.5 py-0.5 rounded font-bold text-xs ${isBuy ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-900/80 text-red-300'}`}>
                                    {t.Type.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-300">{t.Volume}</td>
                                <td className="px-3 py-2 text-gray-300 font-mono">{t.Price}</td>
                                <td className="px-3 py-2 text-gray-300 font-mono">{t.ClosePrice}</td>
                                <td className="px-3 py-2 text-gray-400 font-mono">{fmtDate(t.Time)}</td>
                                <td className="px-3 py-2 text-gray-400 font-mono">{fmtDate(t.CloseTime)}</td>
                                <td className="px-3 py-2 text-gray-400">{formatDuration(t.DurationMs)}</td>
                                <td className="px-3 py-2 text-gray-500">{t.Reason || '—'}</td>
                                <td className={`px-3 py-2 font-bold ${t.NetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {formatCurrency(t.NetProfit)}
                                </td>
                                <td className={`px-3 py-2 ${t.PnlPercent !== null ? (t.PnlPercent >= 0 ? 'text-emerald-300' : 'text-red-300') : 'text-gray-600'}`}>
                                  {t.PnlPercent !== null ? `${t.PnlPercent.toFixed(2)}%` : 'N/A'}
                                </td>
                                <td className="px-3 py-2 text-gray-300">
                                  {t.Balance !== null ? formatCurrency(t.Balance) : <span className="text-gray-600">N/A</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {/* Legend */}
                      <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/60 border-t border-gray-700 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-950/80 ring-1 ring-indigo-700/50" />
                          Comentario (criterio de detección de EA)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-950/70 ring-1 ring-emerald-700/60" />
                          BUY
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm bg-red-950/70 ring-1 ring-red-700/60" />
                          SELL
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
