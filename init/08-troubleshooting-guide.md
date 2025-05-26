# Troubleshooting Guide

## ⚠️ CRITICAL DARK MODE ISSUES

### **Chart Elements Remain Light in Dark Mode**
**SYMPTOMS**: Theme toggle works for UI but chart background, signals, or tooltips stay light/white

**ROOT CAUSE**: TradingView Lightweight Charts doesn't auto-inherit CSS theme variables

**SOLUTION PATTERN**:
```typescript
// REQUIRED: Explicit theme detection and color passing
const { resolvedTheme } = useTheme()
const isDarkMode = resolvedTheme === 'dark'
const chartColors = getChartColors(isDarkMode)

// CRITICAL: Pass colors to chart creation
chart.current = createChart(container, {
  layout: { textColor: chartColors.TEXT },
  grid: { vertLines: { color: chartColors.GRID } }
})

// CRITICAL: Pass colors to signal generation
generateTradingSignals(data, params, showAll, {
  buySignal: chartColors.BUY_SIGNAL,
  sellSignal: chartColors.SELL_SIGNAL
})
```

**CHART RE-RENDER TRIGGER**: useEffect MUST depend on `[data, isDarkMode]` to re-create chart on theme change

### **UI Pills/Cards Stay White in Dark Mode**
**SYMPTOMS**: Status pills, trade lists, optimization results show white backgrounds

**ROOT CAUSE**: Hardcoded Tailwind classes like `bg-green-50` don't auto-adapt

**SOLUTION**: Always add dark variants: `bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300`

## ⚠️ CRITICAL OPTIMIZATION PERFORMANCE

### **UI Becomes Janky During Optimization**
**SYMPTOMS**: Trade profit counter stutters, browser lags when "Optimize Parameters" runs

**ROOT CAUSE**: Hill climbing algorithm triggers 300+ UI updates/second via rapid state changes

**DETECTION**: Check browser dev tools Performance tab - will show excessive re-renders during optimization

**SOLUTION PATTERN**:
```typescript
// hooks/use-optimization.ts - THROTTLE UI updates
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 200; // Only update every 200ms

if (now - lastUpdateTime >= UPDATE_THROTTLE) {
  onParametersUpdate(bestParams); // Triggers chart re-render
  lastUpdateTime = now;
}

// REMOVE excessive setTestParams() from iteration loops
// Only call setTestParams when better solution found
```

**PERFORMANCE KILLERS TO AVOID**:
- `setTestParams()` on every hill climb iteration
- Calling `onParametersUpdate()` without throttling
- Recalculating `toFixed()` on every render (use useMemo)

## ⚠️ CRITICAL API SELECTION FAILURES

### **Silent Data Quality Degradation**
**SYMPTOMS**: Application appears functional but technical analysis produces unreliable results

**ROOT CAUSE**: API provides simulated/fake OHLCV data instead of real market data

**DETECTION PATTERNS**:
```typescript
// Check for simulated data indicators:
const isSimulatedData = (ohlcvData: OHLCVDataPoint[]) => {
  // Volume always 0
  const allZeroVolume = ohlcvData.every(d => d.volume === 0)
  
  // OHLC values artificially close (< 0.1% variation)
  const artificialVariation = ohlcvData.some(d => {
    const range = (d.high - d.low) / d.close
    return range < 0.001 // Less than 0.1% range indicates simulation
  })
  
  // Open price equals previous close (perfect simulation pattern)
  const perfectSimulation = ohlcvData.some((d, i) => {
    if (i === 0) return false
    return Math.abs(d.open - ohlcvData[i-1].close) < 0.000001
  })
  
  return allZeroVolume || artificialVariation || perfectSimulation
}
```

**SOLUTION**: Verify data authenticity before implementing technical analysis
**EXACT LOCATION**: `lib/api-service.ts` - data transformation validation

### **Birdeye API Specific Issues**
**FAILURE MODE**: Free tier only provides closing prices, simulates OHLC with `price * (1 ± 0.001)`

**DETECTION**:
- All volume values = 0
- High/Low artificially generated with tiny variations
- Technical indicators become meaningless

**SOLUTION**: Use GeckoTerminal API for real OHLCV data

