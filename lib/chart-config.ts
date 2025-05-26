/**
 * Chart Configuration Constants
 * Centralized configuration for chart settings and API parameters
 */

export const CHART_CONFIG = {
  // Chart dimensions and appearance
  DEFAULT_HEIGHT: 500,
  DEFAULT_WIDTH: 800,
  
  // Price formatting
  PRICE_PRECISION: 6,
  MIN_MOVE: 0.000001,
  
  // Chart styling
  COLORS: {
    UP: '#26a69a',
    DOWN: '#ef5350',
    BUY_SIGNAL: '#2196F3',
    SELL_SIGNAL: '#ef5350',
    PROFIT: '#26a69a',
    LOSS: '#ef5350',
    BACKGROUND: 'transparent',
    TEXT: 'rgba(0, 0, 0, 0.9)',
    GRID: 'rgba(0, 0, 0, 0.1)',
    CROSSHAIR: 'rgba(0, 0, 0, 0.3)',
    ALL_SIGNALS_BUY: 'rgba(33, 150, 243, 0.4)',
    ALL_SIGNALS_SELL: 'rgba(233, 30, 99, 0.4)'
  },
  
  // Dark mode colors
  DARK_COLORS: {
    UP: '#26a69a',
    DOWN: '#ef5350',
    BUY_SIGNAL: '#2196F3',
    SELL_SIGNAL: '#ef5350',
    PROFIT: '#26a69a',
    LOSS: '#ef5350',
    BACKGROUND: 'transparent',
    TEXT: 'rgba(255, 255, 255, 0.9)',
    GRID: 'rgba(255, 255, 255, 0.1)',
    CROSSHAIR: 'rgba(255, 255, 255, 0.3)',
    ALL_SIGNALS_BUY: 'rgba(33, 150, 243, 0.4)',
    ALL_SIGNALS_SELL: 'rgba(233, 30, 99, 0.4)'
  },
  
  // Chart margins and padding
  SCALE_MARGINS: {
    top: 0.2,
    bottom: 0.2
  }
} as const;

export const API_CONFIG = {
  BASE_URL: 'https://api.geckoterminal.com/api/v2/networks/solana/pools',
  NETWORK: 'solana',
  RATE_LIMIT_DELAY: 100, // ms
  
  // Default pool address (SOL/USDC)
  DEFAULT_POOL: 'H8TcGwR9Ljs5sb5r1PJ2RZzruyqgf2zUzk5R31VVhpaq'
} as const;

export const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
] as const;

export const TRADING_CONFIG = {
  // Technical analysis parameters
  RSI_PERIOD: 14,
  CHAIKIN_VOLATILITY_PERIOD: 10,
  
  // Portfolio simulation
  INITIAL_INVESTMENT: 1000,
  MIN_TRADES_FOR_VALIDITY: 3,
  
  // Optimization settings
  OPTIMIZATION_DURATION: 5000, // 5 seconds in ms
  MAX_HILL_CLIMB_ITERATIONS: 300,
  OPTIMIZATION_DELAY: 50, // ms between iterations
  STEP_SIZE: 5
} as const;

export const PARAMETER_BOUNDS = {
  buyRsi: { min: 0, max: 100 },
  buyCv: { min: -50, max: 0 },
  sellRsi: { min: 0, max: 100 },
  sellCv: { min: 0, max: 400 },
} as const;

export const DEFAULT_PARAMETERS = {
  buyRsiThreshold: 40,
  buyCvThreshold: -19.9,
  sellRsiThreshold: 72,
  sellCvThreshold: 65
} as const;

/**
 * Get Birdeye API parameters for different intervals
 */
export function getBirdeyeParams(interval: string) {
  const now = Math.floor(Date.now() / 1000);
  let timeFrom: number;
  let type: string;
  
  switch (interval) {
    case "1m":
      timeFrom = now - (60 * 100); // 100 minutes
      type = "1m";
      break;
    case "5m":
      timeFrom = now - (5 * 60 * 100); // 500 minutes
      type = "5m";
      break;
    case "15m":
      timeFrom = now - (15 * 60 * 100); // 1500 minutes
      type = "15m";
      break;
    case "1h":
      timeFrom = now - (3600 * 100); // 100 hours
      type = "1H";
      break;
    case "4h":
      timeFrom = now - (4 * 3600 * 100); // 400 hours
      type = "4H";
      break;
    case "1d":
      timeFrom = now - (86400 * 100); // 100 days
      type = "1D";
      break;
    default:
      timeFrom = now - (3600 * 100); // Default to 100 hours
      type = "1H";
  }
  
  return { 
    type, 
    limit: 100,
    timeFrom,
    timeTo: now
  };
}

/**
 * Historical data range options (limited by API's 1000 data point maximum)
 */
export const HISTORICAL_RANGES = {
  "1w": { label: "1 Week", days: 7 },
  "1m": { label: "1 Month", days: 30 },
  "3m": { label: "3 Months", days: 90 },
  "6m": { label: "6 Months", days: 180 },
  "max": { label: "Max Available", days: null }
} as const;

/**
 * Calculate optimal limit based on interval and desired time range
 */
export function calculateOptimalLimit(interval: string, days: number): number {
  switch (interval) {
    case "1m":
      return Math.min(60 * 24 * days, 60 * 24 * 30); // Cap at 30 days for 1m
    case "5m":
      return Math.min(12 * 24 * days, 12 * 24 * 90); // Cap at 90 days for 5m
    case "15m":
      return Math.min((60 / 15) * 24 * days, (60 / 15) * 24 * 180); // Cap at 180 days for 15m
    case "1h":
      return 24 * days;
    case "4h":
      return (24 / 4) * days;
    case "1d":
      return days;
    default:
      return 24 * days; // Default to hourly
  }
}

/**
 * Get timestamp for X days ago
 */
export function getTimestampDaysAgo(days: number): number {
  const now = new Date();
  const daysAgo = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  return Math.floor(daysAgo.getTime() / 1000); // Convert to Unix timestamp
}

/**
 * Get maximum recommended days for each interval based on API limits (1000 data points max)
 */
export function getMaxRecommendedDays(interval: string): number {
  // GeckoTerminal API has a maximum limit of 1000 data points
  switch (interval) {
    case "1m": return 7;    // ~7 days max for 1-minute data (1000 points)
    case "5m": return 35;   // ~35 days max for 5-minute data (1000 points)  
    case "15m": return 104; // ~104 days max for 15-minute data (1000 points)
    case "1h": return 42;   // ~42 days max for hourly data (1000 points)
    case "4h": return 166;  // ~166 days max for 4-hour data (1000 points)
    case "1d": return 1000; // ~1000 days max for daily data (1000 points)
    default: return 42;
  }
}

/**
 * Get chart colors based on theme (light/dark)
 */
export function getChartColors(isDark: boolean) {
  return isDark ? CHART_CONFIG.DARK_COLORS : CHART_CONFIG.COLORS;
}