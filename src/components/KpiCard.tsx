import React from 'react'

interface Props {
  title: string
  value: string
  sub?: string
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'default'
}

const colorMap = {
  green: 'text-emerald-400',
  red: 'text-red-400',
  blue: 'text-blue-400',
  yellow: 'text-yellow-400',
  purple: 'text-purple-400',
  default: 'text-gray-100',
}

export default function KpiCard({ title, value, sub, color = 'default' }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
