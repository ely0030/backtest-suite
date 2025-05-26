# UI Features Reference

## Overview

The crypto-chart application includes several advanced UI features that enhance user experience through intelligent search, persistent history, responsive design, and visual feedback systems. These features work together to create a production-ready trading interface.

## Pool Search Interface

### Real-Time Pool Search (`components/chart-container.tsx:627-721`)

**Purpose**: Enable users to discover and select trading pools through real-time search with autocomplete suggestions.

**Key Features**:
- **Debounced search**: 500ms delay prevents excessive API calls
- **Autocomplete dropdown**: Live search results with detailed pool information
- **Keyboard navigation**: Escape key clears search, arrow keys navigate results
- **Loading indicators**: Spinner animation during search requests
- **Result formatting**: Pool symbols, DEX information, volume, and price changes

**Implementation Details**:
```typescript
// Search input with popover suggestions
<Popover open={shouldShowSearch} onOpenChange={setSearchOpen}>
  <PopoverTrigger asChild>
    <input
      value={searchQuery || tokenAddress}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search by token name (e.g., SOL, USDC) or enter pool address..."
      onKeyDown={(e) => {
        if (e.key === 'Escape') clearSearch()
      }}
    />
  </PopoverTrigger>
  <PopoverContent>
    <Command>
      <CommandList>
        {searchResults.map((result) => (
          <CommandItem onSelect={() => selectPool(result)}>
            {/* Pool details display */}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

**Search Result Display**:
- **Primary info**: `{baseSymbol}/{quoteSymbol}` pair name
- **Secondary info**: DEX name and 24h volume
- **Address preview**: Truncated pool address (`{address.slice(0,8)}...{address.slice(-8)}`)
- **Price change**: Color-coded percentage change (green/red)

**User Interaction Flow**:
1. User types in search input (minimum 2 characters)
2. 500ms debounce timer triggers search
3. Results display in dropdown with full pool details
4. User clicks result → pool selected, search cleared
5. Chart data automatically fetches for selected pool

---

## Pool History Management

### Recent Pools Dropdown (`components/chart-container.tsx:725-797`)

**Purpose**: Provide quick access to recently viewed pools with persistent storage.

**Key Features**:
- **Badge indicator**: Shows count of history items on history button
- **Timestamp tracking**: "X minutes/hours/days ago" relative time display
- **Individual removal**: X button on hover for each history item
- **Bulk clear**: "Clear All" action in dropdown header
- **Automatic sorting**: Most recently visited pools appear first
- **Size limiting**: Maximum 10 history items maintained

**Implementation Details**:
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="icon">
      <History className="h-4 w-4" />
      {history.length > 0 && (
        <span className="absolute -top-1 -right-1 bg-primary rounded-full">
          {history.length}
        </span>
      )}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {history.map((item) => (
      <DropdownMenuItem onClick={() => selectPool(item)}>
        <div>
          <span>{item.baseSymbol}/{item.quoteSymbol}</span>
          <span>{formatTimeAgo(item.lastVisited)}</span>
        </div>
        <Button onClick={removeFromHistory}>×</Button>
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

**History Item Information**:
- **Pool pair**: `{baseSymbol}/{quoteSymbol}` display
- **Address preview**: Truncated pool address
- **Last visited**: Relative timestamp with tooltip showing exact time
- **Remove action**: Individual item deletion on hover

**Persistence Features**:
- **localStorage integration**: History survives browser restarts
- **Race condition prevention**: `isLoaded` flag prevents data loss
- **Automatic deduplication**: Visiting existing pool updates timestamp instead of duplicating

---

## Historical Data Range Selection

### Time Range Controls (`components/chart-container.tsx:478-531`)

**Purpose**: Allow users to select different historical data periods with API limit awareness.

**Configuration Options** (from `HISTORICAL_RANGES`):
- **1w**: 1 Week (7 days)
- **1m**: 1 Month (30 days)
- **3m**: 3 Months (90 days)
- **6m**: 6 Months (180 days)
- **max**: Maximum available data

**Implementation Details**:
```typescript
{/* Historical Range Selector */}
<ButtonGroup variant="outline" size="sm">
  {Object.entries(HISTORICAL_RANGES).map(([key, range]) => (
    <Button
      key={key}
      variant={historicalRange === key ? "default" : "outline"}
      onClick={() => setHistoricalRange(key)}
    >
      {range.label}
    </Button>
  ))}
