"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { createChart, ColorType, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Rocket, History, X, Clock, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { APIService, type TokenInfo, type OHLCVDataPoint } from "@/lib/api-service"
import { generateTradingSignals, type SignalParameters, type TradeAnalytics } from "@/lib/technical-analysis"
import { useOptimization } from "@/hooks/use-optimization"
import { usePoolHistory } from "@/hooks/use-pool-history"
import { usePoolSearch } from "@/hooks/use-pool-search"
import { useOHLCVCache } from "@/hooks/use-ohlcv-cache"
import { useRateLimitMonitor } from "@/hooks/use-rate-limit-monitor"
import { CHART_CONFIG, INTERVALS, API_CONFIG, DEFAULT_PARAMETERS, HISTORICAL_RANGES, getMaxRecommendedDays, calculateOptimalLimit, getChartColors } from "@/lib/chart-config"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Type definitions for tooltip
interface TooltipData {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

export function ChartContainer() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null)
  
  // Core state
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [interval, setInterval] = useState<string>("15m")
  const [tokenAddress, setTokenAddress] = useState<string>(API_CONFIG.DEFAULT_POOL)
  const [ohlcvData, setOhlcvData] = useState<OHLCVDataPoint[] | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [showAllSignals, setShowAllSignals] = useState(false)
  const [dataLoadSource, setDataLoadSource] = useState<string | null>(null)
  
  // Pool history hook
  const { history, addToHistory, removeFromHistory, clearHistory } = usePoolHistory()
  
  // Pool search hook
  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, loading: searchLoading, clearSearch } = usePoolSearch()
  
  // OHLCV cache hook
  const { getFromCache, saveToCache, cacheStats, clearAllCache, getCacheSize, getCacheDebugInfo } = useOHLCVCache()
  
  // Rate limit monitor hook
  const rateLimitMonitor = useRateLimitMonitor()
  
  // Theme hook for dark mode support
  const { theme, resolvedTheme } = useTheme()
  const isDarkMode = resolvedTheme === 'dark'
  
  // Expose debug functions to window for easy debugging
  useEffect(() => {
    (window as any).debugCache = getCacheDebugInfo
    (window as any).debugRateLimit = rateLimitMonitor.getDetailedBreakdown
    console.log('🔧 Debug helpers: Run window.debugCache() or window.debugRateLimit() for detailed info')
  }, [getCacheDebugInfo, rateLimitMonitor])
  
  // Search popover state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  
  // Strategy parameters
  const [parameters, setParameters] = useState<SignalParameters>(DEFAULT_PARAMETERS)
  const [tradeAnalytics, setTradeAnalytics] = useState<TradeAnalytics>({
    initialInvestment: 1000,
    currentPortfolioValue: 1000,
    totalPercentageChange: 0,
    trades: []
  })

  // Optimization hook - memoized to prevent re-creation
  const optimizationConfig = useMemo(() => ({
    ohlcvData,
    onParametersUpdate: setParameters
  }), [ohlcvData])
  
  const optimization = useOptimization(optimizationConfig)

  // Add historical range state
  const [historicalRange, setHistoricalRange] = useState<string>("1w")

  // Only show search results when user has paused typing and there are results
  const shouldShowSearch = searchFocused && !!searchQuery && searchQuery.length >= 2 && (searchResults.length > 0 || searchLoading)

  const fetchData = useCallback(async () => {
    console.log(`🚀 FETCHDATA STARTING:`)
    console.log(`   Pool: ${tokenAddress?.slice(0, 8)}...${tokenAddress?.slice(-4)}`)
    console.log(`   Interval: ${interval}`)
    console.log(`   Historical Range: ${historicalRange}`)
    
    setDataLoadSource('Loading...')
    try {
      setLoading(true)
      setError(null)
      
      // Calculate days based on selected range
      const selectedRange = HISTORICAL_RANGES[historicalRange as keyof typeof HISTORICAL_RANGES]
      const maxDays = getMaxRecommendedDays(interval)
      const requestedDays = selectedRange.days || maxDays
      const actualDays = Math.min(requestedDays, maxDays)
      
      console.log(`   Range calculation:`)
      console.log(`     Selected range days: ${selectedRange.days}`)
      console.log(`     Max days for interval: ${maxDays}`)
      console.log(`     Actual days: ${actualDays}`)
      
      // Calculate the limit based on interval and days
      const customLimit = selectedRange.days !== null 
        ? calculateOptimalLimit(interval, actualDays)
        : undefined;
        
      console.log(`   Custom limit: ${customLimit}`)
      
      // Check cache first
      const cacheKey = { poolAddress: tokenAddress, interval, limit: customLimit }
      console.log(`🔍 CHECKING CACHE:`, cacheKey)
      const cachedData = getFromCache(cacheKey)
      
      if (cachedData) {
        // We have cached OHLCV data, but still need to fetch token info
        console.log(`✅ CACHE HIT - Using cached OHLCV data`)
        console.log(`   Cached data points: ${cachedData.length}`)
        console.log(`   Still fetching fresh token info...`)
        
        setDataLoadSource('Cache')
        const tokenInfo = await APIService.fetchPoolWithTokens(tokenAddress)
        
        setTokenInfo(tokenInfo)
        setOhlcvData(cachedData)
        setLoading(false)
        
        // Add to history
        if (tokenInfo && tokenInfo.baseSymbol && tokenInfo.quoteSymbol) {
          addToHistory({
            address: tokenAddress,
            baseSymbol: tokenInfo.baseSymbol,
            quoteSymbol: tokenInfo.quoteSymbol,
            name: tokenInfo.name || `${tokenInfo.baseSymbol}/${tokenInfo.quoteSymbol}`
          })
        }
        
        console.log(`✅ FETCHDATA COMPLETE (CACHE)`)
        setTimeout(() => setDataLoadSource(null), 2000)
        return
      }
      
      // No cache hit, fetch from API
      console.log(`❌ CACHE MISS - Fetching fresh data from API`)
      console.log(`   Pool: ${tokenAddress?.slice(0, 8)}...${tokenAddress?.slice(-4)}`)
      console.log(`   Interval: ${interval}`)
      console.log(`   Limit: ${customLimit}`)
      
      setDataLoadSource('API')
      
      // Record API call for rate limiting (only when actually making API call)
      rateLimitMonitor.recordApiCall('ohlcv-data', tokenAddress, interval)
      
      const { tokenInfo: fetchedTokenInfo, ohlcvData: fetchedOhlcvData } = await APIService.fetchChartDataWithLimit(
        tokenAddress,
        interval,
        customLimit
      )

      console.log(`📡 API RESPONSE RECEIVED:`)
      console.log(`   OHLCV data points: ${fetchedOhlcvData.length}`)
      console.log(`   Token info: ${fetchedTokenInfo.baseSymbol}/${fetchedTokenInfo.quoteSymbol}`)

      // Save to cache
      console.log(`💾 SAVING TO CACHE...`)
      saveToCache(cacheKey, fetchedOhlcvData)

      setTokenInfo(fetchedTokenInfo)
      setOhlcvData(fetchedOhlcvData)
      setLoading(false)
      
      // Add to history on successful load
      if (fetchedTokenInfo && fetchedTokenInfo.baseSymbol && fetchedTokenInfo.quoteSymbol) {
        addToHistory({
          address: tokenAddress,
          baseSymbol: fetchedTokenInfo.baseSymbol,
          quoteSymbol: fetchedTokenInfo.quoteSymbol,
          name: fetchedTokenInfo.name || `${fetchedTokenInfo.baseSymbol}/${fetchedTokenInfo.quoteSymbol}`
        })
      }
      
      console.log(`✅ FETCHDATA COMPLETE (API)`)
      setTimeout(() => setDataLoadSource(null), 2000)
    } catch (err) {
      console.error("Chart error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      setTokenInfo(null)
      setLoading(false)
      setDataLoadSource('Error')
      setTimeout(() => setDataLoadSource(null), 2000)
    }
  }, [tokenAddress, interval, historicalRange, addToHistory, getFromCache, saveToCache])

  // Fetch data when interval, token address, or historical range changes
  useEffect(() => {
    fetchData()
  }, [interval, tokenAddress, historicalRange]) // Include historicalRange in dependencies

  // Handle search form submission
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fetchData()
  }, [fetchData])

  // Generate trading signals when data or parameters change
  const tradingResults = useMemo(() => {
    if (!ohlcvData || ohlcvData.length === 0) {
      return null
    }
    
    const chartColors = getChartColors(isDarkMode)
    const signalColors = {
      buySignal: chartColors.BUY_SIGNAL,
      sellSignal: chartColors.SELL_SIGNAL,
      profit: chartColors.PROFIT,
      loss: chartColors.LOSS,
      allSignalsBuy: chartColors.ALL_SIGNALS_BUY,
      allSignalsSell: chartColors.ALL_SIGNALS_SELL
    }
    
    return generateTradingSignals(ohlcvData, parameters, showAllSignals, signalColors)
  }, [ohlcvData, parameters, showAllSignals, isDarkMode])

  // Update trade analytics when trading results change
  useEffect(() => {
    if (tradingResults) {
      setTradeAnalytics(tradingResults.tradeAnalytics)
    }
  }, [tradingResults])

  // Memoize trade analytics display values to prevent unnecessary re-calculations
  const tradeAnalyticsDisplay = useMemo(() => ({
    initialInvestment: tradeAnalytics.initialInvestment.toFixed(2),
    currentPortfolioValue: tradeAnalytics.currentPortfolioValue.toFixed(2),
    totalPercentageChange: tradeAnalytics.totalPercentageChange.toFixed(2),
    isProfit: tradeAnalytics.totalPercentageChange >= 0,
    sign: tradeAnalytics.totalPercentageChange >= 0 ? '+' : ''
  }), [tradeAnalytics.initialInvestment, tradeAnalytics.currentPortfolioValue, tradeAnalytics.totalPercentageChange])

  // Chart creation effect - only runs when OHLCV data changes
  useEffect(() => {
    if (!ohlcvData || ohlcvData.length === 0 || !chartContainerRef.current) {
      return
    }
    
    // Cleanup function
    const cleanupChart = () => {
      if (candlestickSeries.current) {
        chart.current?.removeSeries(candlestickSeries.current)
        candlestickSeries.current = null
      }
      if (chart.current) {
        chart.current.remove()
        chart.current = null
      }
    }
    
    try {
      cleanupChart()

      // Create the chart
      if (chartContainerRef.current) {
        const chartColors = getChartColors(isDarkMode)
        chart.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: chartColors.BACKGROUND },
            textColor: chartColors.TEXT,
          },
          grid: {
            vertLines: { 
              color: chartColors.GRID,
              style: 1, // Solid line style
              visible: true 
            },
            horzLines: { 
              color: chartColors.GRID,
              style: 1, // Solid line style
              visible: true 
            },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
          rightPriceScale: {
            autoScale: true,
            borderVisible: true,
            scaleMargins: CHART_CONFIG.SCALE_MARGINS,
            // format options removed as they're not available in this version
          },
          width: chartContainerRef.current.clientWidth,
          height: CHART_CONFIG.DEFAULT_HEIGHT,
          crosshair: {
            mode: 1,
            vertLine: {
              width: 1,
              color: chartColors.CROSSHAIR,
              style: 3,
            },
            horzLine: {
              width: 1,
              color: chartColors.CROSSHAIR,
              style: 3,
            },
          },
        })

        // Create tooltip element
        const toolTip = document.createElement('div');
        toolTip.className = 'floating-tooltip-2';
        chartContainerRef.current.appendChild(toolTip);
        toolTip.style.display = 'none';
        toolTip.style.position = 'absolute';
        toolTip.style.padding = '8px';
        toolTip.style.boxSizing = 'border-box';
        toolTip.style.fontSize = '12px';
        toolTip.style.color = 'hsl(var(--foreground))';
        toolTip.style.background = 'hsl(var(--background))';
        toolTip.style.border = '1px solid hsl(var(--border))';
        toolTip.style.borderRadius = '4px';
        toolTip.style.zIndex = '1000';

        candlestickSeries.current = chart.current.addCandlestickSeries({
          upColor: chartColors.UP,
          downColor: chartColors.DOWN,
          borderVisible: false,
          wickUpColor: chartColors.UP,
          wickDownColor: chartColors.DOWN,
          // priceFormat options simplified for compatibility
        })

        // Set the chart data (convert timestamps to required format)
        const chartData = ohlcvData.map(d => ({
          ...d,
          time: d.time as any // Type assertion for time compatibility
        }))
        candlestickSeries.current.setData(chartData)

        // Add tooltip handling
        chart.current.subscribeCrosshairMove((param) => {
          if (
            param.point === undefined ||
            !param.time ||
            param.point.x < 0 ||
            param.point.y < 0
          ) {
            toolTip.style.display = 'none';
          } else {
            const data = param.seriesData.get(candlestickSeries.current!) as TooltipData;
            if (data) {
              const dateStr = new Date(data.time * 1000).toLocaleDateString();
              toolTip.style.display = 'block';
              const price = data.close;
              const color = data.open > data.close ? '#ef5350' : '#26a69a';
              
              toolTip.innerHTML = `
                <div style="color: ${color}">
                  <div>O: ${data.open.toFixed(6)}</div>
                  <div>H: ${data.high.toFixed(6)}</div>
                  <div>L: ${data.low.toFixed(6)}</div>
                  <div>C: ${data.close.toFixed(6)}</div>
                </div>
                <div style="color: rgba(0, 0, 0, 0.7)">${dateStr}</div>
              `;

              const coordinate = candlestickSeries.current!.priceToCoordinate(price);
              let shiftedCoordinate = param.point.x - 50;
              
              if (coordinate === null) {
                return;
              }

              shiftedCoordinate = Math.max(
                0,
                Math.min(chartContainerRef.current!.clientWidth - 150, shiftedCoordinate)
              );
              
              const coordinateY = coordinate - 100 > 0 
                ? coordinate - 100 
                : Math.max(0, coordinate + 50);

              toolTip.style.left = shiftedCoordinate + 'px';
              toolTip.style.top = coordinateY + 'px';
            }
          }
        });

        // Initial empty markers - signals will be set in separate effect
        candlestickSeries.current.setMarkers([])
        // Fit chart to content
        chart.current.timeScale().fitContent()

        const handleResize = () => {
          if (chart.current && chartContainerRef.current) {
            chart.current.resize(
              chartContainerRef.current.clientWidth,
              chartContainerRef.current.clientHeight
            )
            chart.current.timeScale().fitContent()
          }
        }
        window.addEventListener("resize", handleResize)
        
        // Return cleanup function
        return () => {
          window.removeEventListener("resize", handleResize)
          cleanupChart()
        }
      }
    } catch (err) {
      console.error("Chart creation error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }, [ohlcvData, isDarkMode]) // Depend on OHLCV data and dark mode

  // Separate effect for updating signals only
  useEffect(() => {
    if (!tradingResults || !candlestickSeries.current) {
      return
    }
    
    try {
      // Set trading signals as markers
      const markers = tradingResults.signals.map(signal => ({
        ...signal,
        time: signal.time as any, // Type assertion for time compatibility
        position: signal.position as any // Type assertion for position compatibility
      }))
      candlestickSeries.current.setMarkers(markers as any)
    } catch (err) {
      console.error("Signal update error:", err)
    }
  }, [tradingResults]) // Only depend on trading results

  // Parameter update handlers
  const updateParameter = useCallback((key: keyof SignalParameters, value: number) => {
    setParameters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Helper function to format time
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <CardTitle>
              {tokenInfo ? `${tokenInfo.baseSymbol}/${tokenInfo.quoteSymbol}` : "Crypto Chart"}
              {tokenInfo && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({interval.toUpperCase()})
                </span>
              )}
            </CardTitle>
            
            <div className="flex gap-2">
              {/* Historical Range Selector */}
                             <ButtonGroup variant="outline" size="sm">
                 {Object.entries(HISTORICAL_RANGES).map(([key, range]) => {
                   const maxDays = getMaxRecommendedDays(interval)
                   const isDisabled = range.days !== null && range.days > maxDays
                  
                  return (
                    <Button
                      key={key}
                      variant={historicalRange === key ? "default" : "outline"}
                      size="sm"
                      disabled={isDisabled}
                      onClick={() => setHistoricalRange(key)}
                      className="text-xs"
                      title={isDisabled ? `Max ${maxDays} days for ${interval}` : undefined}
                    >
                      {range.label}
                    </Button>
                  )
                })}
              </ButtonGroup>
              
                             {/* Timeframe Selector */}
               <ButtonGroup variant="outline" size="sm">
                 {INTERVALS.map((int) => (
                   <Button
                     key={int.value}
                     variant={interval === int.value ? "default" : "outline"}
                     size="sm"
                     onClick={() => setInterval(int.value)}
                     className="text-xs"
                   >
                     {int.label}
                   </Button>
                 ))}
               </ButtonGroup>
            </div>
          </div>

                     {/* Show current data range info */}
           <div className="text-xs text-muted-foreground text-center">
             {historicalRange !== "max" && HISTORICAL_RANGES[historicalRange as keyof typeof HISTORICAL_RANGES].days !== null && (
               <span>
                 Showing last {Math.min(
                   HISTORICAL_RANGES[historicalRange as keyof typeof HISTORICAL_RANGES].days!,
                   getMaxRecommendedDays(interval)
                 )} days of {interval} data
                 {HISTORICAL_RANGES[historicalRange as keyof typeof HISTORICAL_RANGES].days! > getMaxRecommendedDays(interval) && 
                   ` (limited by ${interval} timeframe)`
                 }
               </span>
             )}
             {/* Cache statistics */}
             {(cacheStats.hits > 0 || cacheStats.misses > 0) && (
               <span className="ml-2">
                 • Cache: {cacheStats.hits} hits / {cacheStats.misses} misses
                 {cacheStats.totalCached > 0 && ` (${cacheStats.totalCached} cached)`}
               </span>
             )}
             {/* Data Load Source Notification */}
             {dataLoadSource && (
                <span 
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium 
                    ${dataLoadSource === 'API' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 
                      dataLoadSource === 'Cache' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 
                      dataLoadSource === 'Loading...' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' : 
                      'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}
                >
                  {dataLoadSource === 'API' && '⚡ Using API Data'}
                  {dataLoadSource === 'Cache' && '📦 Using Cached Data'}
                  {dataLoadSource === 'Loading...' && '⏳ Loading Data...'}
                  {dataLoadSource === 'Error' && '⚠️ Error Loading'}
                </span>
             )}
             
             {/* Cache Statistics - Always visible when cache has data */}
             {cacheStats.totalCached > 0 && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-help">
                       💾 {cacheStats.totalCached} cached
                     </span>
                   </TooltipTrigger>
                   <TooltipContent>
                     <div className="text-sm">
                       <p><strong>Cache Statistics:</strong></p>
                       <p>• Total Cached: {cacheStats.totalCached} pools</p>
                       <p>• Cache Hits: {cacheStats.hits}</p>
                       <p>• Cache Misses: {cacheStats.misses}</p>
                       <p>• Hit Rate: {cacheStats.hits + cacheStats.misses > 0 ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) : 0}%</p>
                       <p>• Persists across dev server restarts</p>
                       <Button 
                         size="sm" 
                         variant="outline" 
                         className="mt-2 h-6 text-xs"
                         onClick={() => {
                           clearAllCache()
                           window.location.reload()
                         }}
                       >
                         Clear All Cache
                       </Button>
                     </div>
                   </TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}

             {/* Rate Limit Monitor - Shows API usage */}
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <span 
                     className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium cursor-help
                       ${rateLimitMonitor.getRateLimitStatus().status === 'safe' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                         rateLimitMonitor.getRateLimitStatus().status === 'warning' ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 
                         'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}
                   >
                     📡 {rateLimitMonitor.stats.callsToday} API calls
                   </span>
                 </TooltipTrigger>
                 <TooltipContent>
                   <div className="text-sm max-w-xs">
                     <p><strong>GeckoTerminal API Usage:</strong></p>
                     <div className="space-y-1 mt-2">
                       <p>• Last minute: {rateLimitMonitor.stats.callsLast1Min}/30 ({rateLimitMonitor.getRateLimitStatus().breakdown.minute}%)</p>
                       <p>• Last 5 minutes: {rateLimitMonitor.stats.callsLast5Min}/100 ({rateLimitMonitor.getRateLimitStatus().breakdown.fiveMinute}%)</p>
                       <p>• Last hour: {rateLimitMonitor.stats.callsLast1Hour}/1000 ({rateLimitMonitor.getRateLimitStatus().breakdown.hour}%)</p>
                       <p>• Today: {rateLimitMonitor.stats.callsToday}/10000 ({rateLimitMonitor.getRateLimitStatus().breakdown.day}%)</p>
                     </div>
                     <div className="mt-2 pt-2 border-t">
                       <p><strong>Cache Savings:</strong></p>
                       <p>• API calls avoided: {rateLimitMonitor.stats.estimatedSavings}</p>
                       <p>• Cache hit rate: {rateLimitMonitor.stats.cacheHitRate}%</p>
                       <p className="text-green-600 font-medium">
                         💰 Saved ~{Math.round(rateLimitMonitor.stats.estimatedSavings * 0.01)} requests/minute
                       </p>
                     </div>
                     <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                       <p>Status: {rateLimitMonitor.getRateLimitStatus().message}</p>
                       <p>Free tier limits are estimated</p>
                     </div>
                   </div>
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
           </div>

          {/* Enhanced search bar with suggestions and history */}
          <form 
            onSubmit={handleSearchSubmit}
            className="flex justify-center items-center gap-2 max-w-xl mx-auto w-full"
          >
            <div className="flex-1 flex gap-2">
              {/* Search with suggestions */}
              <div className="flex-1 relative">
                <Popover open={shouldShowSearch} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery || tokenAddress}
                        onChange={(e) => {
                          const value = e.target.value
                          setTokenAddress(value)
                          setSearchQuery(value)
                        }}
                        onFocus={() => {
                          setSearchFocused(true)
                        }}
                        onBlur={() => {
                          // Delay hiding to allow clicking on results
                          setTimeout(() => setSearchFocused(false), 200)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setSearchFocused(false)
                            clearSearch()
                          }
                        }}
                        placeholder="Search by token name (e.g., SOL, USDC) or enter pool address..."
                        className="flex-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      {searchLoading && (
                        <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!searchLoading && searchQuery && (
                        <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command>
                      <CommandList>
                        {searchLoading && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Searching...</span>
                          </div>
                        )}
                        {searchResults.length === 0 && !searchLoading && searchQuery && searchQuery.length >= 2 && (
                          <CommandEmpty>No pools found for "{searchQuery}"</CommandEmpty>
                        )}
                        {searchResults.length > 0 && (
                          <CommandGroup heading="Search Results">
                            {searchResults.map((result) => (
                              <CommandItem
                                key={result.id}
                                value={result.address}
                                onSelect={() => {
                                  setTokenAddress(result.address)
                                  setSearchQuery('')
                                  setSearchFocused(false)
                                  clearSearch()
                                  setTimeout(() => fetchData(), 0)
                                }}
                                className="flex items-center justify-between p-3 cursor-pointer"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {result.baseSymbol}/{result.quoteSymbol}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {result.dexName} • Vol: ${parseFloat(result.volume24h).toLocaleString()}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {result.address.slice(0, 8)}...{result.address.slice(-8)}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xs ${parseFloat(result.priceChange24h) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {parseFloat(result.priceChange24h) >= 0 ? '+' : ''}
                                    {parseFloat(result.priceChange24h).toFixed(2)}%
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* History Dropdown */}
              {history.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10 relative">
                      <History className="h-4 w-4" />
                      {history.length > 0 && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center">
                          {history.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Recent Pools</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="h-auto p-1 text-xs"
                      >
                        Clear All
                      </Button>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {history.map((item) => (
                      <DropdownMenuItem
                        key={item.address}
                        className="flex items-center justify-between group cursor-pointer"
                        onClick={() => {
                          setTokenAddress(item.address)
                          setSearchQuery('')
                          clearSearch()
                          setTimeout(() => fetchData(), 0)
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.baseSymbol}/{item.quoteSymbol}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.address.slice(0, 8)}...{item.address.slice(-8)}
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTimeAgo(item.lastVisited)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{new Date(item.lastVisited).toLocaleString()}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFromHistory(item.address)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            <Button type="submit" size="sm">
              Load Chart
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="flex-1">
            {loading && <Skeleton className="w-full h-[500px]" />}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div ref={chartContainerRef} className="w-full h-[500px]" />

            <div className="mt-4 text-sm text-muted-foreground text-center">
              Data provided by{" "}
              <a
                href="https://www.geckoterminal.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-primary"
              >
                GeckoTerminal
              </a>
              {" "}(Free API - Real OHLCV Data)
            </div>
          </div>

          {/* Strategy Controls and Trade Analytics */}
          <div className="w-64 space-y-6 p-4 border rounded-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Buy Parameters</h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 relative group"
                  onClick={optimization.runHillClimbForFiveSeconds}
                  disabled={optimization.isOptimizing}
                >
                  <Rocket className="h-4 w-4" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Hill Climb Optimization
                  </span>
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm">RSI Below</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={optimization.isOptimizing ? optimization.testParams.buyRsiThreshold : parameters.buyRsiThreshold}
                    onChange={(e) => updateParameter('buyRsiThreshold', Number(e.target.value))}
                    className="w-full"
                    disabled={optimization.isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {optimization.isOptimizing ? (
                      <span>
                        Testing: {optimization.testParams.buyRsiThreshold} 
                        {optimization.bestParams.buyRsiThreshold !== parameters.buyRsiThreshold && 
                          ` (Best: ${optimization.bestParams.buyRsiThreshold})`}
                      </span>
                    ) : (
                      parameters.buyRsiThreshold
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">CV Below</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="-50"
                    max="0"
                    step="0.1"
                    value={optimization.isOptimizing ? optimization.testParams.buyCvThreshold : parameters.buyCvThreshold}
                    onChange={(e) => updateParameter('buyCvThreshold', Number(e.target.value))}
                    className="w-full"
                    disabled={optimization.isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {optimization.isOptimizing ? (
                      <span>
                        Testing: {optimization.testParams.buyCvThreshold.toFixed(1)}
                        {optimization.bestParams.buyCvThreshold !== parameters.buyCvThreshold && 
                          ` (Best: ${optimization.bestParams.buyCvThreshold.toFixed(1)})`}
                      </span>
                    ) : (
                      parameters.buyCvThreshold.toFixed(1)
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-medium">Sell Parameters</h3>
              <div className="space-y-2">
                <label className="text-sm">RSI Above</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={optimization.isOptimizing ? optimization.testParams.sellRsiThreshold : parameters.sellRsiThreshold}
                    onChange={(e) => updateParameter('sellRsiThreshold', Number(e.target.value))}
                    className="w-full"
                    disabled={optimization.isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {optimization.isOptimizing ? (
                      <span>
                        Testing: {optimization.testParams.sellRsiThreshold}
                        {optimization.bestParams.sellRsiThreshold !== parameters.sellRsiThreshold && 
                          ` (Best: ${optimization.bestParams.sellRsiThreshold})`}
                      </span>
                    ) : (
                      parameters.sellRsiThreshold
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">CV Above</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="400"
                    step="0.1"
                    value={optimization.isOptimizing ? optimization.testParams.sellCvThreshold : parameters.sellCvThreshold}
                    onChange={(e) => updateParameter('sellCvThreshold', Number(e.target.value))}
                    className="w-full"
                    disabled={optimization.isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {optimization.isOptimizing ? (
                      <span>
                        Testing: {optimization.testParams.sellCvThreshold.toFixed(1)}
                        {optimization.bestParams.sellCvThreshold !== parameters.sellCvThreshold && 
                          ` (Best: ${optimization.bestParams.sellCvThreshold.toFixed(1)})`}
                      </span>
                    ) : (
                      parameters.sellCvThreshold.toFixed(1)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Trade Analytics Section */}
            <div className="mt-6 border-t pt-4">
              <h3 className="font-medium mb-4">Trade Analytics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Initial Investment:</span>
                  <span>${tradeAnalyticsDisplay.initialInvestment}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Portfolio:</span>
                  <span>${tradeAnalyticsDisplay.currentPortfolioValue}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Return:</span>
                  <span 
                    className={
                      tradeAnalyticsDisplay.isProfit 
                      ? "text-green-600" 
                      : "text-red-600"
                    }
                  >
                    {tradeAnalyticsDisplay.sign}
                    {tradeAnalyticsDisplay.totalPercentageChange}%
                  </span>
                </div>
              </div>

              {/* Detailed Trades List */}
              {tradeAnalytics.trades.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Trades</h4>
                  <div className="max-h-48 overflow-y-auto">
                    {tradeAnalytics.trades.map((trade, index) => (
                      <div 
                        key={index} 
                        className={`flex justify-between text-xs p-1 ${
                          trade.percentageChange >= 0 
                          ? "bg-green-50 dark:bg-green-900/30" 
                          : "bg-red-50 dark:bg-red-900/30"
                        }`}
                      >
                        <span>
                          {new Date(trade.buyTime * 1000).toLocaleDateString()} - 
                          {new Date(trade.sellTime * 1000).toLocaleDateString()}
                        </span>
                        <span>
                          {trade.percentageChange >= 0 ? '+' : ''}
                          {trade.percentageChange.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Highest Profit Found section */}
              {optimization.highestProfit.profit > -Infinity && (
                <div className="mt-4 p-2 bg-green-50 dark:bg-green-900/30 rounded">
                  <div className="font-medium text-sm">Highest Profit Found:</div>
                  <div className="text-green-600 dark:text-green-400 font-bold">
                    {optimization.highestProfit.profit.toFixed(2)}%
                  </div>
                  <div className="text-xs mt-1">
                    Parameters:
                    <br />
                    Buy RSI: {optimization.highestProfit.params.buyRsiThreshold}
                    <br />
                    Buy CV: {optimization.highestProfit.params.buyCvThreshold}
                    <br />
                    Sell RSI: {optimization.highestProfit.params.sellRsiThreshold}
                    <br />
                    Sell CV: {optimization.highestProfit.params.sellCvThreshold}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              {/* Show All Signals toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="toggleAllSignals" className="text-sm font-medium">
                  Show All Signals
                </label>
                <input
                  id="toggleAllSignals"
                  type="checkbox"
                  checked={showAllSignals}
                  onChange={() => setShowAllSignals(!showAllSignals)}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

