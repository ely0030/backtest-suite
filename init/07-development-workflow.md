# Development Workflow

## Development Environment Setup

### Prerequisites
- Node.js 18+ (using `v18.17.0` based on project setup)
- npm or yarn package manager
- Modern web browser for testing
- Code editor with TypeScript support

### Initial Setup
```bash
# Clone or navigate to project directory
cd crypto-chart

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Server
```bash
npm run dev
```
- Runs on `localhost:3000`
- Hot reload enabled for all changes
- TypeScript compilation in watch mode
- Fast refresh for React components

## Available Scripts

### Core Development Commands
```bash
# Development
npm run dev          # Start development server with hot reload

# Production Build
npm run build        # Create optimized production build
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint for code quality checks
```

### Build Configuration
- **Development**: Optimized for speed and debugging
- **Production**: Minified, optimized for performance
- **Build Errors**: TypeScript and ESLint errors are ignored during builds for rapid prototyping

## Development Configuration

### Next.js Configuration (`next.config.mjs`)
```javascript
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,  // Skip ESLint during builds
  },
  typescript: {
    ignoreBuildErrors: true,   // Skip TypeScript errors during builds
  },
  images: {
    unoptimized: true,        // Disable image optimization
  },
  experimental: {
    webpackBuildWorker: true,           // Parallel webpack builds
    parallelServerBuildTraces: true,    // Faster server builds
    parallelServerCompiles: true,       // Parallel compilation
  },
}
```

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES6",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]  // Path alias for clean imports
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

## File Organization Best Practices

### Project Structure
```
crypto-chart/
├── app/                     # Next.js App Router
│   ├── globals.css         # Global styles and CSS variables
│   ├── layout.tsx          # Root layout component
│   └── page.tsx            # Home page component
├── components/             # React components
│   ├── ui/                 # Reusable UI components (shadcn/ui)
│   ├── chart-container.tsx # Main chart component
│   └── theme-provider.tsx  # Theme management
├── lib/                    # Utility functions
│   ├── data.ts            # Data management utilities
│   └── utils.ts           # General utilities (cn function)
├── types/                  # TypeScript type definitions
│   └── chart.ts           # Chart-related types
├── hooks/                  # Custom React hooks
│   ├── use-mobile.tsx     # Mobile detection hook
│   └── use-toast.ts       # Toast notification hook
├── styles/                 # Additional styles
│   └── globals.css        # Alternative global styles location
├── public/                 # Static assets
└── init/                   # Documentation (this folder)
```

### Import Conventions
```typescript
// External libraries first
import React from 'react'
import { useState, useEffect } from 'react'

// Internal utilities and types
import { cn } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/chart'

// UI components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Local components
import { ChartContainer } from '@/components/chart-container'
```

## Code Quality Standards

### TypeScript Best Practices
```typescript
// Explicit type definitions
interface ComponentProps {
  data: ChartDataPoint[]
  onUpdate?: (value: number) => void
}

// Proper error handling
const fetchData = async (): Promise<ChartData[]> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}

// Type-safe event handlers
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  // Handle form submission
}
```

### Component Patterns
```typescript
// Preferred component structure
interface ComponentProps {
  // Props interface
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // State declarations
  const [state, setState] = useState<Type>(initialValue)
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies])
  
  // Event handlers
  const handleEvent = useCallback(() => {
    // Handler logic
  }, [dependencies])
  
  // Early returns for loading/error states
  if (loading) return <LoadingComponent />
  if (error) return <ErrorComponent />
  
  // Main render
  return (
    <div className="component-container">
      {/* Component JSX */}
    </div>
  )
}
```

## Performance Optimization

### Chart Performance
```typescript
// Use refs for direct chart manipulation
const chartRef = useRef<IChartApi | null>(null)
const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (seriesRef.current) {
      chartRef.current?.removeSeries(seriesRef.current)
    }
    if (chartRef.current) {
      chartRef.current.remove()
    }
  }
}, [])

