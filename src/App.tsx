import React, { useState, useCallback } from 'react'
import FileUploader from './components/FileUploader'
import AssetsTab from './components/tabs/AssetsTab'
import SidesTab from './components/tabs/SidesTab'
import ExtremeTradesTab from './components/tabs/ExtremeTradesTab'
import CopyDetectionTab from './components/tabs/CopyDetectionTab'
import StatsTab from './components/tabs/StatsTab'
import AllTradesTab from './components/tabs/AllTradesTab'
import EADetectionTab from './components/tabs/EADetectionTab'
import DailyActivityTab from './components/tabs/DailyActivityTab'
import AccountComparisonView from './components/AccountComparisonView'
import PayoutsView from './components/PayoutsView'
import WithdrawableProfitsView from './components/WithdrawableProfitsView'
import { parseTradesFile, parseAccountsFile, Trade, Account } from './utils/dataParser'
import { computeAssetStats, computeSideStats, computeGeneralStats, AssetStats, SideStats, GeneralStats } from './utils/analytics'
import { detectCopyTrading, SuspiciousGroup } from './utils/copyDetection'
import { detectEAs, EAGroup } from './utils/eaDetection'

type AppMode = null | 'general' | 'comparison' | 'payouts' | 'withdrawable'
type TabId = 'stats' | 'assets' | 'sides' | 'extremes' | 'copy' | 'ea' | 'all' | 'daily'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'stats', label: 'General', icon: '◈' },
  { id: 'assets', label: 'Activos', icon: '◎' },
  { id: 'sides', label: 'BUY vs SELL', icon: '⇅' },
  { id: 'extremes', label: 'Extremos', icon: '⬆⬇' },
  { id: 'all', label: 'Todos los Trades', icon: '≡' },
  { id: 'daily', label: 'Daily Activity', icon: '⏱' },
  { id: 'copy', label: 'Copy Detection', icon: '⚑' },
  { id: 'ea', label: 'EA Detection', icon: '⚙' },
]

interface AnalysisResult {
  trades: Trade[]
  accounts: Map<string, Account>
  assetStats: AssetStats[]
  sideStats: SideStats[]
  generalStats: GeneralStats
  suspiciousGroups: SuspiciousGroup[]
  eaGroups: EAGroup[]
  warnings: string[]
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>(null)
  const [tradesFile, setTradesFile] = useState<File | null>(null)
  const [accountsFile, setAccountsFile] = useState<File | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('stats')

  const analyze = useCallback(async () => {
    if (!tradesFile || !accountsFile) return
    setLoading(true)
    setError(null)

    try {
      const accounts = await parseAccountsFile(accountsFile)
      const { trades, warnings } = await parseTradesFile(tradesFile, accounts)

      if (trades.length === 0) {
        setError('No se encontraron trades en el archivo. Verifica el formato.')
        setLoading(false)
        return
      }

      const assetStats = computeAssetStats(trades)
      const sideStats = computeSideStats(trades)
      const generalStats = computeGeneralStats(trades)
      const suspiciousGroups = detectCopyTrading(trades)
      const eaGroups = detectEAs(trades)

      setResult({ trades, accounts, assetStats, sideStats, generalStats, suspiciousGroups, eaGroups, warnings })
      setActiveTab('stats')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido al procesar los archivos')
    } finally {
      setLoading(false)
    }
  }, [tradesFile, accountsFile])