</ButtonGroup>

{/* API Limit Warning */}
{historicalRange !== "max" && 
 HISTORICAL_RANGES[historicalRange].days > getMaxRecommendedDays(interval) && (
  <div className="text-yellow-600 text-xs">
    ⚠️ Selected range may hit API limits for {interval} intervals
  </div>
)}
```

**Smart Limit Calculation**:
- **Dynamic limits**: Adjusts data points based on interval and desired timeframe
- **API constraint awareness**: Respects GeckoTerminal's 1000 point maximum
- **Warning system**: Alerts users when selections may hit API limits

**Range-Interval Compatibility**:
- **1m interval**: Effectively limited to ~7 days (1000 minutes)
- **5m interval**: Up to ~35 days practical limit
- **1h interval**: Up to ~42 days for 1000 hours
- **1d interval**: Full 1000 days available

---

## Data Source Visual Feedback

### Status Pills (`components/chart-container.tsx:658-673`)

**Purpose**: Provide real-time feedback about data source and loading status.

**Pill Types**:
- **🌐 API Call** (blue): Fresh data fetched from GeckoTerminal
- **📦 Using Cached Data** (green): Data served from localStorage cache
- **⚠️ Error** (red): Failed to load data
- **Loading...** (gray): Data fetch in progress

**Implementation Details**:
```typescript
{dataLoadSource && (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
    dataLoadSource === 'API' ? 'bg-blue-100 text-blue-700' :
    dataLoadSource === 'Cache' ? 'bg-green-100 text-green-700' :
    dataLoadSource === 'Error' ? 'bg-red-100 text-red-700' :
    'bg-gray-100 text-gray-700'
  }`}>
    {dataLoadSource === 'API' && '🌐 API Call'}
    {dataLoadSource === 'Cache' && '📦 Using Cached Data'}
    {dataLoadSource === 'Error' && '⚠️ Error'}
  </span>
)}
```

**Timing Behavior**:
- **Display duration**: 2 seconds after data load completion
- **Auto-clear**: `setTimeout(() => setDataLoadSource(null), 2000)`
- **State management**: Single `dataLoadSource` state controls display

**Integration with Cache System**:
- **Cache hits**: Show green "📦 Using Cached Data" pill
- **API calls**: Show blue "🌐 API Call" pill  
- **Errors**: Show red "⚠️ Error" pill
- **Loading**: Show gray "Loading..." pill during fetch

---

## Rate Limit Monitoring UI

### API Usage Indicators (`components/chart-container.tsx:585-625`)

**Purpose**: Display real-time API usage statistics with color-coded status indicators.

**Visual Components**:
- **Status pill**: Color-coded indicator next to cache statistics
- **Usage counter**: "📡 X API calls" with current daily count
- **Detailed tooltip**: Comprehensive breakdown of usage across time periods

**Implementation Details**:
```typescript
{/* Rate Limit Monitor */}
<Tooltip>
  <TooltipTrigger>
    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
      rateLimitMonitor.getRateLimitStatus().status === 'safe' ? 'bg-green-100 text-green-700' :
      rateLimitMonitor.getRateLimitStatus().status === 'warning' ? 'bg-orange-100 text-orange-700' : 
      'bg-red-100 text-red-700'
    }`}>
      📡 {rateLimitMonitor.stats.callsToday} API calls
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <div>
      <p><strong>GeckoTerminal API Usage:</strong></p>
      <p>• Last minute: {rateLimitMonitor.stats.callsLast1Min}/30</p>
      <p>• Last 5 minutes: {rateLimitMonitor.stats.callsLast5Min}/100</p>
      <p>• Last hour: {rateLimitMonitor.stats.callsLast1Hour}/1000</p>
      <p>• Today: {rateLimitMonitor.stats.callsToday}/10000</p>
      <div className="mt-2 pt-2 border-t">
        <p><strong>Cache Savings:</strong></p>
        <p>• API calls avoided: {rateLimitMonitor.stats.estimatedSavings}</p>
        <p>• Cache hit rate: {rateLimitMonitor.stats.cacheHitRate}%</p>
      </div>
    </div>
  </TooltipContent>
