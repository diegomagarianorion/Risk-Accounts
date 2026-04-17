import Papa from 'papaparse'

export interface AccountTrade {
  Ticket: string
  OpenTime: Date | null
  CloseTime: Date | null
  OpenPrice: number
  ClosePrice: number
  Side: string        // 'buy' | 'sell' (normalizado)
  Symbol: string
  PnL: number
  Volume: number
  Lots: number
  Commission: number
  Swap: number
  SL: number
  TP: number
  DurationMs: number
  Comment: string
  Position: string
  AccountLabel: string
}

// Parse "DD/MM/YYYY HH:MM:SS"
function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, ss] = m
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`)
  return isNaN(d.getTime()) ? null : d
}

export async function parseAccountTradeFile(
  file: File,
  label: string
): Promise<AccountTrade[]> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })

  const cleaned = text.replace(/^\uFEFF/, '')

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  })

  const trades: AccountTrade[] = []
  for (const row of result.data) {
    const ticket = (row['Ticket'] || '').trim()
    if (!ticket) continue

    const openTime  = parseDate(row['Open Time']  || '')
    const closeTime = parseDate(row['Close Time'] || '')
    const durationMs =
      openTime && closeTime ? closeTime.getTime() - openTime.getTime() : 0

    trades.push({
      Ticket:       ticket,
      OpenTime:     openTime,
      CloseTime:    closeTime,
      OpenPrice:    parseFloat(row['Open Price']  || '0') || 0,
      ClosePrice:   parseFloat(row['Close Price'] || '0') || 0,
      Side:         (row['Side'] || '').toLowerCase(),
      Symbol:       (row['Symbol'] || '').trim().toUpperCase(),
      PnL:          parseFloat(row['PnL']         || '0') || 0,
      Volume:       parseFloat(row['Volume']       || '0') || 0,
      Lots:         parseFloat(row['Lots']         || '0') || 0,
      Commission:   parseFloat(row['Commissons']   || '0') || 0,
      Swap:         parseFloat(row['Swap']         || '0') || 0,
      SL:           parseFloat(row['SL']           || '0') || 0,
      TP:           parseFloat(row['Tp']           || '0') || 0,
      DurationMs:   durationMs,
      Comment:      (row['Comment']  || '').trim(),
      Position:     (row['Position'] || '').trim(),
      AccountLabel: label,
    })
  }

  return trades
}