### **API Data Point Limits**
**SYMPTOMS**: `400 Bad Request` errors from GeckoTerminal API, particularly when requesting long historical ranges.

**ROOT CAUSE**: GeckoTerminal API has a hard limit of **1000 data points** per OHLCV request.

**DETECTION**: Observe network requests and responses. If `limit` parameter in the URL > 1000, this is the likely cause.

**SOLUTION**:
- Ensure `limit` parameter never exceeds 1000.
- Dynamically calculate the number of data points based on selected `interval` and `historicalRange`.
- **EXACT LOCATIONS**:
  - `lib/api-service.ts`: `MAX_API_LIMIT` constant in `getOhlcvParams`. All limit calculations respect this.
  - `lib/chart-config.ts`: `getMaxRecommendedDays` and `calculateOptimalLimit` help determine appropriate request sizes.
  - `components/chart-container.tsx`: `fetchData` uses these utilities to calculate `customLimit` passed to API service.

### **Duplicate Timestamps in API Response**
**SYMPTOMS**: Charting library error: `Assertion failed: data must be asc ordered by time, index=..., time=..., prev time=...` where `time` and `prev time` are identical.

**ROOT CAUSE**: API response contains multiple data entries with the exact same timestamp.

**DETECTION**: Inspect the `ohlcv_list` from the API response. Sort by timestamp and check for adjacent identical timestamps.

**SOLUTION**: Deduplicate data after fetching and sorting.
- **EXACT LOCATION**: In `lib/api-service.ts`, within `fetchOHLCVData` and `fetchOHLCVDataWithRange`, after `.sort((a, b) => a.time - b.time)`, add:
  ```typescript
  .filter((item, index, array) => {
    return index === 0 || item.time !== array[index - 1].time;
  })
  ```

### **Token Symbol Fetching Issues**
**SYMPTOMS**: Token pair displayed as "Unknown/Unknown" or "undefined/undefined". `baseSymbol` and `quoteSymbol` in `TokenInfo` are incorrect.

**ROOT CAUSE**: GeckoTerminal API does not reliably provide `base_token_symbol` and `quote_token_symbol` in the main `pool.data.attributes` object. These symbols must be fetched by either including related token data or parsing the pool name.

**DETECTION**:
- Check `tokenInfo` state in `components/chart-container.tsx`. If `baseSymbol` or `quoteSymbol` are "Unknown" or missing, this is the issue.
- Inspect network response for `GET /api/v2/networks/solana/pools/{poolAddress}`. The direct `attributes` will likely lack `base_token_symbol`.

**SOLUTION**:
1. **Use `?include=base_token,quote_token`**: This is the most reliable method. The API will return an `included` array in the response. Token symbols are found in `included[<index>].attributes.symbol` by matching `included[<index>].id` with `data.relationships.base_token.data.id` (and `quote_token` respectively).
2. **Fallback to Parsing Pool Name**: If the `included` data is missing or fails, parse the `pool.data.attributes.name` string (e.g., "JUP / SOL") to get the symbols.

**EXACT LOCATION**: Logic implemented in `lib/api-service.ts`:
  - `fetchPoolWithTokens(poolAddress: string)`: Preferred method. Fetches pool data with `?include=base_token,quote_token` and implements the described parsing logic (included data first, then pool name fallback).
  - `fetchTokenInfo(poolAddress: string)`: Simpler fallback that primarily parses the pool name.
  - Both `fetchChartData()` and `fetchChartDataWithLimit()` in `APIService` have been updated to use `fetchPoolWithTokens()` for more robust symbol fetching.

**AVOIDANCE**: Do not assume `pool.data.attributes.base_token_symbol` or `pool.data.attributes.quote_token_symbol` exist. Always use one of the robust fetching strategies above.

### **NEW: OHLCV Data Caching Issues**
**SYMPTOMS**:
- Data not updating when it should (cache too sticky).
- Data reloading from API too often (cache not working or expiring too quickly).
- `localStorage` quota exceeded errors.
- UI shows incorrect cache status (e.g., says "API" when it should be "Cache").

**ROOT CAUSE**: Incorrect implementation or configuration of `hooks/use-ohlcv-cache.ts` or its usage in `components/chart-container.tsx`.

