import React, { useState, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import FileUploader from './FileUploader'
import KpiCard from './KpiCard'

interface PayoutRow {
  program: string
  approvalTimeSecs: number
  amount: number
  share: number
  dateOfRequest: Date | null
}

interface ProgramStats {
  program: string
  count: number
  totalAmount: number
  totalShare: number
  avgApprovalSecs: number
}

type SortKey = keyof ProgramStats
type SortDir = 'asc' | 'desc'
type DateMode = 'range' | 'month'

function parseApprovalTime(raw: string): number {
  if (!raw || raw.trim() === '') return 0
  const parts = raw.trim().split(':').map(Number)
  if (parts.length === 4) {
    const [d, h, m, s] = parts
    return d * 86400 + h * 3600 + m * 60 + s
  }
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  return 0
}

function formatSecs(secs: number): string {
  if (secs <= 0) return '—'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseDateFlexible(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null
  const s = raw.trim()

  let candidate: Date | null = null

  // YYYY-MM-DD (ISO, optional time suffix)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    candidate = new Date(Number(y), Number(m) - 1, Number(d))
  }

  // DD/MM/YYYY or MM/DD/YYYY (with optional " UTC ..." suffix)
  // Detect format: if first number > 12 it must be DD; if second > 12 it must be DD
  // Default to DD/MM/YYYY (the format used in this CSV: "20/04/2026 UTC 18:20:19")
  if (!candidate) {
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (slashMatch) {
      const [, a, b, y] = slashMatch
      const n1 = Number(a), n2 = Number(b), yr = Number(y)
      let dd: number, mm: number
      if (n1 > 12) {
        // a is definitely day → DD/MM/YYYY
        dd = n1; mm = n2
      } else if (n2 > 12) {
        // b is definitely day → MM/DD/YYYY
        mm = n1; dd = n2
      } else {
        // Ambiguous — default to DD/MM/YYYY (matches this CSV's format)
        dd = n1; mm = n2
      }
      candidate = new Date(yr, mm - 1, dd)
    }
  }

  // DD-MM-YYYY (dash separator)
  if (!candidate) {
    const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
    if (dashMatch) {
      const [, dd, mm, y] = dashMatch
      candidate = new Date(Number(y), Number(mm) - 1, Number(dd))
    }
  }

  if (!candidate || isNaN(candidate.getTime())) return null

  // Sanity check: reject implausible years (future or too old)
  const year = candidate.getFullYear()
  if (year < 2010 || year > new Date().getFullYear()) return null

  return candidate
}

function findColIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const c of candidates) {
    const idx = lower.findIndex(h => h.includes(c.toLowerCase()))
    if (idx !== -1) return idx
  }
  return -1
}

function parsePayoutsCSV(text: string): PayoutRow[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  const rows = result.data
  if (rows.length < 2) return []

  const headers = rows[0]
  const dateColIdx = findColIndex(headers, 'date of request', 'request date', 'fecha solicitud', 'fecha de solicitud', 'request')
  const effectiveDateIdx = dateColIdx !== -1 ? dateColIdx : 17  // fallback to column R

  return rows.slice(1).map(row => ({
    program: (row[2] ?? '').trim(),
    approvalTimeSecs: parseApprovalTime(row[13] ?? ''),
    amount: parseFloat((row[14] ?? '0').replace(/[^0-9.-]/g, '')) || 0,
    share: parseFloat((row[15] ?? '0').replace(/[^0-9.-]/g, '')) || 0,
    dateOfRequest: parseDateFlexible(row[effectiveDateIdx] ?? ''),
  })).filter(r => r.program !== '')
}

function buildProgramStats(rows: PayoutRow[]): ProgramStats[] {
  const map = new Map<string, { count: number; totalAmount: number; totalShare: number; totalSecs: number }>()
  for (const r of rows) {
    const cur = map.get(r.program) ?? { count: 0, totalAmount: 0, totalShare: 0, totalSecs: 0 }
    cur.count++
    cur.totalAmount += r.amount
    cur.totalShare += r.share
    cur.totalSecs += r.approvalTimeSecs
    map.set(r.program, cur)
  }
  return Array.from(map.entries()).map(([program, s]) => ({
    program,
    count: s.count,
    totalAmount: s.totalAmount,
    totalShare: s.totalShare,
    avgApprovalSecs: s.count > 0 ? s.totalSecs / s.count : 0,
  }))
}

