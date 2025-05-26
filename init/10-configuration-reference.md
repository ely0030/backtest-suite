# Configuration Reference

## Overview

The crypto-chart application uses a centralized configuration system to maintain consistency across chart rendering, API interactions, trading parameters, and historical data management. All configuration is consolidated in `lib/chart-config.ts`.

## Core Configuration Objects

### CHART_CONFIG

**Purpose**: Visual appearance and rendering parameters for TradingView lightweight-charts.

```typescript
export const CHART_CONFIG = {
  // Chart dimensions
  DEFAULT_HEIGHT: 500,
  DEFAULT_WIDTH: 800,
  
  // Price precision for cryptocurrency accuracy
  PRICE_PRECISION: 6,
  MIN_MOVE: 0.000001,
  
  // Color scheme for chart elements
  COLORS: {
    UP: '#26a69a',           // Bullish candles
    DOWN: '#ef5350',         // Bearish candles  
    BUY_SIGNAL: '#2196F3',   // Buy signal markers
    SELL_SIGNAL: '#ef5350',  // Sell signal markers
    PROFIT: '#26a69a',       // Profitable trades
    LOSS: '#ef5350',         // Losing trades
    BACKGROUND: 'transparent',
    TEXT: 'rgba(0, 0, 0, 0.9)',
    GRID: 'rgba(0, 0, 0, 0.1)',
    CROSSHAIR: 'rgba(0, 0, 0, 0.3)',
    ALL_SIGNALS_BUY: 'rgba(33, 150, 243, 0.4)',    // Semi-transparent buy signals
    ALL_SIGNALS_SELL: 'rgba(233, 30, 99, 0.4)'     // Semi-transparent sell signals
  },
  
  // Chart spacing and margins
  SCALE_MARGINS: {
    top: 0.2,    // 20% margin above highest price
    bottom: 0.2  // 20% margin below lowest price
  }
} as const
```

**CRITICAL USAGE**: Colors are referenced throughout chart creation and signal rendering to maintain visual consistency.

---

### API_CONFIG

**Purpose**: GeckoTerminal API integration parameters and defaults.

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://api.geckoterminal.com/api/v2/networks/solana/pools',
  NETWORK: 'solana',
  RATE_LIMIT_DELAY: 100, // ms between requests
  
  // Default pool address (SOL/USDC pair)
  DEFAULT_POOL: 'H8TcGwR9Ljs5sb5r1PJ2RZzruyqgf2zUzk5R31VVhpaq'
} as const
```

**EXACT INTEGRATION**: Used in `lib/api-service.ts` for all API endpoint construction.

---

### INTERVALS

**Purpose**: Standardized timeframe options for chart data.

```typescript
export const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
] as const
```

**USAGE**: Powers interval selection UI and API parameter mapping.

---

### TRADING_CONFIG

**Purpose**: Technical analysis and trading strategy parameters.

```typescript
export const TRADING_CONFIG = {
  // Technical indicators
  RSI_PERIOD: 14,                    // Standard RSI calculation period
  CHAIKIN_VOLATILITY_PERIOD: 10,    // CV calculation period
  
  // Portfolio simulation  
  INITIAL_INVESTMENT: 1000,          // Starting portfolio value for backtesting
  MIN_TRADES_FOR_VALIDITY: 3,       // Minimum trades for valid optimization results
  
  // Optimization algorithm settings
  OPTIMIZATION_DURATION: 5000,      // 5 seconds for hill climbing
  MAX_HILL_CLIMB_ITERATIONS: 300,   // Maximum iterations per optimization run
  OPTIMIZATION_DELAY: 50,           // ms between optimization steps
  STEP_SIZE: 5                      // Parameter adjustment increment
} as const
```

**CRITICAL FOR**: Technical analysis calculations and optimization algorithm tuning.

---

### PARAMETER_BOUNDS

**Purpose**: Constrain trading parameters within reasonable ranges.

```typescript
export const PARAMETER_BOUNDS = {
  buyRsi: { min: 0, max: 100 },      // RSI buy threshold bounds
  buyCv: { min: -50, max: 0 },       // Chaikin Volatility buy threshold (negative values)
  sellRsi: { min: 0, max: 100 },     // RSI sell threshold bounds
  sellCv: { min: 0, max: 400 }       // Chaikin Volatility sell threshold (positive values)
} as const
```

**USAGE**: Enforced in optimization algorithms and UI slider constraints.

---

### DEFAULT_PARAMETERS

**Purpose**: Starting values for trading strategy parameters.

```typescript
export const DEFAULT_PARAMETERS = {
  buyRsiThreshold: 40,      // RSI oversold threshold
  buyCvThreshold: -19.9,    // CV low volatility threshold 
  sellRsiThreshold: 72,     // RSI overbought threshold
  sellCvThreshold: 65       // CV high volatility threshold
} as const
```

**RATIONALE**: Values chosen based on common RSI overbought/oversold levels and Chaikin Volatility characteristics.

## Historical Data Configuration

### HISTORICAL_RANGES

**Purpose**: Standardized time period options for chart data requests.

```typescript
export const HISTORICAL_RANGES = {
  "1w": { label: "1 Week", days: 7 },
  "1m": { label: "1 Month", days: 30 },
  "3m": { label: "3 Months", days: 90 },
  "6m": { label: "6 Months", days: 180 },
  "max": { label: "Max Available", days: null }  // Uses API maximum
} as const
```

**API CONSTRAINT**: All ranges respect GeckoTerminal's 1000 data point limit per request.

---

## Utility Functions

### calculateOptimalLimit(interval: string, days: number): number

**Purpose**: Calculate optimal data point count based on timeframe and desired historical range.

**CRITICAL CONSTRAINT**: Respects GeckoTerminal's 1000 data point maximum.

```typescript
// Examples:
calculateOptimalLimit("1m", 7)   // 7 days of 1-minute data
calculateOptimalLimit("1h", 30)  // 30 days of hourly data
calculateOptimalLimit("1d", 365) // 365 days of daily data
```

**Implementation Logic**:
- **1m**: Cap at 30 days (43,200 minutes → 1000 point limit)
- **5m**: Cap at 90 days (25,920 5-min periods → 1000 point limit)
- **15m**: Cap at 180 days (17,280 15-min periods → 1000 point limit)
- **1h**: No additional cap (24 * days)
- **4h**: No additional cap ((24/4) * days)
- **1d**: No additional cap (days)

**EXACT LOCATION**: Used in `components/chart-container.tsx` `fetchData()` method.

---

### getMaxRecommendedDays(interval: string): number

**Purpose**: Get maximum recommended days for each interval based on API limits.

```typescript
// API-optimized maximums:
"1m":  7 days      // ~1000 minutes
"5m":  35 days     // ~1000 5-minute periods
"15m": 104 days    // ~1000 15-minute periods  
"1h":  42 days     // ~1000 hours
"4h":  166 days    // ~1000 4-hour periods
"1d":  1000 days   // 1000 days
```

**USAGE**: Validates user-selected historical ranges against API capabilities.

---

### getTimestampDaysAgo(days: number): number

**Purpose**: Generate Unix timestamps for historical data requests.

```typescript
const timestamp = getTimestampDaysAgo(7)  // 7 days ago as Unix timestamp
```

**INTEGRATION**: Used with GeckoTerminal API's `before_timestamp` parameter.

---

## Legacy Configuration

### getBirdeyeParams(interval: string)

**Purpose**: Legacy function for Birdeye API integration (deprecated but preserved).

**STATUS**: No longer used due to data quality issues with Birdeye API's free tier.

**RETENTION REASON**: Preserved for potential future integration or reference.

## Configuration Usage Patterns

### API Service Integration
```typescript
// In lib/api-service.ts
import { API_CONFIG, TRADING_CONFIG } from '@/lib/chart-config'

