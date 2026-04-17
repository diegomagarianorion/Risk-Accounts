import Papa from 'papaparse'

export interface Trade {
  Login: string
  Name: string
  Time: string
  Ticket: string
  Type: string
  Volume: number
  Symbol: string
  Price: number
  SL: number
  TP: number
  CloseTime: string
  ClosePrice: number
  Reason: string
  Commission: number
  Fee: number
  Swap: number
  Profit: number
  Currency: string
  Comment: string
  // Derived fields
  NetProfit: number
  OpenDate: Date | null
  CloseDate: Date | null
  DurationMs: number
  PnlPercent: number | null
  Balance: number | null
  Email: string
}

export interface Account {
  Account: string
  Customer: string
  OrderNr: string
  Name: string
  Labels: string
  Balance: number
  Equity: number
  Program: string
  Status: string
  Category: string
  Email: string
  [key: string]: string | number
}

// Parse "2026.04.07 07:54:58.725" → Date
function parseTradeDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null
  try {
    // Replace dots in date part with dashes, space stays, ignore ms
    const normalized = raw.trim().replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')
    const d = new Date(normalized)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

// Convert UTF-16LE file buffer to UTF-8 string
async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    // Try UTF-16LE first, fall back to UTF-8
    reader.readAsText(file, 'UTF-16LE')
  })
}

async function readAsUtf8(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

export async function parseTradesFile(
  file: File,
  accounts: Map<string, Account>
): Promise<{ trades: Trade[]; warnings: string[] }> {
  const warnings: string[] = []
  let text = ''

  // Detect encoding: try UTF-16LE, check if looks right
  const raw = await readAsText(file)
  // UTF-16LE decoded files have BOM stripped by FileReader, check for tab-separated content
  if (raw.includes('\t') && (raw.includes('Login') || raw.includes('login'))) {
    text = raw
  } else {
    // Try UTF-8
    text = await readAsUtf8(file)
  }

  // Remove BOM if present
  text = text.replace(/^\uFEFF/, '')

  // Split lines and find header row (line containing "Login" and "Ticket")
  const lines = text.split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('Login') && lines[i].includes('Ticket')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    throw new Error('No se encontró la fila de encabezado en el archivo de trades.')
  }

  const dataLines = lines.slice(headerIdx).join('\n')

  const result = Papa.parse<Record<string, string>>(dataLines, {
    header: true,
    delimiter: '\t',
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    result.errors.slice(0, 5).forEach(e => warnings.push(`Fila ${e.row}: ${e.message}`))
  }

  const trades: Trade[] = []

  for (const row of result.data) {
    const login = (row['Login'] || '').trim()
    if (!login || login === 'Login' || login.toLowerCase() === 'total') continue

    const openDate = parseTradeDate(row['Time'])
    const closeDate = parseTradeDate(row['Close Time'] || row['CloseTime'])

    if (!openDate) {
      warnings.push(`Trade ${row['Ticket']}: fecha de apertura inválida "${row['Time']}"`)
    }

    const profit = parseFloat(row['Profit']) || 0
    const commission = parseFloat(row['Commission']) || 0
    const fee = parseFloat(row['Fee']) || 0
    const swap = parseFloat(row['Swap']) || 0
    const netProfit = profit + commission + fee + swap

    // P&L %
    let pnlPercent: number | null = null
    const account = accounts.get(login)
    if (account && account.Balance > 0) {
      pnlPercent = (profit / account.Balance) * 100
    }

    const durationMs =
      openDate && closeDate ? closeDate.getTime() - openDate.getTime() : 0

    trades.push({
      Login: login,
      Name: (row['Name'] || '').trim(),
      Time: (row['Time'] || '').trim(),
      Ticket: (row['Ticket'] || '').trim(),
      Type: (row['Type'] || '').trim().toLowerCase(),
      Volume: parseFloat(row['Volume']) || 0,
      Symbol: (row['Symbol'] || '').trim().toUpperCase(),
      Price: parseFloat(row['Price']) || 0,
      SL: parseFloat(row['S / L'] || row['SL'] || '0') || 0,
      TP: parseFloat(row['T / P'] || row['TP'] || '0') || 0,
      CloseTime: (row['Close Time'] || row['CloseTime'] || '').trim(),
      ClosePrice: parseFloat(row['Close Price'] || row['ClosePrice'] || '0') || 0,
      Reason: (row['Reason'] || '').trim(),
      Commission: commission,
      Fee: fee,
      Swap: swap,
      Profit: profit,
      Currency: (row['Currency'] || 'USD').trim(),
      Comment: (row['Comment'] || '').trim(),
      NetProfit: netProfit,
      OpenDate: openDate,
      CloseDate: closeDate,
      DurationMs: durationMs,
      PnlPercent: pnlPercent,
      Balance: account?.Balance ?? null,
      Email: account?.Email ?? '',
    })
  }

  return { trades, warnings }
}

export async function parseAccountsFile(file: File): Promise<Map<string, Account>> {
  const text = await readAsUtf8(file)
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const map = new Map<string, Account>()
  for (const row of result.data) {
    const acct = (row['Account'] || '').trim()
    if (!acct) continue
    map.set(acct, {
      Account: acct,
      Customer: row['Customer'] || '',
      OrderNr: row['Order Nr'] || '',
      Name: row['Name'] || '',
      Labels: row['Labels'] || '',
      Balance: parseFloat(row['Balance']) || 0,
      Equity: parseFloat(row['Equity']) || 0,
      Program: row['Program'] || '',
      Status: row['Status'] || '',
      Category: row['Category'] || '',
      Email: row['Email'] || '',
    })
  }
  return map
}
