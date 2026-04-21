import React, { useState, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import FileUploader from './FileUploader'
import KpiCard from './KpiCard'

interface PayoutRow {
  program: string
  approvalTimeSecs: number
  amount: number
  share: number
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

function parsePayoutsCSV(text: string): PayoutRow[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  const rows = result.data
  if (rows.length < 2) return []
  return rows.slice(1).map(row => ({
    program: (row[2] ?? '').trim(),
    approvalTimeSecs: parseApprovalTime(row[13] ?? ''),
    amount: parseFloat((row[14] ?? '0').replace(/[^0-9.-]/g, '')) || 0,
    share: parseFloat((row[15] ?? '0').replace(/[^0-9.-]/g, '')) || 0,
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

const COL_LABELS: { key: SortKey; label: string }[] = [
  { key: 'program',         label: 'Programa' },
  { key: 'count',           label: 'Payouts' },
  { key: 'totalAmount',     label: 'Amount Total' },
  { key: 'totalShare',      label: 'Share Total' },
  { key: 'avgApprovalSecs', label: 'Avg Aprobación' },
]

export default function PayoutsView() {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<ProgramStats[] | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('totalAmount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [programSearch, setProgramSearch] = useState('')

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setData(null)
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
      setTotalRows(rows.length)
      setData(buildProgramStats(rows))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }, [file])

  const allPrograms = useMemo(() => data?.map(d => d.program).sort() ?? [], [data])

  const filtered = useMemo(() => {
    if (!data) return []
    let rows = data
    if (selectedPrograms.size > 0) {
      rows = rows.filter(r => selectedPrograms.has(r.program))
    }
    return [...rows].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [data, selectedPrograms, sortKey, sortDir])

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

  const filteredProgramList = allPrograms.filter(p =>
    p.toLowerCase().includes(programSearch.toLowerCase())
  )

  if (!data) {
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

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-emerald-400 font-semibold">{totalRows.toLocaleString()} payouts</span>
          <span>·</span>
          <span>{allPrograms.length} programas</span>
          {selectedPrograms.size > 0 && (
            <>
              <span>·</span>
              <span className="text-indigo-400">{selectedPrograms.size} filtrados</span>
            </>
          )}
        </div>
        <button
          onClick={() => { setData(null); setFile(null); setSelectedPrograms(new Set()); setProgramSearch('') }}
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
        {/* Program filter panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filtrar Programas</p>
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
          <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
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
