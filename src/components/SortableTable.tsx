import React, { useState, useMemo } from 'react'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  sortValue?: (row: T) => number | string
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  maxRows?: number
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  expandedKey?: string | null
  renderExpanded?: (row: T) => React.ReactNode
}

export default function SortableTable<T>({
  columns,
  data,
  maxRows,
  rowKey,
  onRowClick,
  expandedKey,
  renderExpanded,
}: Props<T>) {
  const [sortCol, setSortCol] = useState<string>(columns[0]?.key as string ?? '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState('')

  const handleSort = (key: string) => {
    if (sortCol === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return data
    const q = filter.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const val = (row as Record<string, unknown>)[col.key as string]
        return String(val ?? '').toLowerCase().includes(q)
      })
    )
  }, [data, filter, columns])

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sortCol)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[col.key as string]
      const bv = col.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[col.key as string]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''))
    })
  }, [filtered, sortCol, sortDir, columns])

  const displayed = maxRows ? sorted.slice(0, maxRows) : sorted

  return (
    <div>
      {data.length > 10 && (
        <input
          type="text"
          placeholder="Filtrar..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="mb-3 w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      )}
      <div className="overflow-x-auto scrollbar-thin rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              {columns.map(col => (
                <th
                  key={col.key as string}
                  className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200 whitespace-nowrap ${col.className ?? ''}`}
                  onClick={() => handleSort(col.key as string)}
                >
                  {col.label}
                  {sortCol === col.key && (
                    <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, i) => {
              const key = rowKey(row)
              const isExpanded = expandedKey === key
              return (
                <React.Fragment key={key}>
                  <tr
                    className={`border-b border-gray-800/50 transition-colors
                      ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'}
                      ${onRowClick ? 'cursor-pointer hover:bg-gray-800' : ''}
                      ${isExpanded ? 'bg-gray-800' : ''}
                    `}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key as string}
                        className={`px-3 py-2 text-gray-300 whitespace-nowrap ${col.className ?? ''}`}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key as string] ?? '—')}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpanded && (
                    <tr className="bg-gray-800/60">
                      <td colSpan={columns.length} className="px-4 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {maxRows && sorted.length > maxRows && (
        <p className="text-xs text-gray-500 mt-2">
          Mostrando {maxRows} de {sorted.length} registros
        </p>
      )}
    </div>
  )
}
