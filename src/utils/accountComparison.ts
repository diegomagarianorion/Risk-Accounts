import { AccountTrade } from './accountParser'

// ─── EA Detection ────────────────────────────────────────────────────────────

export interface AccountEAGroup {
  eaId: number
  commentKey: string
  matchType: 'EXACT' | 'PATTERN'
  tradesA: AccountTrade[]
  tradesB: AccountTrade[]
  symbols: string[]
  tradeCount: number
  riskScore: number
  riskLevel: 'ALTO' | 'MEDIO' | 'BAJO'
  sampleComments: string[]
}

function baseKey(comment: string): string {
  return comment
    .trim()
    .toLowerCase()
    .replace(/[\s#_\-/]+\d{3,}$/, '')
    .replace(/\s+\d+$/, '')
    .trim()
}

export function detectAccountEAs(
  tradesA: AccountTrade[],
  tradesB: AccountTrade[]
): AccountEAGroup[] {
  const withCommentA = tradesA.filter(t => t.Comment && t.Comment.trim() !== '' && t.Comment.trim() !== '-')
  const withCommentB = tradesB.filter(t => t.Comment && t.Comment.trim() !== '' && t.Comment.trim() !== '-')

  if (withCommentA.length === 0 || withCommentB.length === 0) return []

  const allTrades = [...withCommentA, ...withCommentB]

  const groups: AccountEAGroup[] = []
  let eaId = 0
  const usedTickets = new Set<string>()

  const buildGroup = (
    commentKey: string,
    matchType: AccountEAGroup['matchType'],
    cluster: AccountTrade[]
  ): AccountEAGroup | null => {
    const fromA = cluster.filter(t => withCommentA.some(a => a.Ticket === t.Ticket))
    const fromB = cluster.filter(t => withCommentB.some(b => b.Ticket === t.Ticket))
    // Must appear in BOTH accounts
    if (fromA.length === 0 || fromB.length === 0) return null

    const symbols = Array.from(new Set(cluster.map(t => t.Symbol)))

    const seen = new Set<string>()
    const sampleComments: string[] = []
    for (const t of cluster) {
      if (!seen.has(t.Comment) && sampleComments.length < 5) {
        seen.add(t.Comment)
        sampleComments.push(t.Comment)
      }
    }

    const tradeCount = cluster.length
    let riskScore = 0
    riskScore += Math.min(tradeCount * 2, 40)
    if (matchType === 'EXACT') riskScore += 20
    if (symbols.length <= 2)   riskScore += 10
    riskScore += 20 // always two different accounts = cross-account

    const riskLevel: AccountEAGroup['riskLevel'] =
      riskScore >= 60 ? 'ALTO' : riskScore >= 35 ? 'MEDIO' : 'BAJO'

    return {
      eaId: ++eaId,
      commentKey,
      matchType,
      tradesA: fromA,
      tradesB: fromB,
      symbols,
      tradeCount,
      riskScore,
      riskLevel,
      sampleComments,
    }
  }

  // Pass 1: exact comment match
  const exactMap = new Map<string, AccountTrade[]>()
  for (const t of allTrades) {
    const key = t.Comment.trim().toLowerCase()
    if (!exactMap.has(key)) exactMap.set(key, [])
    exactMap.get(key)!.push(t)
  }
  for (const [key, cluster] of exactMap) {
    const g = buildGroup(key, 'EXACT', cluster)
    if (g) {
      groups.push(g)
      cluster.forEach(t => usedTickets.add(t.Ticket))
    }
  }

  // Pass 2: base pattern match (trailing number stripped)
  const patternMap = new Map<string, AccountTrade[]>()
  for (const t of allTrades) {
    const key = baseKey(t.Comment)
    if (!key || key.length < 3) continue
    if (!patternMap.has(key)) patternMap.set(key, [])
    patternMap.get(key)!.push(t)
  }
  for (const [key, cluster] of patternMap) {
    const fresh = cluster.filter(t => !usedTickets.has(t.Ticket))
    const g = buildGroup(key, 'PATTERN', fresh)
    if (g) groups.push(g)
  }

  return groups.sort((a, b) => b.riskScore - a.riskScore)
}

// ─── Copy / Hedge Detection ───────────────────────────────────────────────────

export interface ComparisonMatch {
  matchId: number
  symbol: string
  pattern: 'COPY_EXACT' | 'HEDGING'
  tradeA: AccountTrade
  tradeB: AccountTrade
  openDeltaSecs: number
  closeDeltaSecs: number
  riskScore: number
  riskLevel: 'ALTO' | 'MEDIO' | 'BAJO'
}

// Always detect at max window (10 min), filter in UI
const MAX_WINDOW_MS = 600_000

export function compareAccounts(
  tradesA: AccountTrade[],
  tradesB: AccountTrade[]
): ComparisonMatch[] {
  const matches: ComparisonMatch[] = []
  let matchId = 0

  // Group by symbol for efficiency
  const bySymbolA = new Map<string, AccountTrade[]>()
  const bySymbolB = new Map<string, AccountTrade[]>()

  for (const t of tradesA) {
    if (!t.OpenTime || !t.CloseTime) continue
    if (!bySymbolA.has(t.Symbol)) bySymbolA.set(t.Symbol, [])
    bySymbolA.get(t.Symbol)!.push(t)
  }
  for (const t of tradesB) {
    if (!t.OpenTime || !t.CloseTime) continue
    if (!bySymbolB.has(t.Symbol)) bySymbolB.set(t.Symbol, [])
    bySymbolB.get(t.Symbol)!.push(t)
  }

  for (const [symbol, listA] of bySymbolA) {
    const listB = bySymbolB.get(symbol)
    if (!listB) continue

    // Sort both by open time for early-exit
    listA.sort((a, b) => a.OpenTime!.getTime() - b.OpenTime!.getTime())
    listB.sort((a, b) => a.OpenTime!.getTime() - b.OpenTime!.getTime())

    for (const tA of listA) {
      const tAOpen  = tA.OpenTime!.getTime()
      const tAClose = tA.CloseTime!.getTime()

      for (const tB of listB) {
        const tBOpen = tB.OpenTime!.getTime()

        // OR condition: can't break on open-diff alone (closeDiff might still qualify)
        // Skip if B opened too far before A (safe: B list is sorted, earlier entries won't help)
        if (tAOpen - tBOpen > MAX_WINDOW_MS) continue
        // If B opened too far ahead, remaining B entries are even further — but closeDiff might match,
        // so we can only continue (not break) when open times diverge
        if (tBOpen - tAOpen > MAX_WINDOW_MS) continue

        const tBClose = tB.CloseTime!.getTime()
        const openDiff  = Math.abs(tAOpen  - tBOpen)
        const closeDiff = Math.abs(tAClose - tBClose)

        // Include if at least one delta is within window (UI filters apply the precise mode)
        if (openDiff > MAX_WINDOW_MS && closeDiff > MAX_WINDOW_MS) continue

        const openDeltaSecs  = openDiff  / 1000
        const closeDeltaSecs = closeDiff / 1000

        const pattern: ComparisonMatch['pattern'] =
          tA.Side === tB.Side ? 'COPY_EXACT' : 'HEDGING'

        let riskScore = 0
        riskScore += openDeltaSecs  < 5  ? 30 : openDeltaSecs  < 15 ? 20 : 10
        riskScore += closeDeltaSecs < 10 ? 15 : closeDeltaSecs < 20 ? 10 : 5
        if (pattern === 'COPY_EXACT') riskScore += 15
        if (pattern === 'HEDGING')    riskScore += 20

        const riskLevel: ComparisonMatch['riskLevel'] =
          riskScore >= 50 ? 'ALTO' : riskScore >= 30 ? 'MEDIO' : 'BAJO'

        matches.push({
          matchId: ++matchId,
          symbol,
          pattern,
          tradeA: tA,
          tradeB: tB,
          openDeltaSecs,
          closeDeltaSecs,
          riskScore,
          riskLevel,
        })
      }
    }
  }

  return matches.sort((a, b) => b.riskScore - a.riskScore)
}