</Tooltip>
```

**Color Coding System**:
- **Green (Safe)**: < 50 calls/day, < 20 calls/hour
- **Orange (Warning)**: 50-90 calls/day, 20-35 calls/hour
- **Red (Danger)**: > 90 calls/day, > 35 calls/hour

**Tooltip Information**:
- **Multi-period tracking**: 1min, 5min, 1hour, 1day windows
- **Cache efficiency**: Shows API calls saved and hit rate percentage
- **Estimated savings**: Projected request reduction per minute

---

## Mobile Responsive Features

### Responsive Design (`hooks/use-mobile.tsx`)

**Purpose**: Adapt UI layout and interactions for mobile devices.

**Breakpoint Configuration**:
- **Mobile threshold**: 768px viewport width
- **Detection method**: `window.matchMedia` for performance
- **SSR safety**: Handles undefined initial state gracefully

**Implementation Pattern**:
```typescript
const isMobile = useIsMobile()

// Conditional rendering based on screen size
{isMobile ? (
  <MobileLayout />
) : (
  <DesktopLayout />
)}

// Responsive styling
className={`${isMobile ? 'flex-col' : 'flex-row'} gap-4`}
```

**Mobile-Specific Adaptations**:
- **Touch-friendly controls**: Larger touch targets for mobile
- **Simplified layouts**: Reduced complexity on smaller screens
- **Optimized performance**: Reduced chart complexity for mobile devices

---

## Chart Interaction Features

### Interactive Elements

**Tooltip System**:
- **Crosshair tooltips**: Real-time price and timestamp display
- **Signal markers**: Buy/sell signal information on hover
- **Parameter tooltips**: Detailed explanations for trading parameters

**Chart Controls**:
- **Zoom and pan**: Touch and mouse interaction support
- **Time scale fitting**: Automatic data fitting on load
- **Marker visibility**: Toggle between all signals and trade pairs only

**Keyboard Shortcuts**:
- **Escape**: Clear search and close dropdowns
- **Enter**: Submit search form
- **Arrow keys**: Navigate search results (when implemented)

---

## Form Controls and Parameter Adjustment

### Trading Parameter Sliders

**Real-time Adjustment**:
- **Range sliders**: For RSI and Chaikin Volatility thresholds
- **Live updates**: Parameters update chart signals immediately
- **Bounds enforcement**: Values constrained to valid ranges
- **Visual feedback**: Current values displayed with optimal values during optimization

**Parameter Display**:
- **Current values**: Real-time parameter display
- **Optimization hints**: Show optimal values found during hill climbing
- **Bounds indication**: Visual indication of parameter limits

---

## Performance Considerations

### UI Optimization Strategies

**Debouncing and Throttling**:
- **Search debouncing**: 500ms delay prevents excessive API calls
- **Parameter updates**: Immediate UI feedback with batched calculations
- **History persistence**: Delayed saves prevent localStorage thrashing

**Memory Management**:
- **Event listener cleanup**: Proper cleanup in mobile detection
- **Component unmounting**: Chart cleanup prevents memory leaks
- **Cache management**: Automatic cleanup when storage limits approached

**Loading State Management**:
- **Progressive loading**: Show cached data immediately while fetching fresh token info
- **Skeleton screens**: Loading placeholders maintain layout stability
- **Error boundaries**: Graceful handling of component failures

This comprehensive UI feature set provides a professional trading interface with intelligent automation, persistent user preferences, and responsive design patterns suitable for both desktop and mobile use.