**CRITICAL INSIGHT - Cache Key Granularity**: 
- **FIXED FAILURE MODE**: Switching timeframes triggered API calls despite having usable cached data
- **ROOT CAUSE**: Different intervals calculate different `limit` values for same historical range (1w of 15m = 672 points vs 1w of 1h = 168 points)
- **SOLUTION**: Implemented flexible cache matching - searches for any cache entry with sufficient data points if exact match fails

**DETECTION & DEBUGGING**:
1.  **Inspect `localStorage`**: Use browser dev tools to view keys starting with `ohlcv-cache-`.
    - Check `timestamp` and `dataPoints` in a cached entry to verify against `CACHE_EXPIRY_MINUTES` and requested `limit`.
2.  **Monitor Console Logs**: `useOHLCVCache` logs cache hits, misses, expiries, and saves.
    - `ChartContainer` logs `📊 Using cached data...` or `🌐 Fetching fresh data...`.
    - **NEW**: Look for "Exact cache hit" vs "Flexible cache hit" to see when flexible matching works
3.  **Check UI Data Source Pill**: The `ChartContainer` displays a small pill indicating if data came from 'API' or 'Cache'.
    - Color-coded: Blue (API), Green (Cache), Yellow (Loading), Red (Error)
    - Auto-disappears after 2 seconds via setTimeout in fetchData
4.  **Verify `fetchData` Logic (`components/chart-container.tsx`)**:
    - Ensure `getFromCache` is called with correct `cacheKey ({ poolAddress, interval, limit })`.
    - Ensure `saveToCache` is called after successful API fetch.
    - Check dependencies of `fetchData` useCallback: `[tokenAddress, interval, historicalRange, addToHistory, getFromCache, saveToCache]`.
5.  **Verify `useOHLCVCache` Logic (`hooks/use-ohlcv-cache.ts`)**:
    - `isCacheValid`: Check expiry calculation against `CACHE_EXPIRY_MINUTES`.
    - `getFromCache`: **NEW** - Two-tier lookup: exact match first, then flexible search for entries with ≥ requested data points
    - `saveToCache`: **NEW** - Cleanup redundant smaller entries before saving. Verify `QuotaExceededError` handling and `clearOldCacheEntries` logic.

**EXACT LOCATIONS OF FLEXIBLE MATCHING**:
- `hooks/use-ohlcv-cache.ts` lines 47-89: Flexible search implementation
- `hooks/use-ohlcv-cache.ts` lines 108-127: Redundant entry cleanup logic

**AVOIDANCE**:
- Ensure `CACHE_EXPIRY_MINUTES` in `useOHLCVCache` are appropriate for each interval.
- When requesting data, `customLimit` in `ChartContainer`'s `fetchData` must match the `limit` used for the cache key if specific data point counts are critical.
- **NEW**: Flexible matching should now handle timeframe switching automatically - if still seeing API calls when switching timeframes, check console for "Flexible cache hit" messages
- Regularly test cache functionality after changes to data fetching or `useOHLCVCache`.

## Common Issues and Solutions

### Chart Rendering Issues

#### **Chart Not Displaying**
**Symptoms**: Empty chart container, no candlesticks visible

**Possible Causes & Solutions**:
1. **Invalid Data Format**
   ```typescript
   // Check data structure in console
   console.log("OHLCV Data:", ohlcvData)
   
   // Ensure data format matches expected structure
   const expectedFormat = {
     time: number,      // Unix timestamp
     open: number,      // Numeric value
     high: number,      // Numeric value  
     low: number,       // Numeric value
     close: number      // Numeric value
   }
   ```

2. **Chart Container Reference Issues**
   ```typescript
   // Verify chart container ref is properly attached
   const chartContainerRef = useRef<HTMLDivElement>(null)
   
   // Check if container exists before creating chart
   if (chartContainerRef.current) {
     chart.current = createChart(chartContainerRef.current, config)
   }
   ```

3. **Chart Cleanup Problems**
   ```typescript
   // Ensure proper cleanup on unmount
   useEffect(() => {
     return () => {
       if (candlestickSeries.current) {
         chart.current?.removeSeries(candlestickSeries.current)
         candlestickSeries.current = null
       }
       if (chart.current) {
         chart.current.remove()
         chart.current = null
       }
     }
   }, [])
   ```

