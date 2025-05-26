# Data Flow & API Integration

## ⚠️ CRITICAL API SELECTION INSIGHTS

### **GeckoTerminal vs Birdeye: Lessons Learned**

**FAILURE MODE**: Birdeye API appeared functional but provided **fundamentally broken data** for trading applications.

**ROOT CAUSE**: Free tier only provides closing prices, not true OHLCV data. Application **silently degraded** to meaningless simulated candlesticks.

**DETECTION**: 
- Volume always 0
- OHLC values artificially generated with `price * (1 ± 0.001)`
- Technical indicators became unreliable due to fake price ranges

**SOLUTION**: Reverted to GeckoTerminal - provides **real OHLCV arrays** with no authentication required.

**EXACT IMPACT LOCATIONS**:
- `lib/api-service.ts`: Complete rewrite from Birdeye simulation to real data transformation
- `lib/chart-config.ts`: Removed API_KEY dependency, restored pool-based addressing
- `components/chart-container.tsx`: Updated to use `DEFAULT_POOL` instead of `DEFAULT_TOKEN`

## Data Flow Architecture

### High-Level Data Flow
```
User Interaction (Pool/Timeframe Change)
  ↓
`ChartContainer` (`fetchData`)
  ↓
`useOHLCVCache` (`getFromCache`)
  ├── Exact Cache Match? → Use Cached OHLCV Data
  ├── Flexible Cache Match (≥ data points)? → Use Cached Data (sliced to size)
  └── Cache Miss? → **Rate Limit Recording** → `APIService.fetchChartDataWithLimit` (Fetches TokenInfo & OHLCV)
                     ↓
                   `useOHLCVCache` (`saveToCache` + cleanup redundant entries)
                     ↓
OHLCV Data (Real or Cached) → Technical Analysis → Signal Generation → Chart Visualization → Trading Analytics
```

**CRITICAL CACHING INSIGHT**: `localStorage` uses **flexible cache matching** to prevent redundant API calls when switching timeframes.
- **FAILURE MODE AVOIDED**: Different intervals calculate different `limit` values for same historical range, causing cache misses
- **SOLUTION**: If exact cache key fails, search for any cache entry with sufficient data points for same pool/interval
- **EXACT LOCATION**: `hooks/use-ohlcv-cache.ts` `getFromCache()` method implements two-tier lookup strategy

## API Integration

### GeckoTerminal API (CURRENT - VERIFIED WORKING)

**Base URL**: `https://api.geckoterminal.com/api/v2/networks/solana/pools`

**CRITICAL ADVANTAGE**: No API key required, real OHLCV data, unlimited free access, though limited to 1000 data points per request.

#### **API Endpoints Used**

**1. Pool Information**
```
GET /api/v2/networks/solana/pools/{poolAddress}
GET /api/v2/networks/solana/pools/{poolAddress}?include=base_token,quote_token
```
**Purpose**: Fetch pool metadata. Token symbols (`base_token_symbol`, `quote_token_symbol`) are NOT directly in `data.attributes`.
**CRITICAL INSIGHT**: To get token symbols reliably:
  - **Best Method**: Use `?include=base_token,quote_token`. Symbols are then in `included[<index>].attributes.symbol`.
  - **Fallback**: Parse `data.attributes.name` (e.g., "TOKENA / TOKENB").
**Response Structure (with `include`):**
```typescript
{
  data: {
    attributes: { // Basic pool details, NO base_token_symbol/quote_token_symbol here
      name: string, // e.g., "JUP / SOL"
      pool_name: string, // e.g., "JUP / SOL"
      // ... other pool metadata
    },
    relationships: { // IDs to link to 'included' items
      base_token: { data: { id: string, type: "token" } },
      quote_token: { data: { id: string, type: "token" } }
    }
  },
  included: [ // Array of token and dex details
    {
      id: string, // Matches relationships.base_token.data.id
      type: "token",
      attributes: {
        symbol: string, // << THE ACTUAL BASE TOKEN SYMBOL
        name: string,
        // ... other token metadata
      }
    },
    {
      id: string, // Matches relationships.quote_token.data.id
      type: "token",
      attributes: {
        symbol: string, // << THE ACTUAL QUOTE TOKEN SYMBOL
        name: string,
        // ... other token metadata
      }
    }
    // ... may also include dex information
  ]
}
```
**EXACT LOCATION**: `lib/api-service.ts` in `fetchPoolWithTokens()` and `fetchTokenInfo()` methods. `fetchPoolWithTokens` is preferred.

