import { Trade } from './dataParser'

export interface EAGroup {
  groupId: number
  commentKey: string
  matchType: 'EXACT' | 'PATTERN'
  accounts: string[]
  accountNames: string[]
  accountEmails: string[]     // email per account (same index as accounts[])
  uniqueEmails: string[]      // deduplicated
  crossClient: boolean        // true if 2+ distinct emails
  trades: Trade[]
  symbols: string[]
  tradeCount: number
  accountCount: number
  riskLevel: 'ALTO' | 'MEDIO' | 'BAJO'
  riskScore: number
  sampleComments: string[]
}

// Remove trailing ticket/magic number IDs that EAs append
// e.g. "MyEA #12345" → "MyEA"   "signal_v2 98732" → "signal_v2"
function baseKey(comment: string): string {
  return comment
    .trim()
    .toLowerCase()
    // Strip trailing numeric ID after space, #, _, -, /
    .replace(/[\s#_\-/]+\d{3,}$/, '')
    // Strip lone trailing digits
    .replace(/\s+\d+$/, '')
    .trim()
}

export function detectEAs(trades: Trade[]): EAGroup[] {
  // Only trades with non-empty comments
  const withComment = trades.filter(t => t.Comment && t.Comment.trim() !== '')

  if (withComment.length === 0) return []

  // ── Pass 1: group by exact normalized comment ──────────────────────────────
  const exactMap = new Map<string, Trade[]>()
  for (const t of withComment) {
    const key = t.Comment.trim().toLowerCase()
    if (!exactMap.has(key)) exactMap.set(key, [])
    exactMap.get(key)!.push(t)
  }

  // ── Pass 2: group by base pattern (trailing number stripped) ──────────────
  const patternMap = new Map<string, Trade[]>()
  for (const t of withComment) {
    const key = baseKey(t.Comment)
    if (!key) continue
    if (!patternMap.has(key)) patternMap.set(key, [])
    patternMap.get(key)!.push(t)
  }

  const groups: EAGroup[] = []
  let groupId = 0
  const usedTickets = new Set<string>() // avoid double-counting trades already in exact groups

  // Helper to build a group from a set of trades + meta
  const buildGroup = (
    commentKey: string,
    matchType: EAGroup['matchType'],
    cluster: Trade[]
  ): EAGroup | null => {
    const loginSet = new Set(cluster.map(t => t.Login))
    if (loginSet.size < 2) return null

    const accounts = Array.from(loginSet)
    const accountNames = accounts.map(
      login => cluster.find(t => t.Login === login)?.Name ?? login
    )
    const accountEmails = accounts.map(
      login => cluster.find(t => t.Login === login)?.Email ?? ''
    )
    const uniqueEmails = Array.from(new Set(accountEmails.filter(Boolean)))
    const crossClient = uniqueEmails.length > 1

    const symbols = Array.from(new Set(cluster.map(t => t.Symbol)))

    // Sample raw comments (unique, up to 5)
    const seen = new Set<string>()
    const sampleComments: string[] = []
    for (const t of cluster) {
      if (!seen.has(t.Comment) && sampleComments.length < 5) {
        seen.add(t.Comment)
        sampleComments.push(t.Comment)
      }
    }

    const accountCount = loginSet.size
    const tradeCount = cluster.length

    let riskScore = 0
    riskScore += accountCount * 15
    riskScore += Math.min(tradeCount * 2, 40)
    if (matchType === 'EXACT') riskScore += 20
    if (symbols.length <= 2) riskScore += 10
    if (accountCount >= 5) riskScore += 15
    if (crossClient) riskScore += 20   // cross-client EA sharing is more suspicious

    const riskLevel: EAGroup['riskLevel'] =
      riskScore >= 70 ? 'ALTO' : riskScore >= 40 ? 'MEDIO' : 'BAJO'

    return {
      groupId: ++groupId,
      commentKey,
      matchType,
      accounts,
      accountNames,
      accountEmails,
      uniqueEmails,
      crossClient,
      trades: [...cluster].sort((a, b) =>
        (a.OpenDate?.getTime() ?? 0) - (b.OpenDate?.getTime() ?? 0)
      ),
      symbols,
      tradeCount,
      accountCount,
      riskLevel,
      riskScore,
      sampleComments,
    }
  }

  // Process exact matches first
  for (const [key, cluster] of exactMap) {
    if (new Set(cluster.map(t => t.Login)).size < 2) continue
    const g = buildGroup(key, 'EXACT', cluster)
    if (g) {
      groups.push(g)
      cluster.forEach(t => usedTickets.add(t.Ticket))
    }
  }

  // Process pattern matches — skip tickets already captured as exact
  for (const [key, cluster] of patternMap) {
    const fresh = cluster.filter(t => !usedTickets.has(t.Ticket))
    if (new Set(fresh.map(t => t.Login)).size < 2) continue
    // Skip if the key is too short to be meaningful (avoid false positives)
    if (key.length < 3) continue
    const g = buildGroup(key, 'PATTERN', fresh)
    if (g) {
      groups.push(g)
    }
  }

  return groups.sort((a, b) => b.riskScore - a.riskScore)
}
