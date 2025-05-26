# Project Overview - Crypto Chart Application

## What This Application Does

This is a sophisticated cryptocurrency charting and trading strategy analysis application built with Next.js 14. The application allows users to:

1. **View Real-Time Price Charts**: Display OHLCV (Open, High, Low, Close, Volume) candlestick charts for Solana-based cryptocurrency trading pairs
2. **Analyze Trading Strategies**: Implement and test automated trading strategies using technical indicators
3. **Optimize Parameters**: Use machine learning-inspired algorithms to find optimal trading parameters
4. **Track Performance**: Simulate trading performance with detailed analytics and profit tracking

## ⚠️ CRITICAL DATA QUALITY INSIGHT

**LESSON LEARNED**: API selection must prioritize **data authenticity** over convenience features.

**FAILURE CASE**: Initially attempted Birdeye API integration - appeared functional but provided **simulated OHLC data** that rendered technical analysis meaningless.

**CURRENT SOLUTION**: GeckoTerminal API provides **real OHLCV arrays** with no authentication required, enabling accurate technical analysis.

**ADDITIONAL INSIGHT - API DATA LIMITS**: GeckoTerminal API imposes a **maximum limit of 1000 data points** per OHLCV request. Exceeding this results in `400 Bad Request` errors.
  - **IMPACT**: Application must dynamically calculate requested data points based on timeframe and historical range to stay within this limit.
  - **LOCATION**: Logic handled in `lib/api-service.ts` (`getOhlcvParams`, `MAX_API_LIMIT`) and `lib/chart-config.ts` (`getMaxRecommendedDays`, `calculateOptimalLimit`). `components/chart-container.tsx` uses these to request appropriate data amounts.

**IMPACT (Simulated vs. Real Data)**: Real vs simulated data affects:
- RSI calculation accuracy (based on actual price movements)
- Chaikin Volatility reliability (requires real high/low ranges)
- Volume-based analysis (Birdeye returned volume=0)
- Trading signal validity (fake price ranges = unreliable signals)

## Core Features

### 1. Interactive Charting
- Professional-grade candlestick charts using TradingView's lightweight-charts library
- Multiple timeframe support (1 minute to 1 day intervals), respecting API data point limits
- Real-time data from GeckoTerminal API (verified authentic OHLCV, 1000 data points max per request)
- Interactive tooltips showing OHLC data
- Responsive design with chart resizing

### 2. Technical Analysis
- **RSI (Relative Strength Index)**: 14-period momentum oscillator
- **Chaikin Volatility**: Volatility indicator based on high-low range
- Combined signal generation using both indicators
- Visual buy/sell signals directly on the chart

### 3. Trading Strategy Simulation
- Automated buy/sell signal generation
- Backtesting on historical data
- Portfolio value tracking starting from $1000
- Individual trade performance analysis
- Cumulative profit/loss calculation

### 4. Parameter Optimization
- Hill climbing algorithm for finding optimal parameters
- 5-second optimization runs with real-time visual feedback
- Parameter bounds and constraints
- Best parameter tracking across multiple runs
- Live parameter testing with animated UI controls

### 5. User Interface
- Clean, modern design using shadcn/ui components
- Real-time parameter adjustment with sliders
- Trade analytics dashboard
- Pool address search functionality
- Responsive layout for different screen sizes

### 2. Data Authenticity & Integrity
- **CRITICAL**: Prioritizes fetching and processing **real, deduplicated OHLCV data** from GeckoTerminal.
- Ensures technical analysis is performed on authentic market data, avoiding pitfalls of simulated or erroneous data (e.g., duplicate timestamps, API limits).
- **LOCATIONS**: Data fetching and deduplication in `lib/api-service.ts`. Configuration for limits in `lib/chart-config.ts`.

## Technology Stack

### Frontend Framework
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript with strict mode
- **React 18**: Latest React with concurrent features

### Styling & UI
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React component library
- **Radix UI**: Accessible component primitives
- **CSS Variables**: Dynamic theming support

### Data Visualization
- **lightweight-charts**: Professional financial charting library
- **Custom Chart Components**: Wrapper components for chart management

