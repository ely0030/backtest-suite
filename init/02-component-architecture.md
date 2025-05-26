# Component Architecture

## Main Application Components

### ChartContainer (`/components/chart-container.tsx`)

This is the core component that handles all charting functionality, data fetching, and trading strategy implementation.

#### **Key Responsibilities**
- Fetches OHLCV data from GeckoTerminal API
- **NEW**: Implements localStorage-based caching for OHLCV data via `useOHLCVCache` hook to reduce API calls.
- Renders interactive candlestick charts using lightweight-charts
- Implements technical analysis calculations (RSI, Chaikin Volatility)
- Generates buy/sell trading signals
- Runs parameter optimization algorithms
- Manages trade analytics and performance tracking

#### **State Management**
```typescript
// Chart data and loading states
const [ohlcvData, setOhlcvData] = useState<ChartData[] | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [dataLoadSource, setDataLoadSource] = useState<string | null>(null) // NEW: Visual feedback system

// Trading strategy parameters
const [buyRsiThreshold, setBuyRsiThreshold] = useState(40)
const [buyCvThreshold, setBuyCvThreshold] = useState(-19.9)
const [sellRsiThreshold, setSellRsiThreshold] = useState(72)
const [sellCvThreshold, setSellCvThreshold] = useState(65)

// Optimization tracking
const [isOptimizing, setIsOptimizing] = useState(false)
const [testParams, setTestParams] = useState({...})
const [bestParams, setBestParams] = useState({...})
const [highestProfit, setHighestProfit] = useState({...})

// Analytics and UI
const [tradeAnalytics, setTradeAnalytics] = useState({...})
const [tokenPair, setTokenPair] = useState({base: '', quote: ''})
const [showAllSignals, setShowAllSignals] = useState(false)

// Historical data range selection
const [historicalRange, setHistoricalRange] = useState<string>("1w") // Default to 1 week
```

#### **Key Functions**

**Data Fetching** (⚠️ Dependencies carefully managed)
```typescript
const fetchData = useCallback(async () => {
  // 0. NEW: Set dataLoadSource state (e.g., 'Loading...')
  // 1. Calculate `customLimit` based on `historicalRange` and `interval`.
  // 2. NEW: Attempt to load data from OHLCV cache (`useOHLCVCache` -> `getFromCache`).
  //    - Cache Key: { poolAddress, interval, limit }
  //    - If cache hit & valid: Use cached data. Fetch fresh `tokenInfo`. Set dataLoadSource to 'Cache'.
  // 3. If cache miss or invalid: Fetch `tokenInfo` and `ohlcvData` from `APIService.fetchChartDataWithLimit`.
  //    - Set dataLoadSource to 'API'.
  //    - NEW: Save fetched `ohlcvData` to cache (`saveToCache`).
  // 4. Transform and validate data.
  // 5. NEW: Clear dataLoadSource state after a brief delay.
}, [poolAddress, interval, historicalRange, addToHistory, getFromCache, saveToCache]) // CRITICAL: historicalRange, getFromCache, saveToCache dependencies added
```

**Technical Analysis**
```typescript
function calculateRSI(closes: number[], period = 14): number[]
function calculateChaikinVolatility(highs: number[], lows: number[], length = 10): number[]
```

**Signal Generation & Backtesting**
```typescript
function updateChartWithParameters(rsi: number, cvBuy: number, rsiSell: number, cvSell: number) {
  // 1. Calculate technical indicators
  // 2. Generate buy/sell signals based on thresholds
  // 3. Simulate trades and calculate profit
  // 4. Update chart markers
  // 5. Return performance metrics
}
```

**Optimization Algorithm**
```typescript
function runOneHillClimb(): OptimizationResult
async function runHillClimbForFiveSeconds(): Promise<void>
```

#### **Data Source Visual Feedback System**
**PURPOSE**: Provides real-time feedback to users about where chart data originated.

**STATE**: `dataLoadSource` state variable controls pill display
```typescript
const [dataLoadSource, setDataLoadSource] = useState<string | null>(null)
```

**VALUES**:
- `'API'` → Shows "🌐 API Call" (blue pill)
- `'Cache'` → Shows "📦 Using Cached Data" (green pill) 
- `'Error'` → Shows "⚠️ Error" (red pill)
- `null` → No pill displayed

**TIMING**: Pills appear immediately after data loads, auto-clear after 2 seconds