#### **Chart Displays but No Data**
**Symptoms**: Chart renders but shows empty/blank candlesticks

**Solutions**:
1. **Check Data Transformation**
   ```typescript
   // Verify numeric conversion
   const transformedData = rawData.map(([timestamp, open, high, low, close]) => ({
     time: timestamp as number,
     open: Number(open),    // Ensure conversion to number
     high: Number(high),
     low: Number(low),
     close: Number(close),
   }))
   
   // Check for NaN values
   const hasInvalidData = transformedData.some(d => 
     isNaN(d.open) || isNaN(d.high) || isNaN(d.low) || isNaN(d.close)
   )
   ```

2. **Verify Data Sorting**
   ```typescript
   // Ensure chronological order
   const sortedData = data.sort((a, b) => a.time - b.time)
   ```

### API Integration Issues

#### **GeckoTerminal API Errors**
**Symptoms**: Error messages, failed data fetching, network issues

**Common Error Codes & Solutions**:

1. **404 - Pool Not Found**
   ```typescript
   // Verify pool address format (44 characters, alphanumeric)
   const isValidPoolAddress = (address: string) => {
     return address.length === 44 && /^[A-Za-z0-9]+$/.test(address)
   }
   
   // Example valid Solana pool address
   const examplePool = "H8TcGwR9Ljs5sb5r1PJ2RZzruyqgf2zUzk5R31VVhpaq"
   ```

2. **429 - Rate Limiting**
   ```typescript
   // Add delay between requests
   await new Promise(resolve => setTimeout(resolve, 100))
   
   // Implement retry logic
   const fetchWithRetry = async (url: string, retries = 3) => {
     for (let i = 0; i < retries; i++) {
       try {
         const response = await fetch(url)
         if (response.ok) return response
         if (response.status === 429) {
           await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
           continue
         }
         throw new Error(`HTTP ${response.status}`)
       } catch (error) {
         if (i === retries - 1) throw error
       }
     }
   }
   ```

3. **Invalid Response Structure**
   ```typescript
   // Validate API response
   const validateApiResponse = (data: any) => {
     if (!data?.data?.attributes?.ohlcv_list) {
       throw new Error("Invalid API response structure")
     }
     
     if (!Array.isArray(data.data.attributes.ohlcv_list)) {
       throw new Error("OHLCV data is not an array")
     }
     
     return data
   }
   ```

#### **CORS Issues** (Development)
**Symptoms**: CORS errors in browser console

