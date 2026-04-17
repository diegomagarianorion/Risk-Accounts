import { Trade } from './dataParser'

export interface AssetStats {
  symbol: string
  totalProfit: number
  netProfit: number
  trades: number
  wins: number
  losses: number
  winRate: number
  avgPerTrade: number
}

export interface SideStats {
  symbol: string
  side: string
  trades: number
  totalProfit: number
  netProfit: number
  wins: number
  winRate: number
  avgProfit: number
}

export interface GeneralStats {
  totalTrades: number
  totalProfit: number
  totalNetProfit: number
  totalSwap: number
  totalCommission: number
  winRate: number
  avgDurationMs: number
  activeAccounts: number
  volumeByHour: { hour: number; count: number }[]
  profitByHour: { hour: number; profit: number }[]
}

export function computeAssetStats(trades: Trade[]): AssetStats[] {
  const map = new Map<string, AssetStats>()

  for (const t of trades) {
    if (!map.has(t.Symbol)) {
      map.set(t.Symbol, {
        symbol: t.Symbol,
        totalProfit: 0,
        netProfit: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgPerTrade: 0,
      })
    }
    const s = map.get(t.Symbol)!
    s.totalProfit += t.Profit
    s.netProfit += t.NetProfit
    s.trades++
    if (t.NetProfit > 0) s.wins++
    else s.losses++
  }

  return Array.from(map.values()).map(s => ({
    ...s,
    winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
    avgPerTrade: s.trades > 0 ? s.netProfit / s.trades : 0,
  }))
}

export function computeSideStats(trades: Trade[]): SideStats[] {
  const map = new Map<string, SideStats>()

  for (const t of trades) {
    const key = `${t.Symbol}__${t.Type}`
    if (!map.has(key)) {
      map.set(key, {
        symbol: t.Symbol,
        side: t.Type,
        trades: 0,
        totalProfit: 0,
        netProfit: 0,
        wins: 0,
        winRate: 0,
        avgProfit: 0,
      })
    }
    const s = map.get(key)!
    s.trades++
    s.totalProfit += t.Profit
    s.netProfit += t.NetProfit
    if (t.NetProfit > 0) s.wins++
  }

  return Array.from(map.values()).map(s => ({
    ...s,
    winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
    avgProfit: s.trades > 0 ? s.netProfit / s.trades : 0,
  }))
}

export function computeGeneralStats(trades: Trade[]): GeneralStats {
  const totalTrades = trades.length
  const totalProfit = trades.reduce((s, t) => s + t.Profit, 0)
  const totalNetProfit = trades.reduce((s, t) => s + t.NetProfit, 0)
  const totalSwap = trades.reduce((s, t) => s + t.Swap, 0)
  const totalCommission = trades.reduce((s, t) => s + t.Commission, 0)
  const wins = trades.filter(t => t.NetProfit > 0).length
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
  const durWithData = trades.filter(t => t.DurationMs > 0)
  const avgDurationMs =
    durWithData.length > 0
      ? durWithData.reduce((s, t) => s + t.DurationMs, 0) / durWithData.length
      : 0
  const activeAccounts = new Set(trades.map(t => t.Login)).size

  // Volume by hour
  const hourVol = new Array(24).fill(0)
  const hourProfit = new Array(24).fill(0)
  for (const t of trades) {
    if (t.OpenDate) {
      const h = t.OpenDate.getHours()
      hourVol[h]++
      hourProfit[h] += t.NetProfit
    }
  }

  return {
    totalTrades,
    totalProfit,
    totalNetProfit,
    totalSwap,
    totalCommission,
    winRate,
    avgDurationMs,
    activeAccounts,
    volumeByHour: hourVol.map((count, hour) => ({ hour, count })),
    profitByHour: hourProfit.map((profit, hour) => ({ hour, profit })),
  }
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  if (mins > 0) return `${mins}m ${secs % 60}s`
  return `${secs}s`
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}
