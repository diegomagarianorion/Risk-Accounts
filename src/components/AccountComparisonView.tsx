import React, { useState, useCallback } from 'react'
import FileUploader from './FileUploader'
import { parseAccountTradeFile, AccountTrade } from '../utils/accountParser'
import { compareAccounts, ComparisonMatch, detectAccountEAs, AccountEAGroup } from '../utils/accountComparison'
import { formatCurrency, formatDuration } from '../utils/analytics'

const TIME_OPTIONS = [
  { label: '5s',    value: 5   },
  { label: '15s',   value: 15  },
  { label: '30s',   value: 30  },
  { label: '1min',  value: 60  },
  { label: '5min',  value: 300 },
  { label: '10min', value: 600 },
] as const

const riskColors = {
  ALTO:  { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-800',    dot: 'bg-red-500'    },
  MEDIO: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-800', dot: 'bg-yellow-500' },
  BAJO:  { bg: 'bg-blue-900/30',   text: 'text-blue-300',   border: 'border-blue-800',   dot: 'bg-blue-500'   },
}

const patternColors = {
  COPY_EXACT: { label: 'Copy Exacto', color: 'text-orange-400', bg: 'bg-orange-900/40', border: 'border-orange-700' },
  HEDGING:    { label: 'Hedging',     color: 'text-purple-400', bg: 'bg-purple-900/40', border: 'border-purple-700' },
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function SideBadge({ side }: { side: string }) {
  const isBuy = side === 'buy'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuy ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-900/80 text-red-300'}`}>
      {side.toUpperCase()}
    </span>
  )
}

function MatchCard({ m }: { m: ComparisonMatch }) {
  const [open, setOpen] = useState(false)
  const c = riskColors[m.riskLevel]
  const p = patternColors[m.pattern]

  return (
    <div className={`border ${c.border} rounded-xl overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full ${c.bg} px-5 py-3.5 flex items-center gap-4 hover:opacity-90 transition-opacity text-left`}
      >
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-bold text-gray-100">{m.symbol}</span>
            <span className={`text-xs font-semibold ${p.color}`}>{p.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text} border ${c.border}`}>
              {m.riskLevel}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-0.5 text-xs">
            <div><span className="text-gray-500">Match </span><span className="text-gray-300 font-semibold">#{m.matchId}</span></div>
            <div><span className="text-gray-500">Δopen </span><span className="text-gray-300">{m.openDeltaSecs.toFixed(1)}s</span></div>
            <div><span className="text-gray-500">Δclose </span><span className="text-gray-300">{m.closeDeltaSecs.toFixed(1)}s</span></div>
            <div><span className="text-gray-500">Score </span><span className={`font-bold ${c.text}`}>{m.riskScore}</span></div>
            <div><span className="text-gray-500">A: </span><span className="text-indigo-300">{m.tradeA.AccountLabel}</span></div>
            <div><span className="text-gray-500">B: </span><span className="text-indigo-300">{m.tradeB.AccountLabel}</span></div>
          </div>
        </div>

        <span className="text-gray-500 flex-shrink-0 ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="bg-gray-900/80 border-t border-gray-800 p-4">
          <div className="overflow-x-auto scrollbar-thin rounded-xl border border-gray-700">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-800 border-b border-gray-700">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cuenta</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-indigo-300">Side ★</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Lots</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">P. Apertura</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">P. Cierre</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">SL</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">TP</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-indigo-300">Apertura ★</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-indigo-300">Cierre ★</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Duración</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">PnL</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Comisión</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {[m.tradeA, m.tradeB].map((t, i) => (
                  <tr key={t.Ticket} className={`${i === 0 ? 'bg-gray-900' : 'bg-gray-900/60'} border-b border-gray-800/60`}>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-indigo-400">{t.AccountLabel}</span>
                    </td>
                    <td className="px-3 py-2.5 bg-indigo-950/30">
                      <SideBadge side={t.Side} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-300">{t.Lots}</td>
                    <td className="px-3 py-2.5 text-gray-300 font-mono">{t.OpenPrice}</td>
                    <td className="px-3 py-2.5 text-gray-300 font-mono">{t.ClosePrice}</td>
                    <td className="px-3 py-2.5 text-gray-400">{t.SL > 0 ? t.SL : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400">{t.TP > 0 ? t.TP : '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-indigo-200 bg-indigo-950/40 ring-1 ring-inset ring-indigo-700/40">{fmtDate(t.OpenTime)}</td>
                    <td className="px-3 py-2.5 font-mono text-indigo-200 bg-indigo-950/40 ring-1 ring-inset ring-indigo-700/40">{fmtDate(t.CloseTime)}</td>
                    <td className="px-3 py-2.5 text-gray-400">{formatDuration(t.DurationMs)}</td>
                    <td className={`px-3 py-2.5 font-bold ${t.PnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(t.PnL)}
                    </td>
                    <td className={`px-3 py-2.5 ${t.Commission < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                      {formatCurrency(t.Commission)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono text-[10px]">{t.Ticket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const eaRiskColors = {
  ALTO:  { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-800',    dot: 'bg-red-500'    },
  MEDIO: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-800', dot: 'bg-yellow-500' },
  BAJO:  { bg: 'bg-blue-900/30',   text: 'text-blue-300',   border: 'border-blue-800',   dot: 'bg-blue-500'   },
}
const matchColors = {
  EXACT:   { label: 'Exacto',  cls: 'bg-orange-900/50 text-orange-300 border-orange-800' },
  PATTERN: { label: 'Patrón',  cls: 'bg-purple-900/50 text-purple-300 border-purple-800' },
}

function EACard({ g }: { g: AccountEAGroup }) {
  const [open, setOpen] = useState(false)
  const c = eaRiskColors[g.riskLevel]
  const m = matchColors[g.matchType]

  return (
    <div className={`border ${c.border} rounded-xl overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full ${c.bg} px-5 py-3.5 flex items-center gap-4 hover:opacity-90 transition-opacity text-left`}
      >
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-semibold text-gray-100 truncate max-w-xs">"{g.commentKey}"</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${m.cls}`}>{m.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text} border ${c.border}`}>{g.riskLevel}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span><span className="text-gray-300 font-medium">{g.tradesA.length}</span> trades A</span>
            <span><span className="text-gray-300 font-medium">{g.tradesB.length}</span> trades B</span>
            <span>Activos: <span className="text-gray-300">{g.symbols.slice(0, 4).join(', ')}{g.symbols.length > 4 ? '…' : ''}</span></span>
            <span className={`font-semibold ${c.text}`}>Score {g.riskScore}</span>
          </div>
        </div>
        <span className="text-gray-500 flex-shrink-0 ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="bg-gray-900/80 border-t border-gray-800 p-5 space-y-4">
          {/* Sample comments */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Comentarios detectados:</p>
            <div className="flex flex-wrap gap-2">
              {g.sampleComments.map((sc, i) => (
                <span key={i} className="font-mono text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-indigo-300">"{sc}"</span>
              ))}
            </div>
          </div>

          {/* Trades per account */}
          {[
            { label: 'Cuenta A', trades: g.tradesA },
            { label: 'Cuenta B', trades: g.tradesB },
          ].map(({ label, trades }) => (
            <div key={label}>
              <p className="text-xs text-gray-500 mb-2">{label} — {trades.length} trade{trades.length !== 1 ? 's' : ''}:</p>
              <div className="overflow-x-auto scrollbar-thin rounded-xl border border-gray-700">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-800 border-b border-gray-700">
                      {['Ticket','Side','Lots','Símbolo','P. Apertura','P. Cierre','Apertura','Cierre','Duración','PnL','Comisión','Comentario ★'].map(h => (
                        <th key={h} className={`px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] ${h === 'Comentario ★' ? 'text-indigo-300 bg-indigo-950/40' : 'text-gray-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => {
                      const isBuy = t.Side === 'buy'
                      return (
                        <tr key={t.Ticket} className={`${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'} border-b border-gray-800/60`}>
                          <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">{t.Ticket}</td>
                          <td className={`px-3 py-2 ${isBuy ? 'bg-emerald-950/70 ring-1 ring-inset ring-emerald-700/60' : 'bg-red-950/70 ring-1 ring-inset ring-red-700/60'}`}>
                            <span className={`px-1.5 py-0.5 rounded font-bold text-xs ${isBuy ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-900/80 text-red-300'}`}>{t.Side.toUpperCase()}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-300">{t.Lots}</td>
                          <td className="px-3 py-2 text-gray-200 font-medium">{t.Symbol}</td>
                          <td className="px-3 py-2 text-gray-300 font-mono">{t.OpenPrice}</td>
                          <td className="px-3 py-2 text-gray-300 font-mono">{t.ClosePrice}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono">{fmtDate(t.OpenTime)}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono">{fmtDate(t.CloseTime)}</td>
                          <td className="px-3 py-2 text-gray-400">{formatDuration(t.DurationMs)}</td>
                          <td className={`px-3 py-2 font-bold ${t.PnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(t.PnL)}</td>
                          <td className={`px-3 py-2 ${t.Commission < 0 ? 'text-red-300' : 'text-gray-400'}`}>{formatCurrency(t.Commission)}</td>
                          <td className="px-3 py-2 font-mono text-indigo-200 bg-indigo-950/60 ring-1 ring-inset ring-indigo-700/50">{t.Comment}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ComparisonResult {
  matches: ComparisonMatch[]
  eaGroups: AccountEAGroup[]
  labelA: string
  labelB: string
  totalA: number
  totalB: number
}

export default function AccountComparisonView() {
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'copy' | 'ea'>('copy')

  // Copy/Hedge filters
  const [timeLimit, setTimeLimit]         = useState<5 | 15 | 30 | 60 | 300 | 600>(30)
  const [compareMode, setCompareMode]     = useState<'both' | 'open' | 'close'>('both')
  const [patternFilter, setPatternFilter] = useState<'ALL' | 'COPY_EXACT' | 'HEDGING'>('ALL')
  const [riskFilter, setRiskFilter]       = useState<'ALL' | 'ALTO' | 'MEDIO' | 'BAJO'>('ALL')

  // EA filters
  const [eaRiskFilter,   setEaRiskFilter]   = useState<'ALL' | 'ALTO' | 'MEDIO' | 'BAJO'>('ALL')
  const [eaMatchFilter,  setEaMatchFilter]  = useState<'ALL' | 'EXACT' | 'PATTERN'>('ALL')

  // Search filters
  const [copySearch, setCopySearch] = useState('')
  const [eaSearch,   setEaSearch]   = useState('')

  const analyze = useCallback(async () => {
    if (!fileA || !fileB) return
    setLoading(true)
    setError(null)
    try {
      const labelA = fileA.name.replace(/\.csv$/i, '')
      const labelB = fileB.name.replace(/\.csv$/i, '')
      const [tradesA, tradesB] = await Promise.all([
        parseAccountTradeFile(fileA, labelA),
        parseAccountTradeFile(fileB, labelB),
      ])
      if (tradesA.length === 0 || tradesB.length === 0) {
        setError('Uno de los archivos no tiene trades válidos. Verifica el formato.')
        return
      }
      const matches  = compareAccounts(tradesA, tradesB)
      const eaGroups = detectAccountEAs(tradesA, tradesB)
      setResult({ matches, eaGroups, labelA, labelB, totalA: tradesA.length, totalB: tradesB.length })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar los archivos')
    } finally {
      setLoading(false)
    }
  }, [fileA, fileB])

  // Filtered matches (copy/hedge)
  const matchesTime = (m: { openDeltaSecs: number; closeDeltaSecs: number }) => {
    if (compareMode === 'open')  return m.openDeltaSecs  <= timeLimit
    if (compareMode === 'close') return m.closeDeltaSecs <= timeLimit
    return m.openDeltaSecs <= timeLimit && m.closeDeltaSecs <= timeLimit
  }

  const byTime = result ? result.matches.filter(m => matchesTime(m)) : []

  const filtered = byTime.filter(m => {
    if (patternFilter !== 'ALL' && m.pattern !== patternFilter) return false
    if (riskFilter    !== 'ALL' && m.riskLevel !== riskFilter) return false
    if (copySearch.trim()) {
      const q = copySearch.trim().toLowerCase()
      if (
        !m.tradeA.AccountLabel.toLowerCase().includes(q) &&
        !m.tradeB.AccountLabel.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const countByRisk = {
    ALTO:  byTime.filter(m => m.riskLevel === 'ALTO').length,
    MEDIO: byTime.filter(m => m.riskLevel === 'MEDIO').length,
    BAJO:  byTime.filter(m => m.riskLevel === 'BAJO').length,
  }
  const copyCount  = byTime.filter(m => m.pattern === 'COPY_EXACT').length
  const hedgeCount = byTime.filter(m => m.pattern === 'HEDGING').length

  // Filtered EA groups
  const filteredEA = result ? result.eaGroups.filter(g => {
    if (eaRiskFilter  !== 'ALL' && g.riskLevel  !== eaRiskFilter)  return false
    if (eaMatchFilter !== 'ALL' && g.matchType  !== eaMatchFilter)  return false
    if (eaSearch.trim()) {
      const q = eaSearch.trim().toLowerCase()
      if (
        !g.tradesA.some(t => t.AccountLabel.toLowerCase().includes(q)) &&
        !g.tradesB.some(t => t.AccountLabel.toLowerCase().includes(q))
      ) return false
    }
    return true
  }) : []

  const eaCountByRisk = result ? {
    ALTO:  result.eaGroups.filter(g => g.riskLevel === 'ALTO').length,
    MEDIO: result.eaGroups.filter(g => g.riskLevel === 'MEDIO').length,
    BAJO:  result.eaGroups.filter(g => g.riskLevel === 'BAJO').length,
  } : { ALTO: 0, MEDIO: 0, BAJO: 0 }

  return (
    <div className="space-y-6">
      {/* Upload section */}
      {!result && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="text-center mb-2">
            <p className="text-gray-500 text-sm">
              Carga dos archivos de historial de operaciones para detectar copy trading o hedging entre ellos
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-indigo-400 font-semibold mb-1.5">Cuenta A</p>
              <FileUploader
                label="Trade History — Cuenta A"
                onFile={setFileA}
                loaded={!!fileA}
                fileName={fileA?.name}
              />
            </div>
            <div>
              <p className="text-xs text-indigo-400 font-semibold mb-1.5">Cuenta B</p>
              <FileUploader
                label="Trade History — Cuenta B"
                onFile={setFileB}
                loaded={!!fileB}
                fileName={fileB?.name}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={analyze}
            disabled={!fileA || !fileB || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Comparando...
              </span>
            ) : 'Comparar cuentas'}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Header info + reset */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span className="text-indigo-400 font-semibold">{result.labelA}</span>
              <span className="text-gray-600">vs</span>
              <span className="text-indigo-400 font-semibold">{result.labelB}</span>
              <span>·</span>
              <span>{result.totalA} trades A · {result.totalB} trades B</span>
            </div>
            <button
              onClick={() => { setResult(null); setFileA(null); setFileB(null) }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cargar nuevos archivos
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-800">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('copy')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'copy' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <span>⇄</span> Copy / Hedge
                {byTime.length > 0 && (
                  <span className="bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{byTime.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ea')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'ea' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <span>⚙</span> EA Detection
                {result.eaGroups.filter(g => g.riskLevel === 'ALTO').length > 0 && (
                  <span className="bg-orange-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {result.eaGroups.filter(g => g.riskLevel === 'ALTO').length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ── Copy / Hedge tab ── */}
          {activeTab === 'copy' && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
                      <p className="text-xs text-gray-500 mt-0.5">matches</p>
                    </button>
                  )
                })}
                <button
                  onClick={() => setPatternFilter(patternFilter === 'COPY_EXACT' ? 'ALL' : 'COPY_EXACT')}
                  className={`bg-orange-900/30 border border-orange-800 rounded-xl p-4 text-left transition-all hover:opacity-80
                    ${patternFilter === 'COPY_EXACT' ? 'ring-2 ring-offset-1 ring-offset-gray-950 ring-orange-600' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-orange-300">Copy</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-100">{copyCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">matches</p>
                </button>
                <button
                  onClick={() => setPatternFilter(patternFilter === 'HEDGING' ? 'ALL' : 'HEDGING')}
                  className={`bg-purple-900/30 border border-purple-800 rounded-xl p-4 text-left transition-all hover:opacity-80
                    ${patternFilter === 'HEDGING' ? 'ring-2 ring-offset-1 ring-offset-gray-950 ring-purple-600' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">Hedge</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-100">{hedgeCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">matches</p>
                </button>
              </div>

              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">⌕</span>
                  <input
                    type="text"
                    value={copySearch}
                    onChange={e => setCopySearch(e.target.value)}
                    placeholder="Buscar por nº de cuenta…"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                {copySearch && (
                  <button
                    onClick={() => setCopySearch('')}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-x-6 gap-y-3">
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 w-12">Patrón:</span>
                  {([
                    { id: 'ALL',        label: `Todos (${byTime.length})` },
                    { id: 'COPY_EXACT', label: `Copy Exacto (${copyCount})` },
                    { id: 'HEDGING',    label: `Hedging (${hedgeCount})` },
                  ] as const).map(p => (
                    <button key={p.id} onClick={() => setPatternFilter(p.id)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all
                        ${patternFilter === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
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
              </div>

              {/* Detection count */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl">
                <span className="text-2xl font-bold text-indigo-400">{filtered.length}</span>
                <span className="text-sm text-gray-400">coincidencia{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</span>
                <span className="text-xs text-gray-600 ml-1">con los filtros actuales (ventana ≤ {timeLimit}s)</span>
              </div>

              {/* Match list */}
              <div className="space-y-3">
                {filtered.length === 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                    No se encontraron coincidencias con los filtros actuales
                  </div>
                )}
                {filtered.map(m => <MatchCard key={m.matchId} m={m} />)}
              </div>
            </div>
          )}

          {/* ── EA Detection tab ── */}
          {activeTab === 'ea' && (
            <div className="space-y-6">
              {/* Intro */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Detecta si ambas cuentas usan el mismo <strong className="text-gray-200">Expert Advisor (EA)</strong> agrupando por el campo <strong className="text-gray-200">Comment</strong> de cada trade.
                  <span className="ml-2 text-orange-400 font-medium">★ Exacto</span> = comentario 100% igual.
                  <span className="ml-2 text-purple-400 font-medium">★ Patrón</span> = mismo prefijo, número de ticket diferente.
                </p>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                {(['ALTO', 'MEDIO', 'BAJO'] as const).map(level => {
                  const c = eaRiskColors[level]
                  return (
                    <button key={level}
                      onClick={() => setEaRiskFilter(eaRiskFilter === level ? 'ALL' : level)}
                      className={`${c.bg} border ${c.border} rounded-xl p-4 text-left transition-all
                        ${eaRiskFilter === level ? 'ring-2 ring-offset-1 ring-offset-gray-950 ring-current' : 'hover:opacity-80'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{level}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-100">{eaCountByRisk[level]}</p>
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
                    value={eaSearch}
                    onChange={e => setEaSearch(e.target.value)}
                    placeholder="Buscar por nº de cuenta…"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                {eaSearch && (
                  <button
                    onClick={() => setEaSearch('')}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Riesgo:</span>
                  {(['ALL', 'ALTO', 'MEDIO', 'BAJO'] as const).map(level => (
                    <button key={level} onClick={() => setEaRiskFilter(level)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all
                        ${eaRiskFilter === level ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {level === 'ALL' ? `Todos (${result.eaGroups.length})` : `${level} (${eaCountByRisk[level]})`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Tipo:</span>
                  {(['ALL', 'EXACT', 'PATTERN'] as const).map(type => (
                    <button key={type} onClick={() => setEaMatchFilter(type)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all
                        ${eaMatchFilter === type ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {type === 'ALL'
                        ? `Todos (${result.eaGroups.length})`
                        : type === 'EXACT'
                          ? `Exacto (${result.eaGroups.filter(g => g.matchType === 'EXACT').length})`
                          : `Patrón (${result.eaGroups.filter(g => g.matchType === 'PATTERN').length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detection count */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl">
                <span className="text-2xl font-bold text-indigo-400">{filteredEA.length}</span>
                <span className="text-sm text-gray-400">grupo{filteredEA.length !== 1 ? 's' : ''} de EA encontrado{filteredEA.length !== 1 ? 's' : ''}</span>
                <span className="text-xs text-gray-600 ml-1">con los filtros actuales</span>
              </div>

              {/* EA list */}
              <div className="space-y-3">
                {filteredEA.length === 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                    {result.eaGroups.length === 0
                      ? 'No se detectaron EAs compartidos. Los trades no tienen comentarios comunes o son todos distintos.'
                      : 'Sin resultados con los filtros actuales.'}
                  </div>
                )}
                {filteredEA.map(g => <EACard key={g.eaId} g={g} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
