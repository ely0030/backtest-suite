# Critical Implementation Patterns & Workarounds

## Overview

The crypto-chart application implements several critical patterns to handle complex state management, API interactions, and performance optimization. These patterns solve specific architectural challenges and prevent common failure modes.

## Race Condition Prevention Patterns

### localStorage Persistence Race Condition (`hooks/use-pool-history.ts`)

**PROBLEM**: Initial empty state overwrites stored localStorage data before it can be loaded.

**FAILURE MODE**: 
```typescript
// ❌ WRONG - Race condition
const [history, setHistory] = useState([])

useEffect(() => {
  // Load from localStorage
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) setHistory(JSON.parse(stored))
}, [])

useEffect(() => {
  // BUG: This fires immediately with empty array, overwriting localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}, [history])
```

**SOLUTION**: `isLoaded` flag pattern prevents premature saves.

```typescript
// ✅ CORRECT - Race condition prevented
const [history, setHistory] = useState([])
const [isLoaded, setIsLoaded] = useState(false)

useEffect(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setHistory(JSON.parse(stored))
  } finally {
    setIsLoaded(true) // CRITICAL: Mark as loaded regardless of outcome
  }
}, [])

useEffect(() => {
  if (!isLoaded) return // CRITICAL: Prevent premature saves
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}, [history, isLoaded]) // Include isLoaded in dependency array
```

**KEY INSIGHT**: The `finally` block ensures `isLoaded` is set even if localStorage parsing fails, preventing permanent state where saves never occur.

---

## Cache Coherency Patterns

### Flexible Cache Matching (`hooks/use-ohlcv-cache.ts`)

**PROBLEM**: Different timeframes calculate different `limit` values for same historical range, causing cache misses.

**EXAMPLE FAILURE**:
- 1w of 15m data = 672 points (cache key: `pool-15m-672`)
- 1w of 1h data = 168 points (cache key: `pool-1h-168`) 
- Same time period, different cache keys → unnecessary API calls

**SOLUTION**: Two-tier cache lookup with flexible matching.

```typescript
// ✅ CORRECT - Flexible cache matching
const getFromCache = (cacheKey: CacheKey) => {
  // Tier 1: Try exact match first
  const exactMatch = localStorage.getItem(buildCacheKey(cacheKey))
  if (exactMatch) return JSON.parse(exactMatch)
  
  // Tier 2: Flexible search for sufficient data
  const pattern = `${cacheKey.poolAddress}-${cacheKey.interval}-`
  
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(pattern)) {
      const cached = JSON.parse(localStorage.getItem(key))
      if (cached.data.length >= cacheKey.limit) {
        // Return sliced data to requested size
        return {
          ...cached,
          data: cached.data.slice(0, cacheKey.limit)
        }
      }
    }
  }
  
  return null
}
```

**LOGGING DISTINCTION**: Console logs differentiate "Exact cache hit" vs "Flexible cache hit" for debugging.

---

### Redundant Cache Entry Cleanup (`hooks/use-ohlcv-cache.ts`)

**PROBLEM**: Multiple cache entries for same pool/interval waste localStorage space.

**SOLUTION**: Clean up smaller datasets when saving larger ones.

```typescript
// ✅ CORRECT - Cleanup redundant entries
const saveToCache = (cacheKey: CacheKey, data: OHLCVDataPoint[]) => {
  const newKey = buildCacheKey(cacheKey)
  const pattern = `${cacheKey.poolAddress}-${cacheKey.interval}-`
  
  // Find and remove smaller redundant entries
  for (const existingKey of Object.keys(localStorage)) {
    if (existingKey.startsWith(pattern) && existingKey !== newKey) {
      const existing = JSON.parse(localStorage.getItem(existingKey))
      if (existing.data.length < data.length) {
        localStorage.removeItem(existingKey) // Remove smaller dataset
        console.log(`🧹 Cleaned up redundant cache entry: ${existingKey}`)
      }
    }
  }
  
  // Save new entry
  localStorage.setItem(newKey, JSON.stringify({
    data,
    timestamp: Date.now(),
    poolAddress: cacheKey.poolAddress,
    interval: cacheKey.interval
  }))
}
```

**BENEFIT**: Prevents localStorage from filling with redundant entries while maintaining cache efficiency.

---

## API Integration Patterns

### Rate Limit Recording Location Dependency

**CRITICAL INSIGHT**: Rate limit recording MUST happen in component before API call, NOT inside API service methods.

**PROBLEM**: Recording inside API service counts cache hits as API calls.