### Data & APIs
- **GeckoTerminal API**: Real-time cryptocurrency data (NO API KEY REQUIRED)
- **Custom Data Processing**: OHLCV data transformation and caching

### Development Tools
- **ESLint**: Code linting (bypassed during builds for rapid development)
- **PostCSS**: CSS processing with Tailwind
- **TypeScript Compiler**: Type checking and compilation

## Project Structure

```
crypto-chart/
├── app/                    # Next.js App Router pages
├── components/            # React components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   ├── chart-container.tsx # Main chart component
│   └── theme-provider.tsx  # Theme management
├── lib/                   # Utility functions and data
│   ├── api-service.ts    # GeckoTerminal integration (REAL OHLCV)
│   ├── chart-config.ts   # Configuration constants
│   └── technical-analysis.ts # RSI/CV calculations
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
├── styles/                # Global CSS styles
└── public/                # Static assets
```

## Key Architectural Decisions

### 1. Single Large Component Approach
The main chart functionality is contained in one large `ChartContainer` component rather than being split into many smaller components. This was chosen because:
- Chart state is highly interconnected
- Optimization algorithms need direct access to chart updating functions
- Performance is critical for real-time updates

### 2. Direct API Integration
The application fetches data directly from GeckoTerminal API rather than using a backend service. This simplifies deployment and reduces latency for real-time data.

**CRITICAL**: GeckoTerminal chosen over Birdeye because:
- No API key authentication required
- Provides real OHLCV arrays, not simulated data
- Unlimited free access to professional-grade financial data
- Better data quality for technical analysis

### 3. Client-Side Optimization
All trading strategy optimization runs in the browser using JavaScript. This provides immediate feedback and doesn't require server resources.

### 4. Component Library Strategy
Uses shadcn/ui as the primary component library, which provides:
- Consistent design system
- Accessibility features built-in
- Customizable components
- TypeScript support out of the box

## Development Philosophy

The project prioritizes:
1. **Data Authenticity**: Real OHLCV data over convenience features
2. **Performance**: Efficient chart rendering and data processing
3. **User Experience**: Real-time feedback and intuitive controls
4. **Type Safety**: Comprehensive TypeScript coverage
5. **Maintainability**: Clear component structure and documentation
6. **Extensibility**: Easy to add new technical indicators or optimization algorithms

## ⚠️ CRITICAL FAILURE MODES IDENTIFIED

1. **API Data Quality Assumption**: Never assume API provides real data without verification.
    - **LESSON**: Birdeye API provided simulated OHLCV, breaking analysis. GeckoTerminal provides real data.
2. **Silent Technical Analysis Degradation**: Simulated OHLC breaks indicators without obvious errors.
3. **Volume Data Availability**: Many price APIs don't include volume - verify before implementing volume-based features.
4. **Authentication Complexity vs Data Quality**: Free APIs with real data often superior to paid APIs with limited free tiers.
5. **Exceeding API Data Point Limits**: Requesting too many data points (e.g., >1000 from GeckoTerminal OHLCV) leads to `400 Bad Request`.
    - **AVOIDANCE**: Dynamically calculate and cap request limits. See `lib/api-service.ts` (`MAX_API_LIMIT`) & `lib/chart-config.ts` (`calculateOptimalLimit`).
6. **Duplicate Timestamps from API**: API might return entries with identical timestamps, causing chart library errors.
    - **AVOIDANCE**: Filter out duplicate timestamps after fetching and sorting data. See `.filter()` logic in `lib/api-service.ts`.
7. **NEW: Cache Key Granularity for Timeframe Switching**: Different intervals calculate different `limit` values for same historical range, causing cache misses when switching timeframes.
    - **FIXED**: Implemented flexible cache matching in `hooks/use-ohlcv-cache.ts` - searches for any cache entry with sufficient data points if exact match fails.
    - **IMPACT**: Dramatically reduces API calls when switching between timeframes while viewing same historical range.

This application serves as both a practical tool for cryptocurrency analysis and a demonstration of modern React development practices with advanced charting capabilities using **verified authentic, deduplicated, and API-limit-aware financial data**.