**2. OHLCV Data**
```
GET /api/v2/networks/solana/pools/{poolAddress}/ohlcv/{timeframe}?aggregate={period}&limit={count}
```
**Purpose**: Fetch **real** candlestick chart data
**Parameters**:
- `timeframe`: "minute", "hour", "day"
- `aggregate`: Period multiplier (1, 5, 15 for minutes; 1, 4 for hours; 1 for days)
- `limit`: Number of candles to fetch (max 1000, enforced by `lib/api-service.ts` and `lib/chart-config.ts`)
- `before_timestamp` (optional): Fetch data before a specific Unix timestamp.
- `after_timestamp` (optional): Fetch data after a specific Unix timestamp.

**Response Structure**:
```typescript
{
  data: {
    attributes: {
      ohlcv_list: [
        [timestamp, open, high, low, close, volume]
        // Array of REAL OHLCV arrays - NOT simulated
      ]
    }
  }
}
```

#### **Timeframe Configuration**
```typescript
function getOhlcvParams(interval: string, customLimit?: number) {
  // GeckoTerminal API has a maximum limit of 1000 data points
  const MAX_API_LIMIT = 1000;
  
  // Default limits are calculated to respect MAX_API_LIMIT based on interval
  // e.g., for "1m", default is Math.min(60 * 24 * 7, MAX_API_LIMIT)
  // See lib/api-service.ts for full details.

  switch (interval) {
    case "1m":
      return { timeframeParam: "minute", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1m"], MAX_API_LIMIT) };
    case "5m":
      return { timeframeParam: "minute", aggregateParam: "5", limit: Math.min(customLimit || defaultLimits["5m"], MAX_API_LIMIT) };
    case "15m":
      return { timeframeParam: "minute", aggregateParam: "15", limit: Math.min(customLimit || defaultLimits["15m"], MAX_API_LIMIT) };
    case "1h":
      return { timeframeParam: "hour", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1h"], MAX_API_LIMIT) };
    case "4h":
      return { timeframeParam: "hour", aggregateParam: "4", limit: Math.min(customLimit || defaultLimits["4h"], MAX_API_LIMIT) };
    case "1d":
      return { timeframeParam: "day", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1d"], MAX_API_LIMIT) };
    default:
      return { timeframeParam: "hour", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1h"], MAX_API_LIMIT) };
  }
}
```

**CRITICAL**: `getOhlcvParams` in `lib/api-service.ts` now accepts an optional `customLimit` and always enforces `MAX_API_LIMIT = 1000`.

## Data Processing Pipeline

### 1. Raw Data Fetching (`components/chart-container.tsx` -> `fetchData`)
- **NEW**: `fetchData` now integrates `useOHLCVCache`.
  - `getFromCache({ poolAddress, interval, limit })` is called first.
  - If valid cached OHLCV data exists, it's used. `APIService.fetchPoolWithTokens` is still called for potentially updated token metadata (name, symbols).
  - If no valid cache, `APIService.fetchChartDataWithLimit` is called.
  - Successfully fetched API data is then stored using `saveToCache(cacheKey, fetchedOhlcvData)`.

```typescript
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);

    // Calculate customLimit based on historicalRange and interval from UI
    // See components/chart-container.tsx `fetchData` for this logic
    const customLimit = calculateOptimalLimit(interval, actualDays); // Example logic

    const cacheKey = { poolAddress, interval, limit: customLimit };
    const cachedData = getFromCache(cacheKey);

    if (cachedData) {
      // Use cached OHLCV, fetch fresh tokenInfo
      const tokenInfo = await APIService.fetchPoolWithTokens(poolAddress);
      setTokenPair({ // Simplified based on TokenInfo structure
        base: tokenInfo.baseSymbol || 'Unknown',
        quote: tokenInfo.quoteSymbol || 'Unknown'
      });
      return;
    }

    // Fetch from API
    const { tokenInfo, ohlcvData } = await APIService.fetchChartDataWithLimit(poolAddress, interval, { limit: customLimit });
    saveToCache(cacheKey, ohlcvData); // Save to cache
    
    // Process and store data
    processOHLCVData(ohlcvData.data.attributes.ohlcv_list)
    
  } catch (err) {
    handleError(err)
  }
}
```

