# Custom Hooks Reference

## Overview

The crypto-chart application uses a collection of custom React hooks to encapsulate complex stateful logic and provide reusable functionality across components. Each hook addresses specific architectural concerns and performance optimizations.

## Critical Hooks

### useOHLCVCache Hook (`/hooks/use-ohlcv-cache.ts`)

**Purpose**: Minimize redundant API calls through intelligent localStorage-based caching of OHLCV data.

**CRITICAL ARCHITECTURAL INSIGHT**: Implements **flexible cache matching** to handle timeframe switching efficiently.

**Key Features**:
- **Two-tier cache lookup**: Exact match → flexible match with sufficient data points
- **Redundant entry cleanup**: Removes smaller datasets when saving larger ones for same pool/interval
- **Time-based expiry**: Different expiry times per interval (1m: 5min, 1d: 24hr)
- **Cache statistics**: Hit/miss tracking for rate limit monitoring
- **Quota management**: Automatic cleanup when localStorage limits approached

**API**:
```typescript
const { 
  getFromCache, 
  saveToCache, 
  cacheStats, 
  clearAllCache, 
  getCacheSize, 
  getCacheDebugInfo 
} = useOHLCVCache()
```

**Critical Methods**:
- `getFromCache({ poolAddress, interval, limit })`: Returns cached data or null
- `saveToCache(cacheKey, data)`: Stores data with cleanup of redundant entries
- `cacheStats`: Provides hit/miss statistics for monitoring

**Flexible Matching Logic** (`lines 47-89`):
1. Try exact cache key match first
2. If miss, search all keys matching `poolAddress-interval-*` pattern  
3. Return first valid entry with ≥ limit data points, sliced to requested size

**FAILURE MODE PREVENTED**: Different timeframes calculate different `limit` values for same historical range, causing unnecessary cache misses.

---

### useRateLimitMonitor Hook (`/hooks/use-rate-limit-monitor.ts`)

**Purpose**: Track API usage patterns and cache efficiency to prevent hitting GeckoTerminal rate limits.

**CRITICAL LOCATION DEPENDENCY**: Rate limit recording MUST happen in component before API call, NOT inside API service methods.

**Key Features**:
- **Multi-period tracking**: 1min, 5min, 1hour, 1day time windows
- **Cache efficiency metrics**: Calculates API calls saved via caching
- **Color-coded status**: Green (safe), Orange (warning), Red (danger)
- **Persistent statistics**: localStorage-based tracking across sessions
- **Detailed breakdowns**: Per-endpoint usage analysis

**API**:
```typescript
const rateLimitMonitor = useRateLimitMonitor()

// Record API call (only when actually making API request)
rateLimitMonitor.recordApiCall('ohlcv-data', poolAddress, interval)

// Get current status
const status = rateLimitMonitor.getRateLimitStatus() // 'safe' | 'warning' | 'danger'
const breakdown = rateLimitMonitor.getDetailedBreakdown()
```

**Rate Limit Thresholds**:
- **Safe**: < 50 calls/day, < 20 calls/hour
- **Warning**: 50-90 calls/day, 20-35 calls/hour  
- **Danger**: > 90 calls/day, > 35 calls/hour

**EXACT INTEGRATION**: `components/chart-container.tsx:192` records API calls immediately before `APIService.fetchChartDataWithLimit()`

---

### usePoolSearch Hook (`/hooks/use-pool-search.ts`)

**Purpose**: Provide debounced, real-time pool search functionality with result transformation.

**Key Features**:
- **Debounced search**: 500ms delay prevents excessive API calls
- **Result transformation**: Converts GeckoTerminal API response to standardized format
- **Relationship resolution**: Extracts token symbols from included data arrays
- **Error handling**: Graceful fallbacks for missing data
- **Loading states**: Progress tracking for UI feedback

**API**:
```typescript
const { 
  query, 
  setQuery, 
  results, 
  loading, 
  error, 
  clearSearch 
} = usePoolSearch()
```

**SearchResult Interface**:
```typescript
interface SearchResult {
  id: string
  address: string
  name: string
  baseSymbol: string
  quoteSymbol: string
  baseTokenAddress: string
  quoteTokenAddress: string
  dexName: string
  volume24h: string
  priceChange24h: string
  reserveUsd: string
}
```

**Critical Implementation Details**:
- **Minimum query length**: 2 characters to trigger search
- **Network filtering**: Defaults to Solana network
- **Relationship parsing**: Extracts token data from `included` arrays in API response
- **Debounce timing**: 500ms chosen for optimal UX vs API efficiency balance

---

### usePoolHistory Hook (`/hooks/use-pool-history.ts`)

**Purpose**: Manage localStorage-based pool history with race condition prevention.