```typescript
// ❌ WRONG - Records every call to API service
// Inside lib/api-service.ts
static async fetchOHLCVData(poolAddress: string, interval: string) {
  rateLimitRecorder.recordApiCall('ohlcv-data', poolAddress, interval) // BUG!
  const response = await fetch(ohlcvUrl)
  // ...
}

// Component calls this even for cache hits
const data = await APIService.fetchOHLCVData(poolAddress, interval)
```

**SOLUTION**: Record only when actually making API request.

```typescript
// ✅ CORRECT - Record only actual API calls
// In components/chart-container.tsx
const fetchData = async () => {
  const cached = getFromCache(cacheKey)
  if (cached) {
    // Use cache - no API call recorded
    return cached
  }
  
  // Record API call only when actually making request
  rateLimitMonitor.recordApiCall('ohlcv-data', tokenAddress, interval)
  const data = await APIService.fetchChartData(...)
  return data
}
```

**EXACT LOCATION**: `components/chart-container.tsx:192` - immediately before `APIService.fetchChartDataWithLimit()`

---

## Chart Management Patterns

### Dependency Isolation for Chart Updates

**PROBLEM**: Chart flickering and performance issues from overlapping useEffect dependencies.

**FAILURE MODE**:
```typescript
// ❌ WRONG - Mixed dependencies cause chart recreation
useEffect(() => {
  createChart()
  updateMarkers()
  updateParameters() 
}, [ohlcvData, tradingResults, parameters]) // Too many triggers
```

**SOLUTION**: Separate chart creation from signal updates.

```typescript
// ✅ CORRECT - Isolated chart lifecycle management
// Chart creation - only on data changes
useEffect(() => {
  if (!ohlcvData) return
  createChart(ohlcvData)
  return () => cleanupChart() // Proper cleanup
}, [ohlcvData]) // Only depend on OHLCV data

// Signal updates - only on parameter changes  
useEffect(() => {
  if (!tradingResults || !candlestickSeries.current) return
  updateMarkers(tradingResults.signals)
}, [tradingResults]) // Only depend on trading results

// Parameter updates - separate from chart
useEffect(() => {
  const newResults = generateTradingSignals(ohlcvData, parameters)
  setTradingResults(newResults)
}, [ohlcvData, parameters]) // Parameters trigger recalculation, not chart recreation
```

**IMPACT**: Eliminated chart flickering and reduced console errors by 80k+ per session.

---

## State Management Patterns

### Optimization Hook Dependency Isolation

**PROBLEM**: Optimization logic in main component creates useEffect dependency chains leading to infinite loops.

**SOLUTION**: Extract optimization into separate hook with isolated dependencies.

```typescript
// ✅ CORRECT - Isolated optimization hook
// hooks/use-optimization.ts
export const useOptimization = (ohlcvData: OHLCVDataPoint[], updateChartWithParameters: Function) => {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [bestParams, setBestParams] = useState(DEFAULT_PARAMETERS)
  
  const runOptimization = useCallback(async () => {
    // Optimization logic isolated from parent component
    // No dependency on parent component state
  }, [ohlcvData, updateChartWithParameters])
  
  return { isOptimizing, bestParams, runOptimization }
}

// components/chart-container.tsx - Clean integration
const optimization = useOptimization(ohlcvData, updateChartWithParameters)
```

**BENEFIT**: Prevents infinite loops and enables independent optimization development.

---

## Error Handling Patterns

### Graceful API Fallback Chain

**PATTERN**: Multiple API endpoints with graceful degradation.

```typescript
// ✅ CORRECT - Fallback chain
static async fetchPoolWithTokens(poolAddress: string): Promise<TokenInfo> {
  try {
    // Primary: Full token data with relationships
    const response = await fetch(`${this.BASE_URL}/${poolAddress}?include=base_token,quote_token`)
    // ... process included token data
    return tokenInfo
  } catch (error) {
    console.error('Failed to fetch pool with tokens:', error)
    // Fallback: Basic pool info only
    return this.fetchTokenInfo(poolAddress)
  }
}

static async fetchTokenInfo(poolAddress: string): Promise<TokenInfo> {
  try {
    // Fallback endpoint
    const response = await fetch(`${this.BASE_URL}/${poolAddress}`)
    // ... parse pool name for symbols
    return tokenInfo
  } catch (error) {
    // Ultimate fallback
    return {
      symbol: 'Unknown',
      name: 'Unknown Token',
      address: poolAddress
    }
  }
}
```

