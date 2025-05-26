# Optimization Algorithms

## Overview

The application implements sophisticated parameter optimization using hill climbing algorithms to find optimal trading strategy parameters. The optimization system is designed for real-time feedback with visual updates during the search process.

## Hill Climbing Algorithm

⚠️ **CRITICAL**: Implementation extracted to `hooks/use-optimization.ts` to prevent infinite re-renders in main component.

### Core Algorithm Structure

🚨 **DEPENDENCY ISOLATION PATTERN**:
```typescript
// ❌ BROKEN - Causes infinite loops:
const runOneHillClimb = useCallback(() => {...}, [bestParams, onParametersUpdate])

// ✅ FIXED - Minimal dependencies:
const runOneHillClimb = useCallback(() => {
  // Uses closure to access current state without dependencies
}, [ohlcvData]) // Only essential data dependency
```

#### **Single Hill Climb Implementation**
```typescript
function runOneHillClimb() {
  const maxIterations = 300;
  const stepSizes = { rsi: 5, cv: 5 };
  const bounds = {
    buyRsi:  { min: 0,   max: 100 },
    buyCv:   { min: -50, max: 0   },
    sellRsi: { min: 0,   max: 100 },
    sellCv:  { min: 0,   max: 400 },
  };

  // Start from random position
  let current = { ...randomParams(), maxProfit: -Infinity, numTrades: 0 };

  // Evaluate initial position
  const initialResult = updateChartWithParameters(
    current.buyRsi, current.buyCv, current.sellRsi, current.sellCv
  );
  if (initialResult) {
    current.maxProfit = initialResult.profit;
    current.numTrades = initialResult.numTrades;
  }

  // Hill climbing loop
  for (let iter = 0; iter < maxIterations; iter++) {
    const candidate = randomNeighbor(current);
    
    const result = updateChartWithParameters(
      candidate.buyRsi, candidate.buyCv, candidate.sellRsi, candidate.sellCv
    );
    
    if (!result) continue;

    // Accept if better profit with minimum trades
    if (result.profit > current.maxProfit && result.numTrades >= 3) {
      current = {
        buyRsi: candidate.buyRsi,
        buyCv: candidate.buyCv,
        sellRsi: candidate.sellRsi,
        sellCv: candidate.sellCv,
        maxProfit: result.profit,
        numTrades: result.numTrades
      };
    }
  }
  
  return current;
}
```

### Algorithm Components

#### **1. Random Parameter Generation**
```typescript
function randomParams() {
  return {
    buyRsi: randInt(bounds.buyRsi.min, bounds.buyRsi.max),
    buyCv: randInt(bounds.buyCv.min, bounds.buyCv.max),
    sellRsi: randInt(bounds.sellRsi.min, bounds.sellRsi.max),
    sellCv: randInt(bounds.sellCv.min, bounds.sellCv.max),
  };
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

#### **2. Neighbor Generation**
```typescript
function randomNeighbor(params: OptimizationParams) {
  const neighbor = { ...params };
  const paramKeys = ["buyRsi", "buyCv", "sellRsi", "sellCv"] as const;
  const chosenKey = paramKeys[Math.floor(Math.random() * paramKeys.length)];

  const delta = Math.random() < 0.5 ? -stepSizes.rsi : stepSizes.rsi;
  const cvDelta = Math.random() < 0.5 ? -stepSizes.cv : stepSizes.cv;

  if (chosenKey === "buyRsi" || chosenKey === "sellRsi") {
    neighbor[chosenKey] = clamp(neighbor[chosenKey] + delta, bounds[chosenKey].min, bounds[chosenKey].max);
  } else {
    neighbor[chosenKey] = clamp(neighbor[chosenKey] + cvDelta, bounds[chosenKey].min, bounds[chosenKey].max);
  }
  
  return neighbor;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(val, max));
}
```

#### **3. Parameter Bounds System**
```typescript
interface ParameterBounds {
  buyRsi:  { min: number; max: number };
  buyCv:   { min: number; max: number };
  sellRsi: { min: number; max: number };
  sellCv:  { min: number; max: number };
}