**EXACT IMPLEMENTATION**:
- `components/chart-container.tsx:658-673` - Pill rendering with conditional styling
- `components/chart-container.tsx:219,178` - State setting in `fetchData()`
- Auto-clear: `setTimeout(() => setDataLoadSource(null), 2000)`

**CRITICAL INSIGHT**: This visual feedback is essential for debugging cache behavior and verifying API usage optimization.

#### **Chart Management**
- Uses React refs for direct chart manipulation
- Handles chart creation, updates, and cleanup
- Manages tooltip functionality and crosshair interactions
- Responsive resizing with window listeners

#### **API Integration**
- Integrates with GeckoTerminal API for real-time data (max 1000 data points per request)
- **NEW**: OHLCV data is now cached in `localStorage` to minimize redundant API calls.
  - Cache implemented in `hooks/use-ohlcv-cache.ts`.
  - `ChartContainer` uses `useOHLCVCache` hook for `getFromCache` and `saveToCache` operations.
- Supports multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- Handles rate limiting and error states
- Data deduplication handled in `lib/api-service.ts`
- Caches pool information for performance

### ThemeProvider (`/components/theme-provider.tsx`)

Simple wrapper component for next-themes functionality.

```typescript
export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

## UI Component Library (`/components/ui/`)

### Component Categories

#### **1. Layout Components**
- **Card**: Main container with Header, Content, Footer sections
- **Sheet**: Slide-out panels
- **Sidebar**: Navigation component
- **Separator**: Visual dividers
- **Scroll Area**: Custom scrollable regions

#### **2. Form Components**
- **Button**: Primary action component with variants
- **Input**: Text input with validation styles
- **Label**: Form field labels
- **Checkbox**: Boolean input component
- **Radio Group**: Single selection from options
- **Select**: Dropdown selection component
- **Slider**: Range input component
- **Switch**: Toggle component
- **Textarea**: Multi-line text input

#### **3. Data Display**
- **Table**: Structured data display
- **Badge**: Status and category indicators
- **Avatar**: User profile images
- **Progress**: Loading and completion indicators
- **Chart**: Data visualization wrapper

#### **4. Feedback Components**
- **Alert**: Notification messages
- **Toast**: Temporary notifications
- **Skeleton**: Loading state placeholders
- **Tooltip**: Contextual information

#### **5. Navigation Components**
- **Tabs**: Content organization
- **Breadcrumb**: Navigation trail
- **Pagination**: Content navigation
- **Navigation Menu**: Site navigation
- **Menubar**: Application menu system

#### **6. Overlay Components**
- **Dialog**: Modal dialogs
- **Alert Dialog**: Confirmation dialogs
- **Popover**: Contextual overlays
- **Hover Card**: Preview cards
- **Context Menu**: Right-click menus
- **Dropdown Menu**: Action menus

### Component Architecture Patterns

#### **1. Variant System**
All components use Class Variance Authority (CVA) for consistent styling:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```

#### **2. Forward Refs Pattern**
All components properly forward refs for DOM access:

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

#### **3. Composition Pattern**
Complex components use composition for flexibility:

```typescript
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
)

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(...)
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(...)
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(...)
```

#### **4. Accessibility First**
All components built on Radix UI primitives include:
- ARIA attributes
- Keyboard navigation
- Focus management
- Screen reader support

## Custom Components

### ButtonGroup (`/components/ui/button-group.tsx`)
Custom component for grouping related buttons, used for timeframe selection in the chart.

## Component Relationships

```
App Layout (layout.tsx)
└── Page (page.tsx)
    └── ChartContainer
        ├── Card (container)
        ├── Button (timeframe selection)
        ├── ButtonGroup (timeframe buttons)
        ├── Alert (error states)
        ├── Skeleton (loading states)
        └── Various form controls (sliders, inputs)
```

## Performance Considerations

### 1. Chart Optimization
- Uses refs instead of state for chart instance management
- Cleanup functions prevent memory leaks
- **🚨 CRITICAL**: Separate useEffects for chart creation vs signal updates
- Efficient marker updates without full re-renders

### 2. State Management
- Separate state variables for different concerns
- **⚠️ DEPENDENCY ISOLATION**: useEffect dependencies carefully managed to prevent infinite loops
- Memoized trading signal calculations with useMemo
- Debounced updates for parameter changes

### 3. Component Rendering
- Conditional rendering for loading states
- **✅ IMPLEMENTED**: useMemo for expensive RSI/Chaikin Volatility calculations
- useCallback for stable event handlers
- Efficient event handler patterns

## 🔧 CRITICAL FIXES APPLIED