### 2. Data Transformation
```typescript
const processOHLCVData = (rawData: [number, string, string, string, string, string][]) => {
  const transformedData = rawData
    .map(([timestamp, open, high, low, close, volume]) => ({
      time: timestamp as number,
      open: Number(open),    // REAL open price
      high: Number(high),    // REAL high price
      low: Number(low),      // REAL low price
      close: Number(close),  // REAL close price
      volume: Number(volume) // REAL volume data
    }))
    .sort((a, b) => a.time - b.time) // Ensure chronological order
    .filter((item, index, array) => { // Deduplication logic
      return index === 0 || item.time !== array[index - 1].time;
    });

  setOhlcvData(transformedData)
}
```

**CRITICAL**: Data transformation in `lib/api-service.ts` now includes a `.filter()` step to remove duplicate timestamps, preventing chart library errors.

### 3. Technical Analysis Calculations

#### **RSI (Relative Strength Index)**
```typescript
function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  // Calculate initial average gain/loss for the first period
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  // Calculate RSI for subsequent periods using smoothed averages
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    // Exponential smoothing
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  return rsi;
}
```

#### **Chaikin Volatility**
```typescript
function calculateChaikinVolatility(highs: number[], lows: number[], length = 10): number[] {
  const cv: number[] = [];
  const hlDiff = highs.map((h, i) => h - lows[i]); // High-Low differences
  
  // Calculate EMA of H-L differences
  let multiplier = 2 / (length + 1);
  let emaHL: number[] = [];
  let initialEMA = hlDiff.slice(0, length).reduce((a, b) => a + b) / length;
  
  emaHL.push(initialEMA);
  for (let i = length; i < hlDiff.length; i++) {
    emaHL.push((hlDiff[i] - emaHL[emaHL.length - 1]) * multiplier + emaHL[emaHL.length - 1]);
  }
  
  // Calculate Chaikin Volatility as percentage change in EMA
  for (let i = length; i < emaHL.length; i++) {
    const cvValue = ((emaHL[i] - emaHL[i - length]) / emaHL[i - length]) * 100;
    cv.push(cvValue);
  }
  
  return cv;
}
```

### 4. Signal Generation Logic

```typescript
const generateTradingSignals = (ohlcvData, rsiValues, cvValues, parameters) => {
  const signals = [];
  const trades = [];
  let activeBuySignal = null;

  for (let i = 1; i < rsiValues.length; i++) {
    const cvIndex = cvValues.length - rsiValues.length + i;
    
    if (cvIndex >= 0) {
      // BUY SIGNAL: RSI below threshold AND CV below threshold
      if (!activeBuySignal && 
          cvValues[cvIndex] < parameters.buyCvThreshold && 
          rsiValues[i] < parameters.buyRsiThreshold) {
        
        activeBuySignal = {
          time: ohlcvData[i + 14].time,
          price: ohlcvData[i + 14].close
        };
        
        signals.push({
          time: ohlcvData[i + 14].time,
          position: 'belowBar',
          color: '#2196F3',
          shape: 'arrowUp',
          text: 'BUY'
        });
      }
      
      // SELL SIGNAL: RSI above threshold AND CV above threshold
      else if (activeBuySignal && 
               cvValues[cvIndex] > parameters.sellCvThreshold && 
               rsiValues[i] > parameters.sellRsiThreshold) {
        
        const sellPrice = ohlcvData[i + 14].close;
        const percentChange = calculatePercentageChange(activeBuySignal.price, sellPrice);
        
        // Record completed trade
        trades.push({
          buyTime: activeBuySignal.time,
          sellTime: ohlcvData[i + 14].time,
          buyPrice: activeBuySignal.price,
          sellPrice: sellPrice,
          percentageChange: percentChange
        });
        
        signals.push({
          time: ohlcvData[i + 14].time,
          position: 'aboveBar',
          color: '#ef5350',
          shape: 'arrowDown',
          text: 'SELL'
        });
        
        activeBuySignal = null;
      }
    }
  }
  
  return { signals, trades };
}
```

## Performance Analytics