// Efficient data updates
const updateChartData = useCallback((newData: ChartData[]) => {
  if (seriesRef.current) {
    seriesRef.current.setData(newData)
  }
}, [])
```

### State Management Optimization
```typescript
// Separate concerns with multiple useState
const [chartData, setChartData] = useState<ChartData[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

// Use useCallback for expensive calculations
const calculateSignals = useCallback((data: ChartData[], params: Parameters) => {
  // Expensive signal calculation
  return processedSignals
}, []) // Dependencies based on what changes

// Memoize expensive computations
const memoizedAnalytics = useMemo(() => {
  return calculateAnalytics(trades, portfolioValue)
}, [trades, portfolioValue])
```

## Testing Strategy

### Component Testing Approach
```typescript
// Test structure (when implementing tests)
describe('ChartContainer', () => {
  it('should render chart with data', () => {
    // Test implementation
  })
  
  it('should handle parameter changes', () => {
    // Test parameter updates
  })
  
  it('should optimize parameters correctly', () => {
    // Test optimization logic
  })
})
```

### Manual Testing Checklist
- [ ] Chart renders correctly with sample data
- [ ] Parameter sliders update chart in real-time
- [ ] Pool address search functionality works
- [ ] Timeframe switching updates data correctly
- [ ] Optimization algorithm completes successfully
- [ ] Trade analytics display accurate information
- [ ] Responsive design works on different screen sizes
- [ ] Error states display appropriately

## Debugging Workflow

### Development Tools
```typescript
// Console logging for debugging
console.log("Raw OHLCV data:", data.data.attributes.ohlcv_list)
console.log("Transformed data:", transformedData)
console.log("Signal generation:", { signals, trades })

// Performance monitoring
console.time('optimization')
const result = runOptimization()
console.timeEnd('optimization')
```

### Common Debugging Scenarios
1. **Chart not rendering**: Check data format and chart container ref
2. **API errors**: Verify pool address and network connectivity
3. **Parameter optimization issues**: Check bounds and step sizes
4. **Performance problems**: Profile optimization loops and data processing

### Browser Developer Tools
- **Network Tab**: Monitor API requests and responses
- **Console**: Check for JavaScript errors and debug logs
- **React DevTools**: Inspect component state and props
- **Performance Tab**: Profile optimization algorithms

## Hot Reload and Fast Development

### File Change Detection
- **Component changes**: Immediate hot reload
- **Style changes**: Instant CSS updates
- **Type changes**: Fast TypeScript recompilation
- **Configuration changes**: May require server restart

### Development Efficiency Tips
```typescript
// Use optional chaining for safety
const tokenSymbol = poolData?.data?.attributes?.base_token_symbol

// Implement proper loading states
if (loading) return <Skeleton className="w-full h-[500px]" />

// Use TypeScript for better autocomplete
const handleParameterChange = (
  parameter: 'buyRsi' | 'buyCv' | 'sellRsi' | 'sellCv',
  value: number
) => {
  // Type-safe parameter handling
}
```

## Deployment Considerations

### Build Process
```bash
# Production build
npm run build

# Verify build output
npm run start
```

### Environment Configuration
```typescript
// Environment variables (if needed)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geckoterminal.com'
```

### Performance Monitoring
- Bundle size analysis
- Runtime performance metrics
- API response times
- Chart rendering performance

## Collaboration Workflow

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-indicator
git add .
git commit -m "Add new technical indicator"
git push origin feature/new-indicator

# Code review process
# Create pull request
# Review and merge
```

### Code Review Checklist
- [ ] TypeScript types are properly defined
- [ ] Components follow established patterns
- [ ] Performance considerations addressed
- [ ] Error handling implemented
- [ ] Styling follows design system
- [ ] Documentation updated if needed

This development workflow ensures efficient, maintainable, and high-quality development of the cryptocurrency charting application.