**HIERARCHY**: Full data → Basic data → Fallback defaults

---

## Performance Optimization Patterns

### Debounced Search with Cleanup

**PATTERN**: Prevent excessive API calls while maintaining responsiveness.

```typescript
// ✅ CORRECT - Debounced search with proper cleanup
useEffect(() => {
  const timeoutId = setTimeout(() => {
    searchPools(query) // API call only after 500ms of no typing
  }, 500)

  return () => clearTimeout(timeoutId) // CRITICAL: Cleanup prevents memory leaks
}, [query, searchPools])
```

**TIMING**: 500ms chosen for optimal UX vs API efficiency balance.

---

### Memory-Efficient Chart Management

**PATTERN**: Proper chart instance cleanup prevents memory leaks.

```typescript
// ✅ CORRECT - Chart lifecycle management
useEffect(() => {
  if (!ohlcvData) return

  try {
    // Create chart instance
    const chartInstance = createChart(chartRef.current, chartOptions)
    chart.current = chartInstance
    
    // Setup resize handling
    const handleResize = () => {
      if (chart.current && chartContainerRef.current) {
        chart.current.resize(
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        )
      }
    }
    window.addEventListener("resize", handleResize)
    
    // CRITICAL: Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize)
      if (chart.current) {
        chart.current.remove() // Proper chart cleanup
        chart.current = null
      }
    }
  } catch (err) {
    console.error("Chart creation error:", err)
  }
}, [ohlcvData])
```

**KEY ELEMENTS**: Event listener cleanup, chart instance removal, null assignment.

---

## Data Transformation Patterns

### API Response Normalization

**PATTERN**: Transform inconsistent API responses to standardized format.

```typescript
// ✅ CORRECT - Defensive data transformation
const transformedResults = response.data.map(pool => {
  // Safe relationship resolution with fallbacks
  const baseToken = response.included?.find(
    item => item.id === pool.relationships?.base_token?.data?.id
  )
  const quoteToken = response.included?.find(
    item => item.id === pool.relationships?.quote_token?.data?.id
  )
  
  return {
    id: pool.id,
    address: pool.attributes?.address || '',
    name: pool.attributes?.name || 'Unknown Pool',
    baseSymbol: baseToken?.attributes?.symbol || 'Unknown',
    quoteSymbol: quoteToken?.attributes?.symbol || 'Unknown',
    volume24h: pool.attributes?.volume_usd?.h24 || '0',
    priceChange24h: pool.attributes?.price_change_percentage?.h24 || '0'
  }
})
```

**DEFENSIVE PROGRAMMING**: Every property access includes fallback values.

---

## Configuration Management Patterns

### Centralized Constants with Type Safety

**PATTERN**: Single source of truth for configuration with TypeScript enforcement.

```typescript
// ✅ CORRECT - Typed configuration constants
export const CHART_CONFIG = {
  DEFAULT_HEIGHT: 500,
  COLORS: {
    UP: '#26a69a',
    DOWN: '#ef5350'
  }
} as const // Ensures immutability and literal types

export const PARAMETER_BOUNDS = {
  buyRsi: { min: 0, max: 100 },
  sellRsi: { min: 0, max: 100 }
} as const

// Usage with type safety
const clampedValue = Math.max(
  PARAMETER_BOUNDS.buyRsi.min,
  Math.min(PARAMETER_BOUNDS.buyRsi.max, userInput)
)
```

**BENEFITS**: IntelliSense support, prevented magic numbers, consistent values across codebase.

---

## Common Anti-Patterns to Avoid

### ❌ Mixed Chart Dependencies
```typescript
// DON'T: Mix chart creation with signal updates
useEffect(() => {
  createChart()
  updateSignals()
}, [ohlcvData, parameters]) // Causes unnecessary chart recreation
```

### ❌ localStorage Race Conditions  
```typescript
// DON'T: Save immediately without checking load state
useEffect(() => {
  localStorage.setItem(key, JSON.stringify(data))
}, [data]) // May overwrite during initial load
```

### ❌ API Recording in Service Layer
```typescript
// DON'T: Record API calls inside service methods
static async fetchData() {
  recordApiCall() // Records cache hits as API calls
  return fetch(url)
}
```

### ❌ Dependency Chain Loops
```typescript
// DON'T: Create circular dependencies
useEffect(() => {
  updateState(calculatedValue)
}, [state]) // State change triggers effect that changes state
```

These patterns form the foundation for maintainable, performant React applications with complex state management and API integration requirements.