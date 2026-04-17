import { Trade } from './dataParser'

export interface SuspiciousGroup {
  groupId: number
  symbol: string
  accounts: string[]
  accountNames: string[]
  accountEmails: string[]     // email per account (same index as accounts[])
  uniqueEmails: string[]      // deduplicated emails in the group
  crossClient: boolean        // true if more than one distinct email
  trades: Trade[]
  pattern: 'COPY_EXACT' | 'HEDGING' | 'MIXED'
  openDeltaSecs: number
  closeDeltaSecs: number
  coincidences: number
  riskLevel: 'ALTO' | 'MEDIO' | 'BAJO'
  riskScore: number
}

const WINDOW_MS = 600_000 // 10 minutes (max window — UI filters down further)

// Union-Find for grouping connected pairs
class UnionFind {
  private parent: number[]
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i) }
  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x])
    return this.parent[x]
  }
  union(x: number, y: number) {
    this.parent[this.find(x)] = this.find(y)
  }
}

export function detectCopyTrading(trades: Trade[]): SuspiciousGroup[] {
  // Only trades with both open and close dates
  const valid = trades.filter(t => t.OpenDate !== null && t.CloseDate !== null)

  // Group by symbol first to reduce comparisons
  const bySymbol = new Map<string, Trade[]>()
  for (const t of valid) {
    if (!bySymbol.has(t.Symbol)) bySymbol.set(t.Symbol, [])
    bySymbol.get(t.Symbol)!.push(t)
  }

  const groups: SuspiciousGroup[] = []
  let groupId = 0

  for (const [symbol, symTrades] of bySymbol) {
    const n = symTrades.length
    if (n < 2) continue

    // Sort by open time for early-exit optimization
    symTrades.sort((a, b) => a.OpenDate!.getTime() - b.OpenDate!.getTime())

    // Find all matching pairs
    const uf = new UnionFind(n)
    let anyMatch = false

    for (let i = 0; i < n; i++) {
      const ti = symTrades[i]
      const tiOpen = ti.OpenDate!.getTime()
      const tiClose = ti.CloseDate!.getTime()

      for (let j = i + 1; j < n; j++) {
        const tj = symTrades[j]
        const tjOpen = tj.OpenDate!.getTime()

        // OR condition: can't break on open-diff alone (closeDiff might still qualify)
        if (tjOpen - tiOpen > WINDOW_MS) continue

        // Skip same account
        if (ti.Login === tj.Login) continue

        const tjClose = tj.CloseDate!.getTime()

        // At least one delta must be within window (UI filters apply the precise mode)
        const openDiff = Math.abs(tiOpen - tjOpen)
        const closeDiff = Math.abs(tiClose - tjClose)

        if (openDiff <= WINDOW_MS || closeDiff <= WINDOW_MS) {
          uf.union(i, j)
          anyMatch = true
        }
      }
    }

    if (!anyMatch) continue

    // Build clusters from union-find components
    const componentMap = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const root = uf.find(i)
      if (!componentMap.has(root)) componentMap.set(root, [])
      componentMap.get(root)!.push(i)
    }

    for (const [, indices] of componentMap) {
      if (indices.length < 2) continue

      const cluster = indices.map(i => symTrades[i])

      // Must have at least 2 distinct accounts
      const loginSet = new Set(cluster.map(t => t.Login))
      if (loginSet.size < 2) continue

      // Determine pattern
      const sides = new Set(cluster.map(t => t.Type))
      let pattern: SuspiciousGroup['pattern']
      if (sides.size === 1) {
        pattern = 'COPY_EXACT'
      } else if (sides.size === 2) {
        // Check if it's strictly opposite (all buys vs all sells) or mixed
        const buyCount = cluster.filter(t => t.Type === 'buy').length
        const sellCount = cluster.filter(t => t.Type === 'sell').length
        pattern = (buyCount > 0 && sellCount > 0) ? 'HEDGING' : 'MIXED'
      } else {
        pattern = 'MIXED'
      }

      // Compute open/close deltas across the group (use reduce to avoid spread stack overflow)
      const openTimes = cluster.map(t => t.OpenDate!.getTime())
      const closeTimes = cluster.map(t => t.CloseDate!.getTime())
      const minOpen = openTimes.reduce((m, v) => v < m ? v : m, openTimes[0])
      const maxOpen = openTimes.reduce((m, v) => v > m ? v : m, openTimes[0])
      const minClose = closeTimes.reduce((m, v) => v < m ? v : m, closeTimes[0])
      const maxClose = closeTimes.reduce((m, v) => v > m ? v : m, closeTimes[0])
      const openDeltaSecs = (maxOpen - minOpen) / 1000
      const closeDeltaSecs = (maxClose - minClose) / 1000

      // Risk score
      const accountCount = loginSet.size
      const coincidences = cluster.length
      let riskScore = 0
      riskScore += accountCount * 10
      riskScore += coincidences * 5
      // Tighter timing = higher risk
      riskScore += openDeltaSecs < 5 ? 30 : openDeltaSecs < 20 ? 20 : openDeltaSecs < 60 ? 10 : 0
      riskScore += closeDeltaSecs < 10 ? 15 : closeDeltaSecs < 30 ? 10 : closeDeltaSecs < 60 ? 5 : 0
      if (pattern === 'COPY_EXACT') riskScore += 15
      if (pattern === 'HEDGING') riskScore += 20

      const accounts = Array.from(loginSet)
      const accountNames = accounts.map(
        login => cluster.find(t => t.Login === login)?.Name ?? login
      )
      const accountEmails = accounts.map(
        login => cluster.find(t => t.Login === login)?.Email ?? ''
      )
      const uniqueEmails = Array.from(new Set(accountEmails.filter(Boolean)))
      const crossClient = uniqueEmails.length > 1

      // Cross-client copies are significantly more suspicious
      if (crossClient) riskScore += 25

      const riskLevel: SuspiciousGroup['riskLevel'] =
        riskScore >= 60 ? 'ALTO' : riskScore >= 35 ? 'MEDIO' : 'BAJO'

      // Sort cluster trades by open time for display
      cluster.sort((a, b) => a.OpenDate!.getTime() - b.OpenDate!.getTime())

      groups.push({
        groupId: ++groupId,
        symbol,
        accounts,
        accountNames,
        accountEmails,
        uniqueEmails,
        crossClient,
        trades: cluster,
        pattern,
        openDeltaSecs,
        closeDeltaSecs,
        coincidences,
        riskLevel,
        riskScore,
      })
    }
  }

  return groups.sort((a, b) => b.riskScore - a.riskScore)
}
