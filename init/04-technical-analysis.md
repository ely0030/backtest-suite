# Technical Analysis Implementation

## Overview

The application implements sophisticated technical analysis using two primary indicators: RSI (Relative Strength Index) and Chaikin Volatility. These indicators are combined to generate automated buy/sell signals for cryptocurrency trading strategies.

## Indicators Implemented

### 1. RSI (Relative Strength Index)

#### **Purpose**
RSI is a momentum oscillator that measures the speed and change of price movements. It oscillates between 0 and 100 and is typically used to identify overbought and oversold conditions.

#### **Mathematical Formula**
```
RSI = 100 - (100 / (1 + RS))
where RS = Average Gain / Average Loss
```

#### **Implementation**
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

  // Calculate RSI for subsequent periods using exponential smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    // Wilder's smoothing method
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}
```

#### **Key Characteristics**
- **Period**: 14 (standard setting)
- **Range**: 0-100
- **Overbought**: Typically above 70
- **Oversold**: Typically below 30
- **Application**: Used for entry/exit signal generation

#### **Trading Interpretation**
- **Low RSI (< 40)**: Potential oversold condition → Buy signal candidate
- **High RSI (> 70)**: Potential overbought condition → Sell signal candidate

### 2. Chaikin Volatility

#### **Purpose**
Chaikin Volatility measures the rate of change in volatility by comparing the current volatility to the volatility from a specified number of periods ago. It helps identify periods of increasing or decreasing market volatility.

#### **Mathematical Formula**
```
CV = ((EMA(H-L, n) - EMA(H-L, n)[n periods ago]) / EMA(H-L, n)[n periods ago]) * 100
where:
- H = High price
- L = Low price  
- EMA = Exponential Moving Average
- n = Period length
```

#### **Implementation**
```typescript
function calculateChaikinVolatility(highs: number[], lows: number[], length: number = 10): number[] {
  const cv: number[] = [];
  const hlDiff = highs.map((h, i) => h - lows[i]);
  
  // Calculate EMA of H-L differences
  let multiplier = 2 / (length + 1);
  let emaHL: number[] = [];
  let initialEMA = hlDiff.slice(0, length).reduce((a, b) => a + b) / length;
  
  emaHL.push(initialEMA);
  for (let i = length; i < hlDiff.length; i++) {
    emaHL.push((hlDiff[i] - emaHL[emaHL.length - 1]) * multiplier + emaHL[emaHL.length - 1]);
  }
  
  // Calculate CV as percentage change in EMA
  for (let i = length; i < emaHL.length; i++) {
    const cvValue = ((emaHL[i] - emaHL[i - length]) / emaHL[i - length]) * 100;
    cv.push(cvValue);
  }
  
  return cv;
}
```

#### **Key Characteristics**
- **Period**: 10 (standard setting)
- **Range**: Unbounded (can be negative or positive)
- **Negative Values**: Decreasing volatility
- **Positive Values**: Increasing volatility

#### **Trading Interpretation**
- **Low CV (< -20)**: Low volatility, potential breakout setup → Buy signal candidate
- **High CV (> 65)**: High volatility, potential reversal → Sell signal candidate

## Signal Generation Strategy

### Combined Indicator Logic

The trading strategy uses both indicators simultaneously to generate more reliable signals:

#### **Buy Signal Conditions**
```typescript
if (!activeBuySignal && 
    cvValues[cvIndex] < buyCvThreshold && 
    rsiValues[i] < buyRsiThreshold) {
  // Generate BUY signal
}
```

**Default Thresholds:**
- RSI < 40 (oversold condition)
- CV < -19.9 (low volatility)

#### **Sell Signal Conditions**
```typescript
if (activeBuySignal && 
    cvValues[cvIndex] > sellCvThreshold && 
    rsiValues[i] > sellRsiThreshold) {
  // Generate SELL signal
}
```

**Default Thresholds:**
- RSI > 72 (overbought condition)
- CV > 65 (high volatility)

### Signal Processing Pipeline

#### **1. Data Preparation**
```typescript
const closePrices = ohlcvData.map(d => d.close);
const highPrices = ohlcvData.map(d => d.high);
const lowPrices = ohlcvData.map(d => d.low);
```

#### **2. Indicator Calculation**
```typescript
const rsiValues = calculateRSI(closePrices, 14);
const cvValues = calculateChaikinVolatility(highPrices, lowPrices, 10);
```

#### **3. Signal Generation Loop**
```typescript
const signals = [];
const trades = [];
let activeBuySignal = null;

