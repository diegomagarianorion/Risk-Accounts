import React, { useState, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import FileUploader from './FileUploader'
import KpiCard from './KpiCard'

interface WithdrawableRow {
  account: string
  email: string
  program: string
  withdrawableProfit: number
  shareAmount: number
  totalSpent: number
  totalWithdrawal: number
  status: string
  name: string
  startingBalance: number
  currentEquity: number
  nextWithdrawalDate: string
  nextWithdrawalDateParsed: Date | null
  consistencyScore: number
  activeTradingDays: number
}

type SortKey = keyof Pick<
  WithdrawableRow,
  'account' | 'email' | 'program' | 'withdrawableProfit' | 'shareAmount' | 'totalSpent' | 'totalWithdrawal' | 'nextWithdrawalDate'
>
type SortDir = 'asc' | 'desc'
type TabId = 'overview' | 'accounts'

function parseMoney(raw: string): number {
  return parseFloat((raw ?? '').replace(/[^0-9.-]/g, '')) || 0
}

function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Parses "DD/MM/YYYY HH:MM:SS" → Date (returns null if invalid)
function parseNextWithdrawalDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (isNaN(d.getTime())) return null
  return d
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function parseWithdrawableCSV(text: string): WithdrawableRow[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  const rows = result.data
  if (rows.length < 2) return []

  return rows.slice(1).map(row => {
    const nextWithdrawalDateRaw = (row[13] ?? '').trim()
    return {
      account:                  (row[0] ?? '').trim(),
      email:                    (row[4] ?? '').trim(),
      program:                  (row[6] ?? '').trim(),
      withdrawableProfit:       parseMoney(row[12] ?? ''),
      nextWithdrawalDate:       nextWithdrawalDateRaw,
      nextWithdrawalDateParsed: parseNextWithdrawalDate(nextWithdrawalDateRaw),
      shareAmount:              parseMoney(row[15] ?? ''),
      status:                   (row[16] ?? '').trim(),
      name:                     (row[3] ?? '').trim(),
      startingBalance:          parseMoney(row[8] ?? ''),
      currentEquity:            parseMoney(row[9] ?? ''),
      consistencyScore:         parseFloat((row[25] ?? '0').replace(/[^0-9.-]/g, '')) || 0,
      totalSpent:               parseMoney(row[26] ?? ''),
      totalWithdrawal:          parseMoney(row[27] ?? ''),
      activeTradingDays:        parseInt((row[28] ?? '0').replace(/[^0-9]/g, '')) || 0,
    }
  }).filter(r => r.account !== '' && r.program !== '')
}

interface ProgramSummary {
  program: string
  count: number
  totalWithdrawable: number
  totalShare: number
}

// Shared date filter panel component
function DateFilterPanel({
  dateFrom, dateTo,
  onDateFrom, onDateTo,
}: {
  dateFrom: string
  dateTo: string
  onDateFrom: (v: string) => void
  onDateTo: (v: string) => void
}) {
  const hasFilter = !!(dateFrom || dateTo)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Next Withdrawal Date</p>
        </div>
        {hasFilter && (
          <button
            onClick={() => { onDateFrom(''); onDateTo('') }}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFrom(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateTo(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500 [color-scheme:dark]"
          />
        </div>
        {hasFilter && (
          <p className="text-[10px] text-amber-400 text-center">
            {dateFrom || '…'} → {dateTo || '…'}
          </p>
        )}
      </div>
    </div>
  )
}

function applyDateFilter(rows: WithdrawableRow[], dateFrom: string, dateTo: string): WithdrawableRow[] {
  const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
  const to = dateTo ? new Date(dateTo + 'T23:59:59') : null
  if (!from && !to) return rows
  return rows.filter(r => {
    if (!r.nextWithdrawalDateParsed) return false
    if (from && r.nextWithdrawalDateParsed < from) return false
    if (to && r.nextWithdrawalDateParsed > to) return false
    return true
  })
}

const ACCOUNT_COL_LABELS: { key: SortKey; label: string }[] = [
  { key: 'account',             label: 'Cuenta' },
  { key: 'email',               label: 'Email' },
  { key: 'program',             label: 'Programa' },
  { key: 'withdrawableProfit',  label: 'Withdrawable Profit' },
  { key: 'shareAmount',         label: 'Share Amount' },
  { key: 'totalSpent',          label: 'Total Spent' },
  { key: 'totalWithdrawal',     label: 'Total Withdrawal' },
  { key: 'nextWithdrawalDate',  label: 'Next Withdrawal Date' },
]

export default function WithdrawableProfitsView() {
  const [file, setFile] = useState<File | null>(null)
  const [rawRows, setRawRows] = useState<WithdrawableRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // — Overview tab filters —
  const [ovSelectedPrograms, setOvSelectedPrograms] = useState<Set<string>>(new Set())
  const [ovProgramSearch, setOvProgramSearch] = useState('')
  const [ovDateFrom, setOvDateFrom] = useState('')
  const [ovDateTo, setOvDateTo] = useState('')

  // — Accounts tab filters —
  const [acSearch, setAcSearch] = useState('')
  const [acSelectedPrograms, setAcSelectedPrograms] = useState<Set<string>>(new Set())
  const [acProgramSearch, setAcProgramSearch] = useState('')
  const [acDateFrom, setAcDateFrom] = useState('')
  const [acDateTo, setAcDateTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('withdrawableProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setRawRows(null)
    setError(null)
  }, [])

  const analyze = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const text = await file.text()
      const rows = parseWithdrawableCSV(text)
      if (rows.length === 0) {
        setError('No se encontraron datos válidos en el archivo.')
        setLoading(false)
        return
      }
      setRawRows(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }, [file])

  const allPrograms = useMemo(() => {
    if (!rawRows) return []
    return Array.from(new Set(rawRows.map(r => r.program))).sort()
  }, [rawRows])

  // — Overview filtered rows (for KPIs and chart) —
  const ovFiltered = useMemo(() => {
    if (!rawRows) return []
    let rows = rawRows
    if (ovSelectedPrograms.size > 0) rows = rows.filter(r => ovSelectedPrograms.has(r.program))
    rows = applyDateFilter(rows, ovDateFrom, ovDateTo)
    return rows
  }, [rawRows, ovSelectedPrograms, ovDateFrom, ovDateTo])

  const ovTotals = useMemo(() => ({
    accounts: ovFiltered.length,
    withdrawable: ovFiltered.reduce((s, r) => s + r.withdrawableProfit, 0),
    share: ovFiltered.reduce((s, r) => s + r.shareAmount, 0),
  }), [ovFiltered])

  const programSummaries = useMemo<ProgramSummary[]>(() => {
    const map = new Map<string, ProgramSummary>()
    for (const r of ovFiltered) {
      const cur = map.get(r.program) ?? { program: r.program, count: 0, totalWithdrawable: 0, totalShare: 0 }
      cur.count++
      cur.totalWithdrawable += r.withdrawableProfit
      cur.totalShare += r.shareAmount
      map.set(r.program, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.totalWithdrawable - a.totalWithdrawable)
  }, [ovFiltered])

  const chartData = useMemo(() => programSummaries.slice(0, 20), [programSummaries])

  // — Accounts tab filtered + sorted rows —
  const acFiltered = useMemo(() => {
    if (!rawRows) return []
    let rows = rawRows

    if (acSearch.trim() !== '') {
      const q = acSearch.trim().toLowerCase()
      rows = rows.filter(r =>
        r.email.toLowerCase().includes(q) ||
        r.account.toLowerCase().includes(q)
      )
    }
    if (acSelectedPrograms.size > 0) rows = rows.filter(r => acSelectedPrograms.has(r.program))
    rows = applyDateFilter(rows, acDateFrom, acDateTo)

    return [...rows].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [rawRows, acSearch, acSelectedPrograms, acDateFrom, acDateTo, sortKey, sortDir])

  const acTotals = useMemo(() => ({
    withdrawable: acFiltered.reduce((s, r) => s + r.withdrawableProfit, 0),
    share: acFiltered.reduce((s, r) => s + r.shareAmount, 0),
    spent: acFiltered.reduce((s, r) => s + r.totalSpent, 0),
    withdrawal: acFiltered.reduce((s, r) => s + r.totalWithdrawal, 0),
  }), [acFiltered])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleOvProgram(p: string) {
    setOvSelectedPrograms(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })
  }
  function toggleAcProgram(p: string) {
    setAcSelectedPrograms(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })
  }

  function clearOverview() {
    setOvSelectedPrograms(new Set())
    setOvProgramSearch('')
    setOvDateFrom('')
    setOvDateTo('')
  }
  function clearAccounts() {
    setAcSearch('')
    setAcSelectedPrograms(new Set())
    setAcProgramSearch('')
    setAcDateFrom('')
    setAcDateTo('')
  }

  const ovFilteredPrograms = allPrograms.filter(p => p.toLowerCase().includes(ovProgramSearch.toLowerCase()))
  const acFilteredPrograms = allPrograms.filter(p => p.toLowerCase().includes(acProgramSearch.toLowerCase()))

  const ovAnyFilter = ovSelectedPrograms.size > 0 || !!(ovDateFrom || ovDateTo)
  const acAnyFilter = acSearch.trim() !== '' || acSelectedPrograms.size > 0 || !!(acDateFrom || acDateTo)

  if (!rawRows) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <FileUploader
          label="Archivo Withdrawable Accounts (CSV)"
          onFile={handleFile}
          loaded={!!file}
          fileName={file?.name}
        />
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}
        <button
          onClick={analyze}
          disabled={!file || loading}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analizando...
            </span>
          ) : 'Analizar Withdrawable Profits'}
        </button>
      </div>
    )
  }

  const maxWithdrawable = Math.max(...chartData.map(r => r.totalWithdrawable), 1)
  const chartTotal = chartData.reduce((s, r) => s + r.totalWithdrawable, 0)

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-amber-400 font-semibold">{rawRows.length.toLocaleString()} cuentas</span>
          <span>·</span>
          <span>{allPrograms.length} programas</span>
        </div>
        <button
          onClick={() => { setRawRows(null); setFile(null); clearOverview(); clearAccounts() }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cargar nuevo archivo
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-1">
          {([
            { id: 'overview' as TabId, label: 'Overview', icon: '◈' },
            { id: 'accounts' as TabId, label: 'Withdrawable Profits by Accounts', icon: '≡' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards — sin Total Spent ni Total Withdrawal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard title="Cuentas" value={ovTotals.accounts.toLocaleString()} color="yellow" />
            <KpiCard title="Withdrawable Total" value={fmtCurrency(ovTotals.withdrawable)} color="green" />
            <KpiCard title="Share Total" value={fmtCurrency(ovTotals.share)} color="purple" />
          </div>

          {/* Chart + Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Filter panel */}
            <div className="lg:col-span-1 space-y-3">
              {/* Program filter */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Programas</p>
                  {ovSelectedPrograms.size > 0 && (
                    <button onClick={() => setOvSelectedPrograms(new Set())} className="text-xs text-amber-400 hover:text-amber-300">
                      Limpiar
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={ovProgramSearch}
                  onChange={e => setOvProgramSearch(e.target.value)}
                  placeholder="Buscar programa..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
                <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {ovFilteredPrograms.map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer group py-0.5">
                      <input type="checkbox" checked={ovSelectedPrograms.has(p)} onChange={() => toggleOvProgram(p)} className="accent-amber-500 w-3.5 h-3.5" />
                      <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate transition-colors">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date filter */}
              <DateFilterPanel
                dateFrom={ovDateFrom} dateTo={ovDateTo}
                onDateFrom={setOvDateFrom} onDateTo={setOvDateTo}
              />

              {ovAnyFilter && (
                <button onClick={clearOverview} className="w-full text-xs text-gray-600 hover:text-gray-400 border border-gray-800 hover:border-gray-700 rounded-xl py-2 transition-colors">
                  Limpiar todos los filtros
                </button>
              )}

              {/* Active filter info */}
              {ovAnyFilter && (
                <div className="text-[10px] text-gray-600 space-y-0.5 px-1">
                  {ovSelectedPrograms.size > 0 && <p>{ovSelectedPrograms.size} programa(s) filtrado(s)</p>}
                  {(ovDateFrom || ovDateTo) && <p>Fecha: {ovDateFrom || '…'} → {ovDateTo || '…'}</p>}
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-300">Withdrawable Profit por Programa</h3>
                {chartData.length < programSummaries.length && (
                  <span className="text-xs text-gray-600">top {chartData.length} de {programSummaries.length}</span>
                )}
              </div>
              {chartData.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-8">Sin datos para los filtros actuales</p>
              ) : (
                <div className="space-y-2.5">
                  {chartData.map((row, i) => {
                    const pct = (row.totalWithdrawable / maxWithdrawable) * 100
                    const sharePct = chartTotal > 0 ? (row.totalWithdrawable / chartTotal) * 100 : 0
                    const hue = Math.round(45 - i * (30 / Math.max(chartData.length - 1, 1)))
                    return (
                      <div key={row.program} className="group flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
                        <span className="text-xs text-gray-300 truncate flex-shrink-0 group-hover:text-white transition-colors" style={{ width: '200px' }} title={row.program}>
                          {row.program}
                        </span>
                        <div className="flex-1 h-6 bg-gray-800 rounded-md overflow-hidden relative">
                          <div
                            className="h-full rounded-md transition-all duration-500"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, hsl(${hue},70%,42%), hsl(${hue},80%,58%))` }}
                          />
                          <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-semibold text-white/80">
                            {pct > 18 ? fmtCurrency(row.totalWithdrawable) : ''}
                          </span>
                        </div>
                        <span className="text-xs text-amber-400 font-semibold w-24 text-right flex-shrink-0">
                          {fmtCurrency(row.totalWithdrawable)}
                        </span>
                        <span className="text-[10px] text-gray-600 w-10 text-right flex-shrink-0">{sharePct.toFixed(1)}%</span>
                        <span className="text-[10px] text-gray-600 w-12 text-right flex-shrink-0">{row.count} ctas</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNTS TAB ── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Sub-header */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="text-amber-400 font-semibold">{acFiltered.length.toLocaleString()} cuentas</span>
            <span>·</span>
            <span>{rawRows.length.toLocaleString()} total</span>
            {acSelectedPrograms.size > 0 && <><span>·</span><span className="text-indigo-400">{acSelectedPrograms.size} prog. filtrados</span></>}
            {acSearch.trim() && <><span>·</span><span className="text-amber-400">búsqueda activa</span></>}
            {(acDateFrom || acDateTo) && <><span>·</span><span className="text-amber-400">fecha activa</span></>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Filter panel */}
            <div className="lg:col-span-1 space-y-3">
              {/* Search */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Buscar</p>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={acSearch}
                    onChange={e => setAcSearch(e.target.value)}
                    placeholder="Email o N° cuenta..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  />
                  {acSearch && (
                    <button onClick={() => setAcSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-xs">✕</button>
                  )}
                </div>
              </div>

              {/* Program filter */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Programas</p>
                  {acSelectedPrograms.size > 0 && (
                    <button onClick={() => setAcSelectedPrograms(new Set())} className="text-xs text-amber-400 hover:text-amber-300">
                      Limpiar
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={acProgramSearch}
                  onChange={e => setAcProgramSearch(e.target.value)}
                  placeholder="Buscar programa..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
                <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {acFilteredPrograms.map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer group py-0.5">
                      <input type="checkbox" checked={acSelectedPrograms.has(p)} onChange={() => toggleAcProgram(p)} className="accent-amber-500 w-3.5 h-3.5" />
                      <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate transition-colors">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date filter */}
              <DateFilterPanel
                dateFrom={acDateFrom} dateTo={acDateTo}
                onDateFrom={setAcDateFrom} onDateTo={setAcDateTo}
              />

              {acAnyFilter && (
                <button onClick={clearAccounts} className="w-full text-xs text-gray-600 hover:text-gray-400 border border-gray-800 hover:border-gray-700 rounded-xl py-2 transition-colors">
                  Limpiar todos los filtros
                </button>
              )}
            </div>

            {/* Table */}
            <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {ACCOUNT_COL_LABELS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 py-3 text-left text-gray-500 uppercase tracking-wider font-semibold cursor-pointer hover:text-gray-300 select-none whitespace-nowrap transition-colors"
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {sortKey === col.key
                              ? <span className="text-amber-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                              : <span className="text-gray-700">↕</span>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {acFiltered.map((row, i) => (
                      <tr
                        key={`${row.account}-${i}`}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/30'}`}
                      >
                        <td className="px-4 py-2.5 text-gray-100 font-mono font-semibold whitespace-nowrap">{row.account}</td>
                        <td className="px-4 py-2.5 text-gray-300 max-w-[160px] truncate" title={row.email}>{row.email}</td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap max-w-[140px] truncate" title={row.program}>{row.program}</td>
                        <td className="px-4 py-2.5 text-amber-400 font-semibold text-right whitespace-nowrap">{fmtCurrency(row.withdrawableProfit)}</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-semibold text-right whitespace-nowrap">{fmtCurrency(row.shareAmount)}</td>
                        <td className="px-4 py-2.5 text-blue-400 text-right whitespace-nowrap">{fmtCurrency(row.totalSpent)}</td>
                        <td className="px-4 py-2.5 text-purple-400 text-right whitespace-nowrap">{fmtCurrency(row.totalWithdrawal)}</td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                          {fmtDate(row.nextWithdrawalDateParsed)}
                        </td>
                      </tr>
                    ))}
                    {acFiltered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-600 text-sm">
                          Sin resultados para los filtros actuales
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {acFiltered.length > 1 && (
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-800/50">
                        <td className="px-4 py-2.5 text-gray-400 font-bold text-xs uppercase" colSpan={3}>
                          Total ({acFiltered.length})
                        </td>
                        <td className="px-4 py-2.5 text-amber-300 font-bold text-right whitespace-nowrap">{fmtCurrency(acTotals.withdrawable)}</td>
                        <td className="px-4 py-2.5 text-emerald-300 font-bold text-right whitespace-nowrap">{fmtCurrency(acTotals.share)}</td>
                        <td className="px-4 py-2.5 text-blue-300 font-bold text-right whitespace-nowrap">{fmtCurrency(acTotals.spent)}</td>
                        <td className="px-4 py-2.5 text-purple-300 font-bold text-right whitespace-nowrap">{fmtCurrency(acTotals.withdrawal)}</td>
                        <td className="px-4 py-2.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
