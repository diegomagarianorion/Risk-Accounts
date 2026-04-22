import React, { useState, useMemo } from 'react'
import { Trade } from '../../utils/dataParser'

interface Props {
  trades: Trade[]
}

interface AccountActivity {
  login: string
  email: string
  total: number
  ops15: number
  ops30: number
  ops60: number
}

type SortKey = keyof AccountActivity
type SortDir = 'asc' | 'desc'

export default function DailyActivityTab({ trades }: Props) {
  const [sortCol, setSortCol] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')

  const rows: AccountActivity[] = useMemo(() => {
    const map = new Map<string, AccountActivity>()

    for (const t of trades) {
      const login = t.Login
      if (!map.has(login)) {
        map.set(login, { login, email: t.Email || '', total: 0, ops15: 0, ops30: 0, ops60: 0 })
      }
      const row = map.get(login)!
      row.total++
      const secs = t.DurationMs / 1000
      if (secs <= 15) row.ops15++
      if (secs <= 30) row.ops30++
      if (secs <= 60) row.ops60++
    }

    return Array.from(map.values())
  }, [trades])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.login.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [filtered, sortCol, sortDir])

  const handleSort = (col: SortKey) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  const th = (col: SortKey, label: string, title?: string, center = false) => (
    <th
      title={title}
      className={`px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200 whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}
      onClick={() => handleSort(col)}
    >
      {label}
      {sortCol === col && <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Daily Activity
          <span className="ml-2 text-xs text-gray-500 font-normal">
            ({rows.length.toLocaleString()} cuentas · {trades.length.toLocaleString()} operaciones)
          </span>
        </h3>
        <input
          type="text"
          placeholder="Buscar por email o cuenta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="overflow-x-auto scrollbar-thin rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              {th('email', 'Email cliente')}
              {th('login', 'Nº cuenta')}
              {th('total', 'Total ops', undefined, true)}
              {th('ops15', '0–15 seg', 'Operaciones con duración entre 0 y 15 segundos', true)}
              {th('ops30', '0–30 seg', 'Operaciones con duración entre 0 y 30 segundos', true)}
              {th('ops60', '0–60 seg', 'Operaciones con duración entre 0 y 60 segundos', true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.login}
                className={`border-b border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'}`}
              >
                <td className="px-3 py-2 text-indigo-400 font-mono text-xs whitespace-nowrap">
                  {row.email || <span className="text-gray-600">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-300 font-mono text-xs whitespace-nowrap">
                  {row.login}
                </td>
                <td className="px-3 py-2 text-gray-100 font-bold text-center whitespace-nowrap">
                  {row.total.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span className={row.ops15 > 0 ? 'text-red-400 font-semibold' : 'text-gray-600'}>
                    {row.ops15.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span className={row.ops30 > 0 ? 'text-orange-400 font-semibold' : 'text-gray-600'}>
                    {row.ops30.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span className={row.ops60 > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-600'}>
                    {row.ops60.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin resultados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