for (let i = 1; i < rsiValues.length; i++) {
  const cvIndex = cvValues.length - rsiValues.length + i;
  
  if (cvIndex >= 0) {
    // Check for buy signals
    if (!activeBuySignal && shouldBuy(rsiValues[i], cvValues[cvIndex])) {
      activeBuySignal = createBuySignal(i);
      signals.push(createBuyMarker(i));
    }
    
    // Check for sell signals
    else if (activeBuySignal && shouldSell(rsiValues[i], cvValues[cvIndex])) {
      const trade = completeTrade(activeBuySignal, i);
      trades.push(trade);
      signals.push(createSellMarker(i, trade));
      activeBuySignal = null;
    }
  }
}
```

#### **4. Trade Analytics**
```typescript
function calculatePercentageChange(buyPrice: number, sellPrice: number): number {
  return ((sellPrice - buyPrice) / buyPrice) * 100;
}

function calculatePortfolioValue(trades: Trade[], initialInvestment = 1000): number {
  let portfolioValue = initialInvestment;
  
  trades.forEach(trade => {
    portfolioValue *= (1 + (trade.percentageChange / 100));
  });
  
  return portfolioValue;
}
```

## Parameter Optimization

### Optimization Algorithm

The application uses a hill climbing algorithm to find optimal parameter combinations:

#### **Parameter Bounds**
```typescript
const bounds = {
  buyRsi:  { min: 0,   max: 100 },
  buyCv:   { min: -50, max: 0   },
  sellRsi: { min: 0,   max: 100 },
  sellCv:  { min: 0,   max: 400 },
};
```

#### **Optimization Process**
1. **Random Start**: Begin with random parameter values
2. **Neighbor Generation**: Randomly modify one parameter by a step size
3. **Performance Evaluation**: Calculate profit using `updateChartWithParameters()`
4. **Selection**: Accept better performing parameters
5. **Iteration**: Repeat for specified number of iterations or time limit

#### **Performance Metrics**
- **Primary**: Total percentage return
- **Constraint**: Minimum number of trades (≥ 3)
- **Portfolio Simulation**: Starting with $1000 virtual capital

### Real-time Optimization Features

#### **Visual Feedback**
- Parameter sliders animate during optimization
- Real-time display of testing vs. best parameters
- Progress indication with current test values

#### **Optimization Controls**
```typescript
// 5-second optimization run
async function runHillClimbForFiveSeconds() {
  setIsOptimizing(true);
  const startTime = Date.now();
  
  while (Date.now() - startTime < 5000) {
    const result = runOneHillClimb();
    if (result.maxProfit > bestParams.maxProfit) {
      updateBestParameters(result);
    }
    await new Promise(resolve => setTimeout(resolve, 50)); // Animation delay
  }
  
  setIsOptimizing(false);
}
```

## Advanced Features

### Signal Visualization Options

#### **Trading Signals Only** (Default)
Shows only actual buy/sell pairs with profit/loss percentages

#### **All Trigger Points** (Optional)
```typescript
if (showAllSignals) {
  // Show semi-transparent arrows for all trigger conditions
  if (cvValues[cvIndex] < buyCvThreshold && rsiValues[i] < buyRsiThreshold) {
    allSignals.push({
      time: ohlcvData[i + 14].time,
      position: 'belowBar',
      color: 'rgba(33, 150, 243, 0.4)',
      shape: 'arrowUp'
    });
  }
}
```

### Performance Analytics

#### **Trade Tracking**
```typescript
interface Trade {
  buyTime: number;
  sellTime: number;
  buyPrice: number;
  sellPrice: number;
  percentageChange: number;
}
```

#### **Portfolio Metrics**
- Initial investment tracking
- Current portfolio value
- Total percentage return
- Individual trade performance
- Best parameter combinations found

### Chart Integration

#### **Marker Types**
- **Buy Signals**: Blue arrows below bars
- **Sell Signals**: Red arrows above bars
- **Profit/Loss**: Colored squares with percentage text

#### **Interactive Features**
- Hover tooltips with OHLC data
- Crosshair for precise value reading
- Responsive chart resizing
- Time scale controls

This technical analysis implementation provides a robust foundation for cryptocurrency trading strategy development and backtesting, with real-time optimization capabilities and comprehensive performance tracking.