### Infinite Re-render Prevention
**Location**: `components/chart-container.tsx`
- Separated chart creation from signal updates into different useEffects
- Removed optimization hook from fetchData dependencies
- Memoized optimization configuration to prevent hook recreation
- **CRITICAL**: `fetchData` useCallback now includes `historicalRange`, `getFromCache`, `saveToCache` in its dependencies. The `useEffect` calling `fetchData` also includes `historicalRange`.

### Chart Stability Pattern
```typescript
// Chart creation - only on data changes
useEffect(() => { createChart() }, [ohlcvData])

// Signal updates - only on parameter changes  
useEffect(() => { updateMarkers() }, [tradingResults])
```

**Impact**: Eliminated chart flickering and 80k+ console errors

## NEW: Caching Architecture

### useOHLCVCache Hook (`/hooks/use-ohlcv-cache.ts`)
**Purpose**: Reduce redundant API calls by caching OHLCV data in localStorage.

**CRITICAL INSIGHT - Cache Key Granularity Problem**: 
- **FAILURE MODE**: Original cache used exact `poolAddress-interval-limit` matching
- **ROOT CAUSE**: Different timeframes calculate different `limit` values for same historical range (e.g., 1w of 15m = 672 points, 1w of 1h = 168 points)
- **IMPACT**: Switching timeframes always triggered API calls despite having usable cached data
- **SOLUTION**: Implemented flexible cache matching - if exact match fails, search for any cache entry with sufficient data points

**Key Features**:
- Time-based expiry per interval (1m: 5min, 5m: 15min, 15m: 30min, 1h: 60min, 4h: 4hr, 1d: 24hr)
- **FLEXIBLE CACHE MATCHING**: Falls back to any cache entry for same pool/interval with ≥ requested data points
- Cache key includes: poolAddress, interval, and data limit
- Automatic cleanup when localStorage quota exceeded
- **REDUNDANT ENTRY CLEANUP**: When saving larger datasets, removes smaller cache entries for same pool/interval
- Validates cached data has sufficient data points for request

**Critical Methods**:
- `getFromCache({ poolAddress, interval, limit })`: 
  1. Try exact cache key match first
  2. If miss, search all keys matching `poolAddress-interval-*` pattern
  3. Return first valid entry with ≥ limit data points, sliced to requested size
- `saveToCache({ poolAddress, interval, limit }, data)`: 
  1. Clean up smaller redundant entries before saving
  2. Store new entry with current timestamp
- Cache statistics tracked for debugging

**EXACT LOCATIONS OF FLEXIBLE MATCHING LOGIC**:
- `getFromCache()` lines 47-89: Flexible search implementation
- `saveToCache()` lines 108-127: Redundant entry cleanup
- Console logging distinguishes "Exact cache hit" vs "Flexible cache hit"

### useRateLimitMonitor Hook (`/hooks/use-rate-limit-monitor.ts`) 
**Purpose**: Track API usage patterns and cache efficiency to prevent hitting GeckoTerminal rate limits.

**CRITICAL LOCATION DEPENDENCY**: Rate limit recording MUST happen in component before API call, NOT inside API service methods (would count cache hits as API calls).

**Key Features**:
- Tracks API calls across multiple time periods (1min, 5min, 1hour, 1day)
- Calculates cache hit rates and estimated API calls saved
- Color-coded status indicators (Green/Orange/Red)
- Persists statistics in localStorage across sessions
- Provides detailed breakdown via tooltip

**Implementation**:
```typescript
// ✅ CORRECT - Record only actual API calls
rateLimitMonitor.recordApiCall('ohlcv-data', tokenAddress, interval)
const data = await APIService.fetchChartData(...)

// ❌ WRONG - Would count cache hits  
// Inside APIService: rateLimitRecorder.recordApiCall(...)
```

**Rate Limit Thresholds**:
- Safe: < 50 calls/day, < 20 calls/hour
- Warning: 50-90 calls/day, 20-35 calls/hour  
- Danger: > 90 calls/day, > 35 calls/hour

**EXACT INTEGRATION**: `components/chart-container.tsx:192` records API calls immediately before `APIService.fetchChartDataWithLimit()`

### usePoolHistory Hook (`/hooks/use-pool-history.ts`)
**CRITICAL FIX**: `isLoaded` flag prevents race condition where empty initial state overwrites stored history.
- Loads from localStorage on mount
- Only saves to localStorage AFTER initial load complete
- Maintains list of recently viewed pools (NOT OHLCV data)

This architecture provides a scalable foundation for adding new features while maintaining performance and code organization.