const bounds: ParameterBounds = {
  buyRsi:  { min: 0,   max: 100 },  // RSI percentage range
  buyCv:   { min: -50, max: 0   },  // Negative CV for low volatility
  sellRsi: { min: 0,   max: 100 },  // RSI percentage range
  sellCv:  { min: 0,   max: 400 },  // Positive CV for high volatility
};
```

## Multi-Restart Hill Climbing

### Time-Based Optimization
```typescript
async function runHillClimbForFiveSeconds() {
  setIsOptimizing(true);
  const startTime = Date.now();
  let localBest = { ...bestParams };

  try {
    while (Date.now() - startTime < 5000) {
      const attempt = runOneHillClimb();
      
      if (attempt.maxProfit > localBest.maxProfit) {
        localBest = attempt;
        setBestParams(localBest);
        
        // Update UI parameters
        setBuyRsiThreshold(localBest.buyRsi);
        setBuyCvThreshold(localBest.buyCv);
        setSellRsiThreshold(localBest.sellRsi);
        setSellCvThreshold(localBest.sellCv);

        // Update chart visualization
        updateChartWithParameters(
          localBest.buyRsi,
          localBest.buyCv,
          localBest.sellRsi,
          localBest.sellCv
        );
      }
      
      // Animation delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Final parameter application
    if (localBest.maxProfit > -Infinity) {
      applyFinalParameters(localBest);
      updateHighestProfitRecord(localBest);
    }
  } finally {
    setIsOptimizing(false);
  }
}
```

### Advantages of Multiple Restarts
1. **Escape Local Optima**: Each restart explores different regions
2. **Diverse Search**: Random starting points increase coverage
3. **Robustness**: Multiple attempts reduce dependency on initial conditions
4. **Time-Bounded**: Fixed 5-second runtime prevents excessive computation

## ⚠️ FAILURE PREVENTION PATTERNS

### Common Pitfalls Resolved
1. **Hook Dependency Loops**: Minimized hook dependencies to primitive values only
2. **State Update Cascades**: Isolated optimization state from component rendering
3. **Parameter Feedback**: Ensured parameter updates don't trigger hook recreation
4. **Memory Leaks**: Proper cleanup in hook useEffect return functions

### Debugging Detection Pattern
```typescript
// Add to hook for infinite loop detection:
const renderCount = useRef(0)
renderCount.current++
if (renderCount.current > 100) {
  console.error('Potential infinite loop in optimization hook')
}
```

## 🚨 CRITICAL DEBUGGING INSIGHTS

### Hook State Management Issue
**Location**: `hooks/use-optimization.ts`
**Root Cause**: Hook was causing parent component infinite re-renders
**Solution**: Memoized configuration object to break dependency chains

```typescript
// ❌ BROKEN - Parent component pattern:
const optimization = useOptimization({ ohlcvData, onParametersUpdate })

// ✅ FIXED - Parent component pattern:
const optimizationConfig = useMemo(() => ({
  ohlcvData,
  onParametersUpdate: setParameters
}), [ohlcvData]) // Only data dependency

const optimization = useOptimization(optimizationConfig)
```

### State Update Isolation Pattern
**Critical Insight**: Internal optimization state changes must be isolated from parent component lifecycle
**Impact**: Prevents cascade re-renders during 5-second optimization runs
**Implementation**: Hook manages internal state without recreating itself

## Performance Evaluation

### Objective Function
```typescript
function evaluateParameters(buyRsi: number, buyCv: number, sellRsi: number, sellCv: number) {
  const result = updateChartWithParameters(buyRsi, buyCv, sellRsi, sellCv);
  
  if (!result || result.numTrades < 3) {
    return { profit: -Infinity, numTrades: 0 };
  }
  
  return {
    profit: result.profit,
    numTrades: result.numTrades
  };
}
```

### Acceptance Criteria
```typescript
const isImprovement = (candidate: OptimizationResult, current: OptimizationResult) => {
  // Primary criterion: higher profit
  if (candidate.profit > current.maxProfit) {
    // Secondary criterion: minimum trade count
    if (candidate.numTrades >= 3) {
      return true;
    }
  }
  return false;
};
```

### Constraint Handling
- **Minimum Trades**: Requires at least 3 completed trades for validity
- **Parameter Bounds**: Hard constraints enforced during neighbor generation
- **Profit Threshold**: Negative profits are accepted if they represent improvement

## Real-Time Visualization

### Parameter Animation System
```typescript
// State management for optimization display
const [testParams, setTestParams] = useState({
  buyRsi: buyRsiThreshold,
  buyCv: buyCvThreshold,
  sellRsi: sellRsiThreshold,
  sellCv: sellCvThreshold
});

// Update UI during optimization
const updateTestParameters = (params: OptimizationParams) => {
  setTestParams({
    buyRsi: params.buyRsi,
    buyCv: params.buyCv,
    sellRsi: params.sellRsi,
    sellCv: params.sellCv
  });
};
```

### UI Integration
```typescript
// Slider value binding during optimization
<input
  type="range"
  min="0"
  max="100"
  value={isOptimizing ? testParams.buyRsi : buyRsiThreshold}
  onChange={(e) => setBuyRsiThreshold(Number(e.target.value))}
  disabled={isOptimizing}
/>

// Display current vs best parameters
<div className="text-sm text-right">
  {isOptimizing ? (
    <span>
      Testing: {testParams.buyRsi} 
      {bestParams.buyRsi !== buyRsiThreshold && 
        ` (Best: ${bestParams.buyRsi})`}
    </span>
  ) : (
    buyRsiThreshold
  )}
</div>
```

## Advanced Optimization Features

### Best Parameter Tracking
```typescript
interface BestParameterState {
  buyRsi: number;
  buyCv: number;
  sellRsi: number;
  sellCv: number;
  maxProfit: number;
  numTrades: number;
}

const [bestParams, setBestParams] = useState<BestParameterState>({
  buyRsi: 40,
  buyCv: -19.9,
  sellRsi: 72,
  sellCv: 65,
  maxProfit: -Infinity,
  numTrades: 0
});
```

### Historical Best Tracking
```typescript
const [highestProfit, setHighestProfit] = useState({
  profit: -Infinity,
  params: {
    buyRsi: 40,
    buyCv: -19.9,
    sellRsi: 72,
    sellCv: 65
  }
});

const updateHighestProfitRecord = (newResult: OptimizationResult) => {
  if (newResult.maxProfit > highestProfit.profit) {
    setHighestProfit({
      profit: newResult.maxProfit,
      params: {
        buyRsi: newResult.buyRsi,
        buyCv: newResult.buyCv,
        sellRsi: newResult.sellRsi,
        sellCv: newResult.sellCv
      }
    });
  }
};
```

### Parameter Reset System
```typescript
const resetParameters = () => {
  // Reset to default values when changing pools
  setBuyRsiThreshold(40);
  setBuyCvThreshold(-19.9);
  setSellRsiThreshold(72);
  setSellCvThreshold(65);
  
  setBestParams({
    buyRsi: 40,
    buyCv: -19.9,
    sellRsi: 72,
    sellCv: 65,
    maxProfit: -Infinity,
    numTrades: 0
  });
  
  setHighestProfit({
    profit: -Infinity,
    params: { buyRsi: 40, buyCv: -19.9, sellRsi: 72, sellCv: 65 }
  });
};
```

## Optimization Configuration

### Tunable Parameters
```typescript
const optimizationConfig = {
  maxIterations: 300,        // Iterations per hill climb
  timeLimit: 5000,          // 5 seconds total optimization time
  animationDelay: 50,       // Milliseconds between visual updates
  stepSizes: {
    rsi: 5,                 // RSI parameter step size
    cv: 5                   // CV parameter step size
  },
  constraints: {
    minTrades: 3,           // Minimum required trades
    maxProfit: Infinity     // No upper profit limit
  }
};
```

### Performance Monitoring
```typescript
interface OptimizationMetrics {
  totalAttempts: number;
  improvements: number;
  bestProfit: number;
  searchDuration: number;
  convergenceRate: number;
}
```

## Future Enhancement Opportunities

### Algorithm Improvements
1. **Simulated Annealing**: Add temperature-based acceptance probability
2. **Genetic Algorithm**: Population-based search with crossover and mutation
3. **Gradient Descent**: Numerical gradient estimation for smoother optimization
4. **Adaptive Step Sizes**: Dynamic step size adjustment based on progress

### Search Space Enhancements
1. **Multi-Objective Optimization**: Balance profit vs. risk metrics
2. **Constraint Programming**: Advanced constraint handling
3. **Bayesian Optimization**: Probabilistic model of objective function
4. **Parallel Search**: Multiple concurrent optimization threads

This optimization system provides a robust foundation for automated trading strategy parameter tuning with real-time visual feedback and comprehensive performance tracking.