  const exportJson = () => {
    if (!result) return
    const data = {
      summary: {
        totalTrades: result.generalStats.totalTrades,
        totalNetProfit: result.generalStats.totalNetProfit,
        winRate: result.generalStats.winRate,
        activeAccounts: result.generalStats.activeAccounts,
      },
      assetStats: result.assetStats,
      sideStats: result.sideStats,
      suspiciousGroups: result.suspiciousGroups.map(g => ({
        groupId: g.groupId,
        symbol: g.symbol,
        pattern: g.pattern,
        riskLevel: g.riskLevel,
        riskScore: g.riskScore,
        accounts: g.accounts,
        openDeltaSecs: g.openDeltaSecs,
        closeDeltaSecs: g.closeDeltaSecs,
      })),
      topWinners: [...result.trades].sort((a, b) => b.NetProfit - a.NetProfit).slice(0, 10).map(t => ({
        ticket: t.Ticket, login: t.Login, symbol: t.Symbol, type: t.Type,
        profit: t.NetProfit, pnlPct: t.PnlPercent,
      })),
      topLosers: [...result.trades].sort((a, b) => a.NetProfit - b.NetProfit).slice(0, 10).map(t => ({
        ticket: t.Ticket, login: t.Login, symbol: t.Symbol, type: t.Type,
        profit: t.NetProfit, pnlPct: t.PnlPercent,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `risk-analysis-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              R
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-100 leading-none">Risk Accounts Analyzer</h1>
              <p className="text-xs text-gray-500 mt-0.5">Prop Firm Trade Analysis</p>
            </div>
          </div>
          {result && (
            <button
              onClick={exportJson}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              Exportar JSON
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Mode selector landing */}
        {appMode === null && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-100">Análisis de Riesgo</h2>
              <p className="text-gray-500 mt-2 text-sm">Seleccioná el tipo de análisis a realizar</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setAppMode('general')}
                className="bg-gray-900 border border-gray-700 hover:border-indigo-600 rounded-2xl p-6 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-600/40 flex items-center justify-center text-indigo-400 text-xl mb-4 group-hover:bg-indigo-600/30 transition-colors">
                  ◈
                </div>
                <h3 className="font-bold text-gray-100 mb-1">Análisis General</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Carga un Positions History y un archivo de cuentas. Obtené estadísticas, copy detection, EA detection y más.
                </p>
              </button>
              <button
                onClick={() => setAppMode('comparison')}
                className="bg-gray-900 border border-gray-700 hover:border-purple-600 rounded-2xl p-6 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-600/40 flex items-center justify-center text-purple-400 text-xl mb-4 group-hover:bg-purple-600/30 transition-colors">
                  ⇄
                </div>
                <h3 className="font-bold text-gray-100 mb-1">Comparación de Cuentas</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Carga dos historiales de operaciones individuales y detectá copy trading o hedging entre ellas.
                </p>
              </button>
              <button
                onClick={() => setAppMode('payouts')}
                className="bg-gray-900 border border-gray-700 hover:border-emerald-600 rounded-2xl p-6 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center text-emerald-400 text-xl mb-4 group-hover:bg-emerald-600/30 transition-colors">
                  $
                </div>
                <h3 className="font-bold text-gray-100 mb-1">Payouts por Programa</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Carga un archivo de payouts. Analizá montos, shares y tiempos de aprobación por tipo de programa.
                </p>
              </button>
              <button
                onClick={() => setAppMode('withdrawable')}
                className="bg-gray-900 border border-gray-700 hover:border-amber-500 rounded-2xl p-6 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl mb-4 group-hover:bg-amber-500/30 transition-colors">
                  ⬆
                </div>
                <h3 className="font-bold text-gray-100 mb-1">Withdrawable Profits</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Analizá cuentas con profit retirable. Filtrá por programa, buscá por email o cuenta, y visualizá shares y retiros.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Comparison mode */}
        {appMode === 'comparison' && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <button
                onClick={() => setAppMode(null)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Volver
              </button>
              <h2 className="text-sm font-bold text-gray-300">Comparación de Cuentas</h2>
            </div>
            <AccountComparisonView />
          </div>
        )}

        {/* Payouts mode */}
        {appMode === 'payouts' && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <button
                onClick={() => setAppMode(null)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Volver
              </button>
              <h2 className="text-sm font-bold text-gray-300">Payouts por Programa</h2>
            </div>
            <PayoutsView />
          </div>
        )}

        {/* Withdrawable Profits mode */}
        {appMode === 'withdrawable' && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <button
                onClick={() => setAppMode(null)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Volver
              </button>
              <h2 className="text-sm font-bold text-gray-300">Withdrawable Profits</h2>
            </div>
            <WithdrawableProfitsView />
          </div>
        )}

        {/* General analysis mode */}
        {appMode === 'general' && (
          <div>
            {/* Upload section */}
            {!result && (
              <div className="max-w-2xl mx-auto">
                <div className="mb-5">
                  <button
                    onClick={() => setAppMode(null)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    ← Volver
                  </button>
                </div>

                <div className="space-y-4">
                  <FileUploader
                    label="Archivo de Trades (Positions History)"
                    onFile={setTradesFile}
                    loaded={!!tradesFile}
                    fileName={tradesFile?.name}
                  />
                  <FileUploader
                    label="Archivo de Cuentas (Prop Accounts)"
                    onFile={setAccountsFile}
                    loaded={!!accountsFile}
                    fileName={accountsFile?.name}
                  />

                  {error && (
                    <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={analyze}
                    disabled={!tradesFile || !accountsFile || loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analizando...
                      </span>
                    ) : 'Analizar'}
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <div>
                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="mb-4 bg-yellow-950/30 border border-yellow-800/50 rounded-xl p-3">
                    <p className="text-xs text-yellow-400 font-semibold mb-1">
                      {result.warnings.length} advertencia(s) durante el parseo
                    </p>
                    <ul className="text-xs text-yellow-600 space-y-0.5 max-h-20 overflow-y-auto scrollbar-thin">
                      {result.warnings.slice(0, 10).map((w, i) => <li key={i}>· {w}</li>)}
                      {result.warnings.length > 10 && <li>· ... y {result.warnings.length - 10} más</li>}
                    </ul>
                  </div>
                )}

                {/* Reload button */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-emerald-400 font-semibold">{result.trades.length.toLocaleString()} trades</span>
                    <span>·</span>
                    <span>{result.accounts.size.toLocaleString()} cuentas</span>
                    <span>·</span>
                    <span>{result.suspiciousGroups.length} grupos sospechosos</span>
                  </div>
                  <button
                    onClick={() => { setResult(null); setTradesFile(null); setAccountsFile(null) }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Cargar nuevos archivos
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-800 mb-6">
                  <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-px">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                          ${activeTab === tab.id
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                      >
                        <span className="text-base leading-none">{tab.icon}</span>
                        {tab.label}
                        {tab.id === 'copy' && result.suspiciousGroups.filter(g => g.riskLevel === 'ALTO').length > 0 && (
                          <span className="bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                            {result.suspiciousGroups.filter(g => g.riskLevel === 'ALTO').length}
                          </span>
                        )}
                        {tab.id === 'ea' && result.eaGroups.filter(g => g.riskLevel === 'ALTO').length > 0 && (
                          <span className="bg-orange-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                            {result.eaGroups.filter(g => g.riskLevel === 'ALTO').length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div>
                  {activeTab === 'stats' && <StatsTab stats={result.generalStats} />}
                  {activeTab === 'assets' && <AssetsTab stats={result.assetStats} />}
                  {activeTab === 'sides' && <SidesTab stats={result.sideStats} />}
                  {activeTab === 'extremes' && <ExtremeTradesTab trades={result.trades} />}
                  {activeTab === 'all' && <AllTradesTab trades={result.trades} />}
                  {activeTab === 'daily' && <DailyActivityTab trades={result.trades} />}
                  {activeTab === 'copy' && <CopyDetectionTab groups={result.suspiciousGroups} />}
                  {activeTab === 'ea' && <EADetectionTab groups={result.eaGroups} />}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
