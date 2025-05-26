/**
 * Technical Analysis Utilities
 * Contains RSI, Chaikin Volatility, and signal generation functions
 */

export interface Trade {
  buyTime: number;
  sellTime: number;
  buyPrice: number;
  sellPrice: number;
  percentageChange: number;
}

export interface SignalParameters {
  buyRsiThreshold: number;
  buyCvThreshold: number;
  sellRsiThreshold: number;
  sellCvThreshold: number;
}

export interface TradeAnalytics {
  initialInvestment: number;
  currentPortfolioValue: number;
  totalPercentageChange: number;
  trades: Trade[];
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param closes Array of closing prices
 * @param period RSI period (default: 14)
 * @returns Array of RSI values
 */
export function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate subsequent RS values
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

/**
 * Calculate Chaikin Volatility
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param length Period length (default: 10)
 * @returns Array of Chaikin Volatility values
 */
export function calculateChaikinVolatility(
  highs: number[], 
  lows: number[], 
  length = 10
): number[] {
  const cv: number[] = [];
  const hlDiff = highs.map((h, i) => h - lows[i]);
  
  // Calculate EMA of H-L
  const multiplier = 2 / (length + 1);
  const emaHL: number[] = [];
  const initialEMA = hlDiff.slice(0, length).reduce((a, b) => a + b) / length;
  
  emaHL.push(initialEMA);
  for (let i = length; i < hlDiff.length; i++) {
    emaHL.push((hlDiff[i] - emaHL[emaHL.length - 1]) * multiplier + emaHL[emaHL.length - 1]);
  }
  
  // Calculate CV
  for (let i = length; i < emaHL.length; i++) {
    const cvValue = ((emaHL[i] - emaHL[i - length]) / emaHL[i - length]) * 100;
    cv.push(cvValue);
  }
  
  return cv;
}

/**
 * Calculate percentage change between two prices
 */
export function calculatePercentageChange(buyPrice: number, sellPrice: number): number {
  return ((sellPrice - buyPrice) / buyPrice) * 100;
}

/**
 * Generate trading signals and calculate performance
 */
export function generateTradingSignals(
  ohlcvData: { time: number; open: number; high: number; low: number; close: number }[],
  parameters: SignalParameters,
  showAllSignals = false,
  colors?: {
    buySignal: string;
    sellSignal: string;
    profit: string;
    loss: string;
    allSignalsBuy: string;
    allSignalsSell: string;
  }
) {
  const { buyRsiThreshold, buyCvThreshold, sellRsiThreshold, sellCvThreshold } = parameters;
  
  // Default colors (can be overridden)
  const signalColors = colors || {
    buySignal: '#2196F3',
    sellSignal: '#ef5350',
    profit: '#26a69a',
    loss: '#ef5350',
    allSignalsBuy: 'rgba(33, 150, 243, 0.4)',
    allSignalsSell: 'rgba(233, 30, 99, 0.4)'
  };
  
  const closePrices = ohlcvData.map(d => d.close);
  const highPrices = ohlcvData.map(d => d.high);
  const lowPrices = ohlcvData.map(d => d.low);
  
  const rsiValues = calculateRSI(closePrices, 14);
  const cvValues = calculateChaikinVolatility(highPrices, lowPrices, 10);

  const signals = [];
  const allSignals = [];
  let activeBuySignal: { time: number; price: number } | null = null;
  const completedTrades: Trade[] = [];

  const offset = 14; // RSI offset

  for (let i = 1; i < rsiValues.length; i++) {
    const cvIndex = cvValues.length - rsiValues.length + i;
    if (cvIndex >= 0 && (i + offset) < ohlcvData.length) {
      // BUY SIGNAL
      if (!activeBuySignal && cvValues[cvIndex] < buyCvThreshold && rsiValues[i] < buyRsiThreshold) {
        activeBuySignal = {
          time: ohlcvData[i + offset].time,
          price: ohlcvData[i + offset].close
        };
        signals.push({
          time: ohlcvData[i + offset].time,
          position: 'belowBar' as const,
          color: signalColors.buySignal,
          shape: 'arrowUp' as const,
          text: 'BUY',
        });
      }
      // SELL SIGNAL
      else if (activeBuySignal && cvValues[cvIndex] > sellCvThreshold && rsiValues[i] > sellRsiThreshold) {
        const sellPrice = ohlcvData[i + offset].close;
        const percentChange = calculatePercentageChange(activeBuySignal.price, sellPrice);
        const sign = percentChange >= 0 ? '+' : '';
        const percentColor = percentChange >= 0 ? signalColors.profit : signalColors.loss;

        completedTrades.push({
          buyTime: activeBuySignal.time,
          sellTime: ohlcvData[i + offset].time,
          buyPrice: activeBuySignal.price,
          sellPrice: sellPrice,
          percentageChange: percentChange
        });

        signals.push({
          time: ohlcvData[i + offset].time,
          position: 'aboveBar',
          color: signalColors.sellSignal,
          shape: 'arrowDown',
          text: 'SELL',
        });
        signals.push({
          time: ohlcvData[i + offset].time,
          position: 'aboveBar',
          color: percentColor,
          shape: 'square',
          text: `${sign}${percentChange.toFixed(2)}%`,
        });
        activeBuySignal = null;
      }

      // All signals for debugging
      if (showAllSignals) {
        if (cvValues[cvIndex] < buyCvThreshold && rsiValues[i] < buyRsiThreshold) {
          allSignals.push({
            time: ohlcvData[i + offset].time,
            position: 'belowBar',
            color: signalColors.allSignalsBuy,
            shape: 'arrowUp',
          });
        }
        if (cvValues[cvIndex] > sellCvThreshold && rsiValues[i] > sellRsiThreshold) {
          allSignals.push({
            time: ohlcvData[i + offset].time,
            position: 'aboveBar',
            color: signalColors.allSignalsSell,
            shape: 'arrowDown',
          });
        }
      }
    }
  }

  // Calculate portfolio performance
  const initialInvestment = 1000;
  let currentPortfolioValue = initialInvestment;
  
  completedTrades.forEach(trade => {
    currentPortfolioValue *= (1 + (trade.percentageChange / 100));
  });

  const totalPercentageChange = ((currentPortfolioValue - initialInvestment) / initialInvestment) * 100;

  const tradeAnalytics: TradeAnalytics = {
    initialInvestment,
    currentPortfolioValue,
    totalPercentageChange,
    trades: completedTrades
  };

  const finalSignals = showAllSignals
    ? signals.concat(allSignals).sort((a, b) => a.time - b.time)
    : signals;

  return {
    signals: finalSignals,
    tradeAnalytics,
    profit: totalPercentageChange,
    numTrades: completedTrades.length
  };
}