function buildProgramStatsFromRows(rows: PayoutRow[]): ProgramStats[] {
  return buildProgramStats(rows)
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COL_LABELS: { key: SortKey; label: string }[] = [
  { key: 'program',         label: 'Programa' },
  { key: 'count',           label: 'Payouts' },
  { key: 'totalAmount',     label: 'Amount Total' },
  { key: 'totalShare',      label: 'Share Total' },
  { key: 'avgApprovalSecs', label: 'Avg Aprobación' },
]

export default function PayoutsView() {
  const [file, setFile] = useState<File | null>(null)
  const [rawRows, setRawRows] = useState<PayoutRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('totalAmount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [programSearch, setProgramSearch] = useState('')

  // Date filter state
  const [dateMode, setDateMode] = useState<DateMode>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterMonth, setFilterMonth] = useState<number>(-1)   // 0-indexed, -1 = all
  const [filterYear, setFilterYear] = useState<number>(-1)     // -1 = all

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
      const rows = parsePayoutsCSV(text)
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

  // Available years extracted from the data
  const availableYears = useMemo(() => {
    if (!rawRows) return []
    const years = new Set<number>()
    for (const r of rawRows) {
      if (r.dateOfRequest) years.add(r.dateOfRequest.getFullYear())
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [rawRows])

  const allPrograms = useMemo(() => {
    if (!rawRows) return []
    return Array.from(new Set(rawRows.map(r => r.program))).sort()
  }, [rawRows])

  const totalRows = rawRows?.length ?? 0

  const hasDateFilter = useMemo(() => {
    if (dateMode === 'range') return !!(dateFrom || dateTo)
    return filterMonth !== -1 || filterYear !== -1
  }, [dateMode, dateFrom, dateTo, filterMonth, filterYear])

  const filtered = useMemo(() => {
    if (!rawRows) return []

    let rows = rawRows

    // Date filter
    if (dateMode === 'range') {
      const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
      const to = dateTo ? new Date(dateTo + 'T23:59:59') : null
      if (from || to) {
        rows = rows.filter(r => {
          if (!r.dateOfRequest) return false
          if (from && r.dateOfRequest < from) return false
          if (to && r.dateOfRequest > to) return false
          return true
        })
      }
    } else {
      if (filterYear !== -1 || filterMonth !== -1) {
        rows = rows.filter(r => {
          if (!r.dateOfRequest) return false
          if (filterYear !== -1 && r.dateOfRequest.getFullYear() !== filterYear) return false
          if (filterMonth !== -1 && r.dateOfRequest.getMonth() !== filterMonth) return false
          return true
        })
      }
    }

    // Build stats from filtered rows (so counts/amounts are date-aware)
    let stats = buildProgramStatsFromRows(rows)

    // Program filter
    if (selectedPrograms.size > 0) {
      stats = stats.filter(r => selectedPrograms.has(r.program))
    }

    return [...stats].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [rawRows, dateMode, dateFrom, dateTo, filterMonth, filterYear, selectedPrograms, sortKey, sortDir])

  const totals = useMemo(() => ({
    count: filtered.reduce((s, r) => s + r.count, 0),
    amount: filtered.reduce((s, r) => s + r.totalAmount, 0),
    share: filtered.reduce((s, r) => s + r.totalShare, 0),
    avgSecs: filtered.length > 0
      ? filtered.reduce((s, r) => s + r.avgApprovalSecs, 0) / filtered.length
      : 0,
  }), [filtered])

  const chartData = useMemo(
    () => [...filtered]
      .sort((a, b) => b.totalShare - a.totalShare)
      .slice(0, 20),
    [filtered]
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleProgram(p: string) {
    setSelectedPrograms(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  function clearAllFilters() {
    setSelectedPrograms(new Set())
    setDateFrom('')
    setDateTo('')
    setFilterMonth(-1)
    setFilterYear(-1)
    setProgramSearch('')
  }

  const filteredProgramList = allPrograms.filter(p =>
    p.toLowerCase().includes(programSearch.toLowerCase())
  )

  if (!rawRows) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <FileUploader
          label="Archivo de Payouts (CSV)"
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
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analizando...
            </span>
          ) : 'Analizar Payouts'}
        </button>
      </div>
    )
  }

  const anyFilter = selectedPrograms.size > 0 || hasDateFilter

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-emerald-400 font-semibold">{totals.count.toLocaleString()} payouts</span>
          <span>·</span>
          <span className="text-gray-500">{totalRows.toLocaleString()} total</span>
          <span>·</span>
          <span>{allPrograms.length} programas</span>
          {selectedPrograms.size > 0 && (
            <>
              <span>·</span>
              <span className="text-indigo-400">{selectedPrograms.size} prog. filtrados</span>
            </>
          )}
          {hasDateFilter && (
            <>
              <span>·</span>
              <span className="text-violet-400">fecha activa</span>
            </>
          )}
        </div>
        <button
          onClick={() => { setRawRows(null); setFile(null); clearAllFilters() }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cargar nuevo archivo
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard title="Total Payouts" value={totals.count.toLocaleString()} color="blue" />
        <KpiCard title="Amount Total" value={fmtCurrency(totals.amount)} color="green" />
        <KpiCard title="Share Total" value={fmtCurrency(totals.share)} color="purple" />
        <KpiCard title="Avg Aprobación" value={formatSecs(totals.avgSecs)} color="yellow" />
      </div>

      {/* Chart — Share por Programa */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-300">Share por Programa</h3>
          {chartData.length < filtered.length && (
            <span className="text-xs text-gray-600">top {chartData.length} de {filtered.length}</span>
          )}
        </div>
        <div className="space-y-2.5">
          {(() => {
            const maxShare = Math.max(...chartData.map(r => r.totalShare), 1)
            const totalShare = chartData.reduce((s, r) => s + r.totalShare, 0)
            return chartData.map((row, i) => {
              const pct = (row.totalShare / maxShare) * 100
              const sharePct = totalShare > 0 ? (row.totalShare / totalShare) * 100 : 0
              const hue = Math.round(160 - i * (80 / Math.max(chartData.length - 1, 1)))
              return (
                <div key={row.program} className="group flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span
                    className="text-xs text-gray-300 truncate flex-shrink-0 group-hover:text-white transition-colors"
                    style={{ width: '180px' }}
                    title={row.program}
                  >
                    {row.program}
                  </span>
                  <div className="flex-1 h-6 bg-gray-800 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, hsl(${hue},70%,42%), hsl(${hue},80%,58%))`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-semibold text-white/80">
                      {pct > 18 ? fmtCurrency(row.totalShare) : ''}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold w-20 text-right flex-shrink-0">
                    {fmtCurrency(row.totalShare)}
                  </span>
                  <span className="text-[10px] text-gray-600 w-10 text-right flex-shrink-0">
                    {sharePct.toFixed(1)}%
                  </span>
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Filter panel */}
        <div className="lg:col-span-1 space-y-3">

          {/* Program filter */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Programas</p>
              {selectedPrograms.size > 0 && (
                <button
                  onClick={() => setSelectedPrograms(new Set())}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Limpiar
                </button>
              )}
            </div>
            <input
              type="text"
              value={programSearch}
              onChange={e => setProgramSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
              {filteredProgramList.map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer group py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedPrograms.has(p)}
                    onChange={() => toggleProgram(p)}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate transition-colors">{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date filter — unified block */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha Solicitud</p>
              </div>
              {hasDateFilter && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setFilterMonth(-1); setFilterYear(-1) }}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
              <button
                onClick={() => setDateMode('month')}
                className={`flex-1 py-1.5 font-medium transition-colors ${
                  dateMode === 'month'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >
                Mes / Año
              </button>
              <button
                onClick={() => setDateMode('range')}
                className={`flex-1 py-1.5 font-medium transition-colors ${
                  dateMode === 'range'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >
                Rango exacto
              </button>
            </div>

            {dateMode === 'month' ? (
              <div className="space-y-2">
                {/* Year selector */}
                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Año</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterYear(-1)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        filterYear === -1
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-800 text-gray-500 hover:text-gray-300 border border-gray-700'
                      }`}
                    >
                      Todo
                    </button>
                    {availableYears.map(y => (
                      <button
                        key={y}
                        onClick={() => setFilterYear(filterYear === y ? -1 : y)}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                          filterYear === y
                            ? 'bg-violet-600 text-white'
                            : 'bg-gray-800 text-gray-500 hover:text-gray-300 border border-gray-700'
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Month selector */}
                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Mes</label>
                  <div className="grid grid-cols-3 gap-1">
                    {MONTHS.map((name, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFilterMonth(filterMonth === idx ? -1 : idx)}
                        className={`py-1 rounded text-[10px] font-medium transition-colors ${
                          filterMonth === idx
                            ? 'bg-violet-600 text-white'
                            : 'bg-gray-800 text-gray-500 hover:text-gray-300 border border-gray-700'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                {(filterMonth !== -1 || filterYear !== -1) && (
                  <p className="text-[10px] text-violet-400 text-center">
                    {filterMonth !== -1 ? MONTHS[filterMonth] : 'Todo'}{filterYear !== -1 ? ` ${filterYear}` : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <p className="text-[10px] text-violet-400 text-center">
                    {dateFrom || '…'} → {dateTo || '…'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Clear all */}
          {anyFilter && (
            <button
              onClick={clearAllFilters}
              className="w-full text-xs text-gray-600 hover:text-gray-400 border border-gray-800 hover:border-gray-700 rounded-xl py-2 transition-colors"
            >
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
                  {COL_LABELS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left text-gray-500 uppercase tracking-wider font-semibold cursor-pointer hover:text-gray-300 select-none whitespace-nowrap transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          <span className="text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        )}
                        {sortKey !== col.key && <span className="text-gray-700">↕</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.program}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/30'}`}
                  >
                    <td className="px-4 py-2.5 text-gray-200 font-medium whitespace-nowrap">{row.program}</td>
                    <td className="px-4 py-2.5 text-blue-400 font-semibold text-right">{row.count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-indigo-400 font-semibold text-right">{fmtCurrency(row.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-semibold text-right">{fmtCurrency(row.totalShare)}</td>
                    <td className="px-4 py-2.5 text-yellow-400 text-right">{formatSecs(row.avgApprovalSecs)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-600 text-sm">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/50">
                    <td className="px-4 py-2.5 text-gray-400 font-bold text-xs uppercase">Total</td>
                    <td className="px-4 py-2.5 text-blue-300 font-bold text-right">{totals.count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-indigo-300 font-bold text-right">{fmtCurrency(totals.amount)}</td>
                    <td className="px-4 py-2.5 text-emerald-300 font-bold text-right">{fmtCurrency(totals.share)}</td>
                    <td className="px-4 py-2.5 text-yellow-300 text-right">{formatSecs(totals.avgSecs)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