const ohlcvUrl = `${API_CONFIG.BASE_URL}/${poolAddress}/ohlcv/${timeframe}`
await this.delay(API_CONFIG.RATE_LIMIT_DELAY)
```

### Chart Rendering
```typescript
// In components/chart-container.tsx
import { CHART_CONFIG, INTERVALS } from '@/lib/chart-config'

const chart = createChart(chartRef.current, {
  height: CHART_CONFIG.DEFAULT_HEIGHT,
  layout: {
    background: { color: CHART_CONFIG.COLORS.BACKGROUND }
  }
})
```

### Technical Analysis
```typescript
// In lib/technical-analysis.ts
import { TRADING_CONFIG } from '@/lib/chart-config'

const rsi = calculateRSI(closes, TRADING_CONFIG.RSI_PERIOD)
const cv = calculateChaikinVolatility(highs, lows, TRADING_CONFIG.CHAIKIN_VOLATILITY_PERIOD)
```

### Parameter Validation
```typescript
// In optimization algorithms
import { PARAMETER_BOUNDS, DEFAULT_PARAMETERS } from '@/lib/chart-config'

const clampedRsi = Math.max(PARAMETER_BOUNDS.buyRsi.min, 
                   Math.min(PARAMETER_BOUNDS.buyRsi.max, proposedValue))
```

## Configuration Management Best Practices

### 1. Centralization
- All constants defined in single file (`lib/chart-config.ts`)
- Imported as needed throughout application
- Prevents magic numbers and inconsistent values

### 2. Type Safety
- Uses `as const` assertions for immutable configuration
- TypeScript ensures proper typing and IntelliSense support
- Prevents accidental configuration mutations

### 3. API Constraint Awareness
- Configuration functions respect GeckoTerminal's 1000 data point limit
- Historical range calculations account for interval-specific constraints
- Rate limiting built into API configuration

### 4. Extensibility
- New intervals can be added to `INTERVALS` array
- Color schemes easily modified in `CHART_CONFIG.COLORS`
- Trading parameters adjustable via `DEFAULT_PARAMETERS` and `PARAMETER_BOUNDS`

## Critical Configuration Dependencies

### Chart Library Requirements
- `PRICE_PRECISION` and `MIN_MOVE` required for proper price formatting
- `SCALE_MARGINS` prevent data from touching chart edges
- Color consistency across all chart elements

### API Integration Requirements  
- `DEFAULT_POOL` provides fallback when no pool specified
- `RATE_LIMIT_DELAY` prevents API throttling
- Historical range functions respect API data point limits

### Performance Optimization
- Optimization timing constants prevent browser freezing
- Cache configuration balances memory usage with performance
- Rate limiting prevents API quota exhaustion

This centralized configuration system ensures consistency, maintainability, and proper constraint handling throughout the application.