**CRITICAL RACE CONDITION FIX**: `isLoaded` flag prevents empty initial state from overwriting stored history.

**Key Features**:
- **Race condition prevention**: Only saves after initial localStorage load complete
- **Automatic sorting**: Most recently visited pools appear first
- **Duplicate handling**: Updates timestamp for existing pools instead of duplicating
- **Size limiting**: Maintains maximum of 10 history items
- **Comprehensive logging**: Debug information for troubleshooting persistence issues

**API**:
```typescript
const { 
  history, 
  addToHistory, 
  removeFromHistory, 
  clearHistory 
} = usePoolHistory()
```

**PoolHistoryItem Interface**:
```typescript
interface PoolHistoryItem {
  address: string
  baseSymbol: string
  quoteSymbol: string
  name: string
  lastVisited: number
}
```

**Race Condition Prevention Pattern**:
```typescript
const [isLoaded, setIsLoaded] = useState(false)

// Load from localStorage
useEffect(() => {
  // ... load logic
  setIsLoaded(true)
}, [])

// Save to localStorage (only after load complete)
useEffect(() => {
  if (!isLoaded) return // CRITICAL: Prevent premature saves
  // ... save logic
}, [history, isLoaded])
```

---

### useOptimization Hook (`/hooks/use-optimization.ts`)

**Purpose**: Extract hill climbing optimization logic into reusable, isolated hook.

**Key Features**:
- **Dependency isolation**: Prevents infinite loops in parent component
- **Progress tracking**: Real-time optimization status and iteration counts
- **Result management**: Tracks best parameters and performance metrics
- **Cancellation support**: Ability to stop optimization mid-process
- **Parameter bounds**: Respects trading parameter constraints

**API**:
```typescript
const { 
  isOptimizing, 
  testParams, 
  bestParams, 
  highestProfit, 
  runOptimization, 
  stopOptimization 
} = useOptimization(ohlcvData, updateChartWithParameters)
```

**Critical Dependency Management**:
- Hook isolates optimization logic from chart component
- Prevents useEffect dependency issues in parent component
- Enables parallel optimization development and testing

---

### useIsMobile Hook (`/hooks/use-mobile.tsx`)

**Purpose**: Responsive design support with efficient viewport detection.

**Key Features**:
- **Breakpoint detection**: 768px mobile threshold
- **Media query listener**: Automatic updates on viewport changes
- **Performance optimized**: Single media query listener
- **SSR safe**: Handles undefined initial state gracefully

**API**:
```typescript
const isMobile = useIsMobile() // boolean
```

**Implementation Details**:
- **Breakpoint**: 768px (standard mobile breakpoint)
- **Event handling**: Uses `matchMedia` for efficient viewport monitoring
- **Cleanup**: Properly removes event listeners on unmount

## Hook Integration Patterns

### Cache + Rate Limiting Integration
```typescript
// In ChartContainer component
const { getFromCache, saveToCache } = useOHLCVCache()
const rateLimitMonitor = useRateLimitMonitor()

const fetchData = async () => {
  const cached = getFromCache(cacheKey)
  if (cached) {
    // Use cache - no API call recorded
    return cached
  }
  
  // Record API call only when actually making request
  rateLimitMonitor.recordApiCall('ohlcv-data', poolAddress, interval)
  const data = await APIService.fetchChartData(...)
  saveToCache(cacheKey, data)
  return data
}
```

### Search + History Integration
```typescript
// Pool selection from search results
const { addToHistory } = usePoolHistory()
const { results, clearSearch } = usePoolSearch()

const handlePoolSelect = (pool: SearchResult) => {
  addToHistory({
    address: pool.address,
    baseSymbol: pool.baseSymbol,
    quoteSymbol: pool.quoteSymbol,
    name: pool.name
  })
  clearSearch()
  // Navigate to selected pool
}
```

## Performance Considerations

### Memory Management
- **Cache cleanup**: Automatic localStorage quota management
- **Event listeners**: Proper cleanup in mobile detection
- **Debouncing**: Prevents excessive API calls in search

### State Synchronization
- **Race condition prevention**: History persistence timing
- **Dependency isolation**: Optimization hook separation
- **Cache coherency**: Flexible matching with redundant entry cleanup

## Debugging and Monitoring

### Debug Utilities
- **Cache inspection**: `getCacheDebugInfo()` provides detailed cache state
- **Rate limit monitoring**: Live API usage tracking and breakdown
- **History logging**: Comprehensive persistence operation logging

### Common Issues
- **Cache misses**: Verify flexible matching logic is working
- **Rate limit inflation**: Ensure recording happens only on actual API calls
- **History loss**: Check `isLoaded` flag timing and localStorage operations
- **Search performance**: Monitor debounce timing and result transformation

This hook architecture provides a robust foundation for scalable feature development while maintaining performance and data consistency.