### Trade Performance Calculation
```typescript
const calculatePortfolioPerformance = (trades: Trade[], initialInvestment = 1000) => {
  let currentPortfolioValue = initialInvestment;
  
  trades.forEach(trade => {
    // Compound returns: multiply by (1 + percentage change)
    currentPortfolioValue *= (1 + (trade.percentageChange / 100));
  });
  
  const totalPercentageChange = ((currentPortfolioValue - initialInvestment) / initialInvestment) * 100;
  
  return {
    initialInvestment,
    currentPortfolioValue,
    totalPercentageChange,
    trades
  };
}
```

## Data State Management

### State Variables
```typescript
// Raw chart data
const [ohlcvData, setOhlcvData] = useState<OHLCVDataPoint[] | null>(null)
const [dataLoadSource, setDataLoadSource] = useState<string | null>(null) // NEW: Tracks API vs Cache

// UI states
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [interval, setInterval] = useState<string>("15m")
const [tokenAddress, setTokenAddress] = useState<string>(API_CONFIG.DEFAULT_POOL) // POOL not TOKEN

// Trading parameters
const [parameters, setParameters] = useState<SignalParameters>(DEFAULT_PARAMETERS)

// Analytics and optimization
const [tradeAnalytics, setTradeAnalytics] = useState<TradeAnalytics>({...})
```

### Data Flow Triggers
- **User Input**: Pool address change, timeframe selection, historical range selection, parameter adjustments
- **API Responses / Cache Hits**: Data fetching completion, error handling
- **Optimization**: Parameter testing, best result updates
- **Chart Events**: Tooltip updates, crosshair movements

## ⚠️ CRITICAL FAILURE MODES TO AVOID

1. **API Data Quality Assumption**: Always verify actual data structure, not just API response success
2. **Silent Technical Analysis Degradation**: Simulated OHLC data breaks technical analysis without obvious errors
3. **Volume Data Assumptions**: Many APIs provide price data but not volume - verify before implementing volume-based indicators
4. **Authentication Complexity vs Data Quality**: Free APIs with real data (GeckoTerminal) often superior to paid APIs with limited free tiers (Birdeye)
5. **Exceeding API Data Point Limits**: Requesting >1000 points from GeckoTerminal OHLCV = `400 Bad Request`.
    - **AVOIDANCE**: `lib/api-service.ts` (`MAX_API_LIMIT`) & `lib/chart-config.ts` (`calculateOptimalLimit`) enforce this. `components/chart-container.tsx` calculates appropriate request size.
6. **Duplicate Timestamps from API**: API might return entries with identical timestamps, causing chart library errors ("data must be asc ordered by time").
    - **AVOIDANCE**: Filter out duplicate timestamps after fetching and sorting. See `.filter()` in `lib/api-service.ts` data transformation.
7. **Token Symbol Fetching**: `base_token_symbol` and `quote_token_symbol` are NOT reliably present in the main `pool.data.attributes`.
    - **AVOIDANCE**: Use `?include=base_token,quote_token` query parameter. Symbols are in `included[<index>].attributes.symbol`. Fallback to parsing `pool.data.attributes.name`.
    - **EXACT LOCATION**: Implemented in `lib/api-service.ts` in `fetchPoolWithTokens()` (preferred) and `fetchTokenInfo()`.
8. **NEW: Redundant API Calls for OHLCV Data**: Fetching same data repeatedly for same pool/interval/range.
    - **AVOIDANCE**: Implemented `localStorage` caching via `hooks/use-ohlcv-cache.ts`.
      - `ChartContainer` uses this hook to check cache before API calls.
      - Cache includes expiry logic per interval and automatic cleanup for quota management.
    - **DEBUGGING**: Check `localStorage` for `ohlcv-cache-...` keys. Observe console logs for cache hits/misses. Monitor `dataLoadSource` UI pill.
9. **⚠️ CRITICAL: Rate Limit Counter Location**: Recording API calls inside `lib/api-service.ts` methods counts cache hits as API calls.
    - **FAILURE MODE**: Rate monitor shows inflated API usage because recording happens before cache check.
    - **EXACT FIX**: Record API calls ONLY in `components/chart-container.tsx:192` before actual API service call.
    - **CORRECT PATTERN**: `rateLimitMonitor.recordApiCall('ohlcv-data', tokenAddress, interval)` immediately before `APIService.fetchChartData(...)`

This data flow architecture ensures efficient processing of **real**, **deduplicated**, **API-limit-aware**, and **cached** financial data while maintaining real-time responsiveness for user interactions and optimization algorithms.