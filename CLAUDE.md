# Crypto Chart Application

A sophisticated cryptocurrency charting and trading strategy analysis application built with Next.js 14, featuring real-time OHLCV data visualization, technical analysis, and automated parameter optimization.

## ⚠️ CRITICAL DATA QUALITY INSIGHT

**LESSON LEARNED**: API selection must prioritize **data authenticity** over convenience features.

**FAILURE CASE**: Initially attempted Birdeye API - appeared functional but provided **simulated OHLC data** that rendered technical analysis meaningless.

**CURRENT SOLUTION**: GeckoTerminal API provides **real OHLCV arrays** with no authentication required.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to localhost:3000 (or 3001 if 3000 is in use)
```

## Core Architecture

### Data Flow
```
GeckoTerminal API → Real OHLCV Data → Technical Analysis (RSI + Chaikin Volatility) → Signal Generation → Chart Visualization → Trading Analytics
```

### Key Technologies
- **Frontend**: Next.js 14, React 18, TypeScript
- **Charts**: TradingView Lightweight Charts
- **Data Source**: GeckoTerminal API (free, no API key required)
- **UI**: shadcn/ui + Tailwind CSS
- **Technical Analysis**: Custom RSI and Chaikin Volatility implementations

### Key Features
- **Real-time Data**: Fetches authentic OHLCV data from GeckoTerminal API for Solana pools
- **Persistent Cache**: OHLCV data cached in localStorage - **SURVIVES DEV SERVER RESTARTS**
- **Technical Analysis**: Implements RSI (Relative Strength Index) and Chaikin Volatility indicators
- **Trading Signals**: Automated buy/sell signal generation based on RSI/CV thresholds
- **Optimization**: Hill climbing algorithm for parameter optimization with 5-second optimization runs
- **Interactive Controls**: Real-time parameter adjustment with sliders for strategy tuning
- **Rate Limiting**: Live API usage monitoring with color-coded status indicators
- **Cache Visual Feedback**: Real-time pills showing data source (Cache Hit vs API Call)
- **🔥 NEW: Complete Dark Mode**: Theme-aware chart colors, UI elements, and professional dark gray palette

### UI Framework
- Uses shadcn/ui components built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Form validation with react-hook-form and zod

### Important Implementation Details
- **Modular Architecture**: Large 1,235-line component refactored into focused, reusable modules
- **Performance Optimizations**: useMemo for expensive calculations, useCallback for event handlers
- **Type Safety**: Comprehensive TypeScript coverage with proper interface definitions
- **Error Handling**: Robust API error handling with user-friendly messages
- **Configuration Management**: Centralized constants for maintainability
- Chart uses TradingView's lightweight-charts for performance with large datasets
- TypeScript strict mode enabled with path aliases (`@/*` maps to root)
- Next.js config has build optimizations disabled for development (eslint/typescript ignore during builds)
- All price data uses 6-decimal precision for cryptocurrency accuracy

### Recent Architectural Improvements
1. **Component Decomposition**: Split monolithic ChartContainer into focused modules
2. **Custom Hooks**: Extracted optimization logic into reusable `useOptimization` hook
3. **Service Layer**: Created dedicated API service with proper error handling
4. **Utility Functions**: Centralized technical analysis calculations
5. **Configuration**: Extracted hardcoded values into maintainable constants
6. **Performance**: Added memoization for expensive operations
7. **🔥 NEW: Persistent Cache System**: OHLCV data stored in browser localStorage with enhanced logging
8. **🔥 NEW: Rate Limit Monitor**: Real-time API usage tracking with cache efficiency metrics

### Cache Persistence Verification
To verify cache is working across dev server restarts:
1. Load any chart data (watch console for `💾 ✅ Successfully cached...` message)
2. Stop dev server (`Ctrl+C`)
3. Restart dev server (`npm run dev`) 
4. Reload page - console shows: `🔄 Cache initialized: Found X cached OHLCV entries`
5. Load same pool/timeframe - should see `📦 Using Cached Data` pill (green)
6. Cache stats tooltip shows hit/miss rates and persistence confirmation

### Cache Visual Indicators
Real-time feedback pills appear briefly (2 seconds) after data loads:
- **🌐 API Call** (blue) - Fresh data fetched from GeckoTerminal API  
- **📦 Using Cached Data** (green) - Data served from localStorage cache
- **⚠️ Error** (red) - Failed to load data

**IMPLEMENTATION**: `dataLoadSource` state in `components/chart-container.tsx:145` controls pill display.

### Rate Limit Monitor Verification
To verify rate limiting is working correctly:
1. API counter only increments on cache misses (actual API calls)
2. Color-coded indicators: Green (safe), Orange (warning), Red (danger)
3. Detailed tooltip shows breakdown across time periods
4. Cache efficiency metrics display API calls saved

## ⚠️ CRITICAL FAILURE MODES IDENTIFIED

1. **API Data Quality Assumption**: Never assume API provides real data without verification
2. **Silent Technical Analysis Degradation**: Simulated OHLC breaks indicators without obvious errors
3. **Volume Data Availability**: Many price APIs don't include volume - verify before implementing volume-based features
4. **Authentication Complexity vs Data Quality**: Free APIs with real data often superior to paid APIs with limited free tiers
5. **⚠️ Rate Limit Recording Location**: CRITICAL - Record API calls only in component before actual fetch, NOT inside API service methods (would count cache hits as API calls)
6. **🔥 NEW: Dark Mode Color Dependencies**: Chart theme colors MUST be passed as parameters to `generateTradingSignals()` to avoid hardcoded light colors in signal markers. Signal colors don't auto-inherit theme without explicit passing.
7. **🔥 NEW: Optimization UI Jank**: Hill climbing runs 300+ iterations/second causing rapid state updates. MUST throttle UI updates to 200ms intervals during optimization to prevent performance issues. Remove excessive `setTestParams()` calls from iteration loops.

## File Structure

```
crypto-chart/
├── app/                    # Next.js App Router
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── chart-container.tsx # Main chart component
├── lib/                   # Core utilities
│   ├── api-service.ts    # GeckoTerminal integration (REAL OHLCV)
│   ├── chart-config.ts   # Configuration constants
│   └── technical-analysis.ts # RSI/CV calculations
├── hooks/                 # Custom React hooks
│   ├── use-rate-limit-monitor.ts # API usage tracking
│   └── use-ohlcv-cache.ts # Persistent cache with stats
├── types/                 # TypeScript definitions
└── init/                  # Comprehensive documentation
```

## Development

### Available Scripts
```bash
npm run dev     # Development server with hot reload
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Code quality checks
```

### Configuration
- **TypeScript**: Strict mode enabled with path aliases
- **ESLint/TypeScript**: Errors ignored during builds for rapid development
- **Next.js**: Optimized for development speed with experimental features

## Documentation

Comprehensive documentation available in `/init/` folder:
- **01-project-overview.md**: Architecture and technology decisions
- **02-component-architecture.md**: Component structure and patterns (UPDATED with hooks & visual feedback)
- **03-data-flow-apis.md**: API integration and data processing (UPDATED with GeckoTerminal insights & rate limiting)
- **04-technical-analysis.md**: RSI and Chaikin Volatility implementation
- **05-optimization-algorithms.md**: Hill climbing parameter optimization
- **06-ui-styling-system.md**: Design system and styling approach
- **07-development-workflow.md**: Development setup and best practices
- **08-troubleshooting-guide.md**: Common issues and solutions (UPDATED with API selection failures)
- **🔥 NEW: 09-custom-hooks-reference.md**: Complete custom hooks documentation with implementation details
- **🔥 NEW: 10-configuration-reference.md**: Centralized configuration system and utility functions
- **🔥 NEW: 11-ui-features-reference.md**: Advanced UI features (search, history, mobile, visual feedback)
- **🔥 NEW: 12-implementation-patterns.md**: Critical patterns and workarounds for common failure modes

## API Integration

### GeckoTerminal API (Current)
- **Base URL**: `https://api.geckoterminal.com/api/v2/networks/solana/pools`
- **Authentication**: None required
- **Data Quality**: Real OHLCV arrays with authentic volume data
- **Rate Limits**: Reasonable for development use (monitored via useRateLimitMonitor hook)
- **Cost**: Completely free

### Data Verification Pattern
```typescript
// Always verify data authenticity
const isSimulatedData = (ohlcvData: OHLCVDataPoint[]) => {
  const allZeroVolume = ohlcvData.every(d => d.volume === 0)
  const artificialVariation = ohlcvData.some(d => {
    const range = (d.high - d.low) / d.close
    return range < 0.001 // Less than 0.1% indicates simulation
  })
  return allZeroVolume || artificialVariation
}
```

## ⚠️ CRITICAL RATE LIMITING IMPLEMENTATION INSIGHTS

**LOCATION DEPENDENCY**: Rate limit recording MUST occur in `components/chart-container.tsx:192` **before** API call, not inside `lib/api-service.ts` methods.

**REASON**: Cache check happens in component **before** calling API service. Recording inside service methods counts cache hits as API calls.

**EXACT FIX PATTERN**:
```typescript
// ✅ CORRECT - Record only on actual API calls
setDataLoadSource('API')
rateLimitMonitor.recordApiCall('ohlcv-data', tokenAddress, interval)
const { tokenInfo, ohlcvData } = await APIService.fetchChartData(...)

// ❌ WRONG - Would count every cache check as API call  
// Inside APIService methods: rateLimitRecorder.recordApiCall(...)
```

**FILES AFFECTED**:
- `components/chart-container.tsx:192` - Rate limit recording location
- `hooks/use-rate-limit-monitor.ts` - Full monitoring implementation
- `lib/api-service.ts` - Removed automatic recording (lines 84,152,210,336)

## ⚠️ CRITICAL DARK MODE ARCHITECTURE

**HIDDEN DEPENDENCY**: TradingView chart colors do NOT auto-inherit CSS theme variables. Must explicitly pass theme-aware colors.

**EXACT IMPLEMENTATION PATTERN**:
```typescript
// components/chart-container.tsx:84-85,251-261
const { theme, resolvedTheme } = useTheme()
const isDarkMode = resolvedTheme === 'dark'

// CRITICAL: Pass colors to both chart AND signals
const chartColors = getChartColors(isDarkMode)
const signalColors = { buySignal: chartColors.BUY_SIGNAL, ... }
generateTradingSignals(ohlcvData, parameters, showAllSignals, signalColors)
```

**THEME UPDATE TRIGGER**: Chart useEffect MUST depend on `[ohlcvData, isDarkMode]` to re-render on theme change.

**UI ELEMENT DARK MODE PATTERN**: All hardcoded `bg-*-50`, `bg-*-100` require explicit dark variants:
- Pattern: `bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300`
- Chart tooltip: Use CSS variables `hsl(var(--background))` for dynamic theming

**SOFT DARK PALETTE**: Uses blue-gray (`hsl(222 14% 8%)`) instead of pure black for professional appearance.

**FILES AFFECTED**:
- `lib/chart-config.ts:32-45` - DARK_COLORS config + getChartColors() helper
- `lib/technical-analysis.ts:113-132` - Added colors parameter to generateTradingSignals()
- `components/chart-container.tsx:572-627` - UI element dark mode classes
- `app/globals.css:51-84` - Soft dark color palette

## ⚠️ CRITICAL OPTIMIZATION PERFORMANCE

**JANK ROOT CAUSE**: Hill climbing optimization triggers 300+ UI updates/second via rapid `onParametersUpdate()` calls.

**THROTTLING PATTERN**:
```typescript
// hooks/use-optimization.ts:138-158
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 200; // Only update UI every 200ms
if (now - lastUpdateTime >= UPDATE_THROTTLE) {
  onParametersUpdate(localBest);
  lastUpdateTime = now;
}
```

**REMOVED PERFORMANCE KILLERS**:
- `setTestParams()` on every iteration (was 300+ calls/second)
- Only update test params when better solution found

**MEMOIZATION**: Trade analytics display values pre-calculated in `useMemo` to prevent `toFixed()` recalculation on every render.

**FILES AFFECTED**:
- `hooks/use-optimization.ts:138-158` - UI update throttling
- `components/chart-container.tsx:271-278` - Memoized display values

This application demonstrates modern React development practices with advanced financial charting capabilities using **verified authentic market data**. 