**Solutions**:
1. **Next.js API Routes** (if needed)
   ```typescript
   // pages/api/proxy.ts
   export default async function handler(req: NextApiRequest, res: NextApiResponse) {
     const { poolAddress, timeframe } = req.query
     
     try {
       const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${timeframe}`)
       const data = await response.json()
       res.status(200).json(data)
     } catch (error) {
       res.status(500).json({ error: 'Failed to fetch data' })
     }
   }
   ```

### Technical Analysis Issues

#### **RSI Calculation Problems**
**Symptoms**: Invalid RSI values, NaN results, extreme values

**Debugging Steps**:
1. **Check Input Data**
   ```typescript
   // Verify close prices array
   console.log("Close prices:", closePrices)
   console.log("Close prices length:", closePrices.length)
   console.log("Has invalid values:", closePrices.some(p => isNaN(p) || p <= 0))
   ```

2. **Validate Calculation Parameters**
   ```typescript
   // RSI debugging
   function calculateRSIDebug(closes: number[], period = 14) {
     console.log("RSI Input:", { closes: closes.slice(0, 5), period })
     
     if (closes.length < period + 1) {
       console.warn("Insufficient data for RSI calculation")
       return []
     }
     
     // ... rest of RSI calculation with debug logs
   }
   ```

#### **Chaikin Volatility Issues**
**Symptoms**: Extreme CV values, calculation errors

**Debugging**:
```typescript
function calculateChaikinVolatilityDebug(highs: number[], lows: number[], length = 10) {
  console.log("CV Input:", { 
    highs: highs.slice(0, 5), 
    lows: lows.slice(0, 5), 
    length 
  })
  
  // Check for invalid high/low relationships
  const invalidBars = highs.some((high, i) => high < lows[i])
  if (invalidBars) {
    console.error("Invalid OHLC data: high < low detected")
  }
  
  // ... rest of calculation
}
```

### Optimization Algorithm Issues

#### **Optimization Not Finding Better Results**
**Symptoms**: Optimization runs but doesn't improve parameters

**Solutions**:
1. **Check Parameter Bounds**
   ```typescript
   const bounds = {
     buyRsi:  { min: 0,   max: 100 },
     buyCv:   { min: -50, max: 0   },
     sellRsi: { min: 0,   max: 100 },
     sellCv:  { min: 0,   max: 400 },
   }
   
   // Verify bounds are reasonable for the data
   console.log("Current data range analysis:", {
     rsiRange: [Math.min(...rsiValues), Math.max(...rsiValues)],
     cvRange: [Math.min(...cvValues), Math.max(...cvValues)]
   })
   ```

2. **Adjust Step Sizes**
   ```typescript
   const stepSizes = {
     rsi: 5,  // Try smaller steps for fine-tuning: 1-2
     cv: 5    // Try smaller steps for fine-tuning: 1-2
   }
   ```

3. **Increase Iteration Count**
   ```typescript
   const maxIterations = 300  // Try increasing to 500-1000
   ```

#### **Optimization Performance Issues**
**Symptoms**: Slow optimization, browser freezing

**Solutions**:
1. **Add Animation Delays**
   ```typescript
   // Add delays for UI responsiveness
   await new Promise(resolve => setTimeout(resolve, 50))
   ```

2. **Reduce Computation Complexity**
   ```typescript
   // Limit data size for optimization
   const optimizationData = ohlcvData.slice(-500)  // Use last 500 candles only
   ```

### UI and Interaction Issues

#### **Sliders Not Updating During Optimization**
**Symptoms**: Parameter sliders don't show real-time changes

**Solution**:
```typescript
// Ensure proper state binding
<input
  type="range"
  value={isOptimizing ? testParams.buyRsi : buyRsiThreshold}
  onChange={(e) => setBuyRsiThreshold(Number(e.target.value))}
  disabled={isOptimizing}
/>

// Update test parameters during optimization
setTestParams({
  buyRsi: candidate.buyRsi,
  buyCv: candidate.buyCv,
  sellRsi: candidate.sellRsi,
  sellCv: candidate.sellCv
})
```

#### **Chart Resize Issues**
**Symptoms**: Chart doesn't resize properly on window resize

**Solution**:
```typescript
useEffect(() => {
  const handleResize = () => {
    if (chart.current && chartContainerRef.current) {
      chart.current.resize(
        chartContainerRef.current.clientWidth,
        500  // Fixed height or chartContainerRef.current.clientHeight
      )
      chart.current.timeScale().fitContent()
    }
  }
  
  window.addEventListener("resize", handleResize)
  return () => window.removeEventListener("resize", handleResize)
}, [])
```

### Memory and Performance Issues

#### **Memory Leaks**
**Symptoms**: Browser becomes slow over time, increasing memory usage

**Solutions**:
1. **Proper Chart Cleanup**
   ```typescript
   // Always clean up chart instances
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
   ```

2. **Remove Event Listeners**
   ```typescript
   useEffect(() => {
     const handleEvent = () => { /* handler */ }
     window.addEventListener("resize", handleEvent)
     
     return () => {
       window.removeEventListener("resize", handleEvent)
     }
   }, [])
   ```

#### **Performance Degradation**
**Symptoms**: Slow chart updates, laggy optimization

**Solutions**:
1. **Optimize Data Processing**
   ```typescript
   // Use efficient array operations
   const processedData = useMemo(() => {
     return expensiveDataProcessing(rawData)
   }, [rawData])
   ```

2. **Debounce Parameter Updates**
   ```typescript
   const debouncedUpdate = useMemo(
     () => debounce((params) => updateChart(params), 100),
     []
   )
   ```

### Development Environment Issues

#### **TypeScript Errors**
**Note**: Build errors are ignored in this project for rapid development

**Common Issues**:
1. **Missing Type Definitions**
   ```typescript
   // Add proper interfaces
   interface ChartMarker {
     time: number
     position: 'belowBar' | 'aboveBar'
     color: string
     shape: 'arrowUp' | 'arrowDown' | 'square'
     text?: string
   }
   ```

2. **Import Path Issues**
   ```typescript
   // Use proper path aliases
   import { cn } from '@/lib/utils'
   import { Button } from '@/components/ui/button'
   ```

#### **Hot Reload Not Working**
**Solutions**:
1. **Restart Development Server**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear Next.js Cache**
   ```bash
   rm -rf .next
   npm run dev
   ```

### Diagnostic Commands

#### **Debug Information Collection**
```typescript
// Add to component for debugging
const debugInfo = {
  ohlcvDataLength: ohlcvData?.length || 0,
  hasChartRef: !!chart.current,
  hasSeriesRef: !!candlestickSeries.current,
  isOptimizing,
  currentParams: { buyRsiThreshold, buyCvThreshold, sellRsiThreshold, sellCvThreshold },
  testParams,
  bestParams,
  error
}

console.log("Debug Info:", debugInfo)
```

#### **Performance Monitoring**
```typescript
// Monitor optimization performance
console.time('optimization-run')
const result = await runHillClimbForFiveSeconds()
console.timeEnd('optimization-run')

// Monitor API response times
console.time('api-fetch')
const data = await fetchData()
console.timeEnd('api-fetch')
```

## ⚠️ CRITICAL FAILURE MODES TO AVOID

1. **API Data Quality Assumption**: Always verify actual data structure, not just API response success
2. **Silent Technical Analysis Degradation**: Simulated OHLC data breaks indicators without obvious errors  
3. **Volume Data Assumptions**: Many APIs provide price data but not volume - verify before implementing volume-based indicators
4. **Authentication vs Data Quality Trade-offs**: Free APIs with real data often superior to paid APIs with limited free tiers
5. **Exceeding API Data Point Limits**: Requesting >1000 points from GeckoTerminal OHLCV leads to `400 Bad Request`.
    - **AVOIDANCE**: Dynamically calculate and cap request limits. See `lib/api-service.ts` (`MAX_API_LIMIT`) & `lib/chart-config.ts` (`calculateOptimalLimit`).
6. **Duplicate Timestamps from API**: API might return entries with identical timestamps, causing chart library errors.
    - **AVOIDANCE**: Filter out duplicate timestamps after fetching and sorting data. See `.filter()` logic in `lib/api-service.ts`.
7. **Token Symbol Misconfiguration**: Relying on `pool.data.attributes.base_token_symbol` or `quote_token_symbol` directly.
    - **AVOIDANCE**: Use `fetchPoolWithTokens` from `lib/api-service.ts` which correctly fetches symbols from `included` data or parses the pool name. See detailed point above in "CRITICAL API SELECTION FAILURES".
8. **NEW: localStorage Persistence for Pool History**: User-added pairs were not persisting across sessions if `npm run dev` was restarted.
    - **FIX**: Ensured `usePoolHistory` hook correctly loads from `localStorage` on mount and saves history changes *only after* initial load is complete, preventing race conditions where an empty initial state overwrites stored data.
    - **LOCATION**: `hooks/use-pool-history.ts` (`useEffect` for loading, `useEffect` for saving with `isLoaded` guard).
9. **NEW: OHLCV Data Caching**: Repeatedly fetching the same OHLCV data for identical pool/interval/range requests.
    - **FIX**: Implemented `localStorage`-based caching in `hooks/use-ohlcv-cache.ts`.
      - `ChartContainer` now uses this hook (`getFromCache`, `saveToCache`).
      - Cache features time-based expiry per interval, checks for sufficient data points, and includes basic quota management (clearing oldest entries).
    - **DEBUGGING**: Check `localStorage` for `ohlcv-cache-...` keys. Observe console logs from `useOHLCVCache` and `ChartContainer`. UI pill shows data source.

This troubleshooting guide covers the most common issues encountered during development and provides systematic approaches to identify and resolve problems quickly, with special emphasis on **data quality verification, API limit handling, data deduplication, and caching patterns**.