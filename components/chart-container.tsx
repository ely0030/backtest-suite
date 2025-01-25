"use client"

import { useEffect, useRef, useState } from "react"
import { createChart, ColorType, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

// Add RSI calculation function
function calculateRSI(closes: number[], period = 7): number[] {
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

// Add Chaikin Volatility calculation function
function calculateChaikinVolatility(highs: number[], lows: number[], length: number = 10): number[] {
  const cv: number[] = [];
  const hlDiff = highs.map((h, i) => h - lows[i]);
  
  // Calculate EMA of H-L
  let multiplier = 2 / (length + 1);
  let emaHL: number[] = [];
  let initialEMA = hlDiff.slice(0, length).reduce((a, b) => a + b) / length;
  
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

// Add this helper function to calculate percentage change
function calculatePercentageChange(buyPrice: number, sellPrice: number): number {
  return ((sellPrice - buyPrice) / buyPrice) * 100;
}

// Add a new interface to track trade details
interface Trade {
  buyTime: number;
  sellTime: number;
  buyPrice: number;
  sellPrice: number;
  percentageChange: number;
}

// Fix the TypeScript errors in the sort function
interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartMarker {
  time: number;
  position: 'belowBar' | 'aboveBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'square';
  text: string;
}

// Add this near the top with other interfaces
interface TooltipData {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

// Add this helper function near or inside fetchData (above or below is fine).
function getOhlcvParams(interval: string) {
  switch (interval) {
    case "1m":
      return { timeframeParam: "minute", aggregateParam: "1", limit: 60 * 24 * 7 }     // 7 days of 1-minute candles
    case "5m":
      return { timeframeParam: "minute", aggregateParam: "5", limit: 12 * 24 * 7 }    // 7 days of 5-minute candles
    case "15m":
      return { timeframeParam: "minute", aggregateParam: "15", limit: (60 / 15) * 24 * 7 } // 672
    case "1h":
      return { timeframeParam: "hour", aggregateParam: "1", limit: 24 * 7 }          // 168
    case "4h":
      return { timeframeParam: "hour", aggregateParam: "4", limit: (24 / 4) * 7 }     // 42
    case "1d":
      return { timeframeParam: "day", aggregateParam: "1", limit: 7 }                // 7
    default:
      // fallback
      return { timeframeParam: "hour", aggregateParam: "1", limit: 100 }
  }
}

export function ChartContainer() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [interval, setInterval] = useState<string>("15m")
  const [poolAddress, setPoolAddress] = useState("H8TcGwR9Ljs5sb5r1PJ2RZzruyqgf2zUzk5R31VVhpaq")
  
  // State to store the full OHLCV data
  const [ohlcvData, setOhlcvData] = useState<{
    time: number
    open: number
    high: number
    low: number
    close: number
  }[] | null>(null)

  // Add state for strategy parameters
  const [buyRsiThreshold, setBuyRsiThreshold] = useState(40)
  const [buyCvThreshold, setBuyCvThreshold] = useState(-19.9)
  const [sellRsiThreshold, setSellRsiThreshold] = useState(72)
  const [sellCvThreshold, setSellCvThreshold] = useState(65)

  // Add new state for trade analytics
  const [tradeAnalytics, setTradeAnalytics] = useState<{
    initialInvestment: number;
    currentPortfolioValue: number;
    totalPercentageChange: number;
    trades: Trade[];
  }>({
    initialInvestment: 1000,
    currentPortfolioValue: 1000,
    totalPercentageChange: 0,
    trades: []
  })

  // Add new state for token names
  const [tokenPair, setTokenPair] = useState<{base: string, quote: string}>({ base: '', quote: '' })

  const [isOptimizing, setIsOptimizing] = useState(false);

  // Add state for tracking current test parameters
  const [testParams, setTestParams] = useState({
    buyRsi: buyRsiThreshold,
    buyCv: buyCvThreshold,
    sellRsi: sellRsiThreshold,
    sellCv: sellCvThreshold
  });

  // Add bestParams to component state
  const [bestParams, setBestParams] = useState({
    buyRsi: buyRsiThreshold,
    buyCv: buyCvThreshold,
    sellRsi: sellRsiThreshold,
    sellCv: sellCvThreshold,
    maxProfit: -Infinity,
    numTrades: 0
  });

  // Add state for tracking highest profit
  const [highestProfit, setHighestProfit] = useState({
    profit: -Infinity,
    params: {
      buyRsi: buyRsiThreshold,
      buyCv: buyCvThreshold,
      sellRsi: sellRsiThreshold,
      sellCv: sellCvThreshold
    }
  });

  // Add new state for tracking hot regions
  const [hotRegions, setHotRegions] = useState<{
    buyRsi: { min: number; max: number };
    buyCv: { min: number; max: number };
    sellRsi: { min: number; max: number };
    sellCv: { min: number; max: number };
  } | null>(null);

  // Add new state to track optimization phase
  const [optimizationPhase, setOptimizationPhase] = useState<'none' | 'crude' | 'refined'>('none');

  const [showAllSignals, setShowAllSignals] = useState(false);

  const intervals = [
    { label: "1m", value: "minute?aggregate=1" },
    { label: "5m", value: "minute?aggregate=5" },
    { label: "15m", value: "minute?aggregate=15" },
    { label: "1h", value: "hour" },
    { label: "4h", value: "hour?aggregate=4" },
    { label: "1d", value: "day" },
  ]

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Reset parameters when loading new pool
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
        params: {
          buyRsi: 40,
          buyCv: -19.9,
          sellRsi: 72,
          sellCv: 65
        }
      });

      // First fetch pool information to get token names
      const poolInfoUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}`
      const poolResponse = await fetch(poolInfoUrl)
      const poolData = await poolResponse.json()

      if (!poolData?.data?.attributes) {
        throw new Error("Invalid pool address or pool not found")
      }

      // Access the correct attributes from the pool data
      const { 
        base_token_symbol: baseSymbol,
        quote_token_symbol: quoteSymbol,
        name
      } = poolData.data.attributes

      // Set token pair with fallback to pool name if symbols aren't available
      setTokenPair({
        base: baseSymbol || name?.split('/')[0] || 'Unknown',
        quote: quoteSymbol || name?.split('/')[1] || 'Unknown'
      })

      // Add a small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100))

      // Replace the old 5m/hour code with this:
      const { timeframeParam, aggregateParam, limit } = getOhlcvParams(interval)
      const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregateParam}&limit=${limit}`
      console.log("Fetching from URL:", url) // Debug log
      
      const response = await fetch(url)
      if (!response.ok) {
        console.error("API Error:", response.status, await response.text()) // Debug log
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()
      if (!data?.data?.attributes?.ohlcv_list) {
        console.error("Invalid data structure:", data) // Debug log
        throw new Error("No OHLCV data available for this pool")
      }

      // 2) Log the raw data to see if it is zero
      console.log("Raw OHLCV data from GeckoTerminal:", data.data.attributes.ohlcv_list)

      const fetchedData = data.data.attributes.ohlcv_list
        .map(([timestamp, open, high, low, close]: [number, string, string, string, string]) => ({
          time: timestamp as number,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
        }))
        .sort((a: { time: number }, b: { time: number }) => a.time - b.time)

      // 3) Another console log to confirm final numeric values
      console.log("Transformed Candle Data:", fetchedData)

      setOhlcvData(fetchedData)
      setLoading(false)
    } catch (err) {
      console.error("Chart error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      // Reset token pair on error
      setTokenPair({ base: '', quote: '' })
      setLoading(false)
    }
  }

  // Update useEffect to use the fetchData function
  useEffect(() => {
    fetchData()
  }, [interval, poolAddress])

  // Add a function to handle search submit
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fetchData()
  }

  // 2) Effect for building/updating the chart and signals whenever data or parameters change
  useEffect(() => {
    // If we haven't loaded data yet, do nothing
    if (!ohlcvData || ohlcvData.length === 0) {
      return
    }
    
    // Cleanup function to remove existing chart
    const cleanupChart = () => {
      if (candlestickSeries.current) {
        chart.current?.removeSeries(candlestickSeries.current)
        candlestickSeries.current = null
      }
      if (chart.current) {
        chart.current.remove()
        chart.current = null
      }
    }
    
    try {
      // Cleanup any existing chart
      cleanupChart()

      // Prepare arrays for RSI/CV calculations
      const closePrices = ohlcvData.map(d => d.close)
      const highPrices = ohlcvData.map(d => d.high)
      const lowPrices = ohlcvData.map(d => d.low)
      
      const rsiValues = calculateRSI(closePrices, 14)
      const cvValues = calculateChaikinVolatility(highPrices, lowPrices, 10)

      const signals = []
      const allSignals = []
      let activeBuySignal: { time: number; price: number } | null = null
      
      // Array to track completed trades
      const completedTrades: Trade[] = []

      for (let i = 1; i < rsiValues.length; i++) {
        const cvIndex = cvValues.length - rsiValues.length + i
        if (cvIndex >= 0) {
          // BUY
          if (!activeBuySignal && cvValues[cvIndex] < buyCvThreshold && rsiValues[i] < buyRsiThreshold) {
            activeBuySignal = {
              time: ohlcvData[i + 14].time,
              price: ohlcvData[i + 14].close
            }
            signals.push({
              time: ohlcvData[i + 14].time,
              position: 'belowBar' as const,
              color: '#2196F3',
              shape: 'arrowUp' as const,
              text: 'BUY',
            })
          }
          // SELL
          else if (activeBuySignal && cvValues[cvIndex] > sellCvThreshold && rsiValues[i] > sellRsiThreshold) {
            const sellPrice = ohlcvData[i + 14].close
            const percentChange = calculatePercentageChange(activeBuySignal.price, sellPrice)
            const sign = percentChange >= 0 ? '+' : ''
            const percentColor = percentChange >= 0 ? '#26a69a' : '#ef5350'

            // Record the completed trade
            completedTrades.push({
              buyTime: activeBuySignal.time,
              sellTime: ohlcvData[i + 14].time,
              buyPrice: activeBuySignal.price,
              sellPrice: sellPrice,
              percentageChange: percentChange
            })

            signals.push({
              time: ohlcvData[i + 14].time,
              position: 'aboveBar',
              color: '#ef5350',
              shape: 'arrowDown',
              text: 'SELL',
            })
            signals.push({
              time: ohlcvData[i + 14].time,
              position: 'aboveBar',
              color: percentColor,
              shape: 'square',
              text: `${sign}${percentChange.toFixed(2)}%`,
            })
            activeBuySignal = null
          }

          // >>> If user wants to see *all* triggers, save them separately:
          if (showAllSignals) {
            if (cvValues[cvIndex] < buyCvThreshold && rsiValues[i] < buyRsiThreshold) {
              allSignals.push({
                time: ohlcvData[i + 14].time,
                position: 'belowBar',
                color: 'rgba(33, 150, 243, 0.4)', // More transparent blue
                shape: 'arrowUp',
                // removed text to only show arrow
              });
            }
            if (cvValues[cvIndex] > sellCvThreshold && rsiValues[i] > sellRsiThreshold) {
              allSignals.push({
                time: ohlcvData[i + 14].time,
                position: 'aboveBar',
                color: 'rgba(233, 30, 99, 0.4)', // More transparent red
                shape: 'arrowDown',
                // removed text to only show arrow
              });
            }
          }
        }
      }

      // Calculate cumulative profit
      const initialInvestment = 1000
      let currentPortfolioValue = initialInvestment
      
      completedTrades.forEach(trade => {
        currentPortfolioValue *= (1 + (trade.percentageChange / 100))
      })

      const totalPercentageChange = ((currentPortfolioValue - initialInvestment) / initialInvestment) * 100

      // Add a new state to store trade and profit information
      setTradeAnalytics({
        initialInvestment,
        currentPortfolioValue,
        totalPercentageChange,
        trades: completedTrades
      })

      // Now that we have signals, build the chart
      if (chartContainerRef.current) {
        chart.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "rgba(0, 0, 0, 0.9)",
          },
          grid: {
            vertLines: { color: "rgba(0, 0, 0, 0.1)" },
            horzLines: { color: "rgba(0, 0, 0, 0.1)" },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
          rightPriceScale: {
            autoScale: true,
            borderVisible: true,
            scaleMargins: {
              top: 0.2,
              bottom: 0.2,
            },
            format: {
              type: 'price',
              precision: 6,
              minMove: 0.000001,
            },
          },
          width: chartContainerRef.current.clientWidth,
          height: 500,
          // Add crosshair options
          crosshair: {
            mode: 1,
            vertLine: {
              width: 1,
              color: 'rgba(0, 0, 0, 0.3)',
              style: 3,
            },
            horzLine: {
              width: 1,
              color: 'rgba(0, 0, 0, 0.3)',
              style: 3,
            },
          },
        })

        // Create tooltip element
        const toolTip = document.createElement('div');
        toolTip.className = 'floating-tooltip-2';
        chartContainerRef.current.appendChild(toolTip);
        toolTip.style.display = 'none';
        toolTip.style.position = 'absolute';
        toolTip.style.padding = '8px';
        toolTip.style.boxSizing = 'border-box';
        toolTip.style.fontSize = '12px';
        toolTip.style.color = 'rgba(0, 0, 0, 0.9)';
        toolTip.style.background = 'white';
        toolTip.style.border = '1px solid rgba(0, 0, 0, 0.2)';
        toolTip.style.borderRadius = '4px';
        toolTip.style.zIndex = '1000';

        candlestickSeries.current = chart.current.addCandlestickSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
          priceFormat: {
            type: 'price',
            precision: 6,
            minMove: 0.000001,
          },
        })

        // Transform the data properly
        const transformedData = ohlcvData.map(d => ({
          time: d.time,
          open: parseFloat(d.open.toString()),
          high: parseFloat(d.high.toString()),
          low: parseFloat(d.low.toString()),
          close: parseFloat(d.close.toString()),
        }))

        // Set the data
        candlestickSeries.current.setData(transformedData)

        // Add tooltip handling
        chart.current.subscribeCrosshairMove((param) => {
          if (
            param.point === undefined ||
            !param.time ||
            param.point.x < 0 ||
            param.point.y < 0
          ) {
            toolTip.style.display = 'none';
          } else {
            const data = param.seriesData.get(candlestickSeries.current) as TooltipData;
            if (data) {
              const dateStr = new Date(data.time * 1000).toLocaleDateString();
              toolTip.style.display = 'block';
              const price = data.close;
              const color = data.open > data.close ? '#ef5350' : '#26a69a';
              
              toolTip.innerHTML = `
                <div style="color: ${color}">
                  <div>O: ${data.open.toFixed(6)}</div>
                  <div>H: ${data.high.toFixed(6)}</div>
                  <div>L: ${data.low.toFixed(6)}</div>
                  <div>C: ${data.close.toFixed(6)}</div>
                </div>
                <div style="color: rgba(0, 0, 0, 0.7)">${dateStr}</div>
              `;

              const coordinate = candlestickSeries.current.priceToCoordinate(price);
              let shiftedCoordinate = param.point.x - 50;
              
              if (coordinate === null) {
                return;
              }

              shiftedCoordinate = Math.max(
                0,
                Math.min(chartContainerRef.current.clientWidth - 150, shiftedCoordinate)
              );
              
              const coordinateY = coordinate - 100 > 0 
                ? coordinate - 100 
                : Math.max(0, coordinate + 50);

              toolTip.style.left = shiftedCoordinate + 'px';
              toolTip.style.top = coordinateY + 'px';
            }
          }
        });

        // final signals array is signals + optional allSignals
        // ensure ascending order to avoid chart assertion errors
        const finalSignals = showAllSignals
          ? signals.concat(allSignals).sort((a, b) => a.time - b.time)
          : signals;

        candlestickSeries.current.setMarkers(finalSignals as ChartMarker[])
        // Fit chart to content
        chart.current.timeScale().fitContent()

        const handleResize = () => {
          if (chart.current && chartContainerRef.current) {
            chart.current.resize(
              chartContainerRef.current.clientWidth,
              chartContainerRef.current.clientHeight
            )
            chart.current.timeScale().fitContent()
          }
        }
        window.addEventListener("resize", handleResize)
        
        // Return cleanup function
        return () => {
          window.removeEventListener("resize", handleResize)
          cleanupChart()
        }
      }
    } catch (err) {
      console.error("Chart/Signal error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }, [
    ohlcvData,
    buyRsiThreshold,
    buyCvThreshold,
    sellRsiThreshold,
    sellCvThreshold,
    showAllSignals
  ])

  // Add this function inside ChartContainer
  function updateChartWithParameters(
    rsi: number,
    cvBuy: number,
    rsiSell: number,
    cvSell: number
  ) {
    if (!ohlcvData || !candlestickSeries.current) return;

    // Clear existing markers
    candlestickSeries.current.setMarkers([]);

    // Calculate signals and trades with new parameters
    const signals = [];
    let activeBuySignal: { time: number; price: number } | null = null;
    const completedTrades: Trade[] = [];

    const closePrices = ohlcvData.map(d => d.close);
    const highPrices = ohlcvData.map(d => d.high);
    const lowPrices = ohlcvData.map(d => d.low);
    const rsiValues = calculateRSI(closePrices, 14);
    const cvValues = calculateChaikinVolatility(highPrices, lowPrices, 10);

    const offset = 14;
    for (let i = 1; i < rsiValues.length; i++) {
      const cvIndex = cvValues.length - rsiValues.length + i;
      if (cvIndex >= 0 && (i + offset) < ohlcvData.length) {
        // BUY
        if (!activeBuySignal && cvValues[cvIndex] < cvBuy && rsiValues[i] < rsi) {
          activeBuySignal = {
            time: ohlcvData[i + offset].time,
            price: ohlcvData[i + offset].close
          };
          signals.push({
            time: ohlcvData[i + offset].time,
            position: 'belowBar' as const,
            color: '#2196F3',
            shape: 'arrowUp' as const,
            text: 'BUY',
          });
        }
        // SELL
        else if (
          activeBuySignal && 
          cvValues[cvIndex] > cvSell && 
          rsiValues[i] > rsiSell
        ) {
          const sellPrice = ohlcvData[i + offset].close;
          const percentChange = calculatePercentageChange(
            activeBuySignal.price,
            sellPrice
          );
          
          completedTrades.push({
            buyTime: activeBuySignal.time,
            sellTime: ohlcvData[i + offset].time,
            buyPrice: activeBuySignal.price,
            sellPrice: sellPrice,
            percentageChange: percentChange
          });

          const sign = percentChange >= 0 ? '+' : '';
          const percentColor = percentChange >= 0 ? '#26a69a' : '#ef5350';

          signals.push({
            time: ohlcvData[i + offset].time,
            position: 'aboveBar',
            color: '#ef5350',
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
      }
    }

    // Update markers on chart
    candlestickSeries.current.setMarkers(signals as ChartMarker[]);

    // Calculate profit
    let currentPortfolioValue = 1000;
    completedTrades.forEach(trade => {
      currentPortfolioValue *= (1 + (trade.percentageChange / 100));
    });

    const totalPercentageChange = ((currentPortfolioValue - 1000) / 1000) * 100;

    // Update trade analytics state
    setTradeAnalytics({
      initialInvestment: 1000,
      currentPortfolioValue,
      totalPercentageChange,
      trades: completedTrades
    });

    // Return the calculated values for immediate use
    return {
      profit: totalPercentageChange,
      numTrades: completedTrades.length
    };
  }

  // 1) Replace runHillClimbOptimization with runOneHillClimb (single run):
  function runOneHillClimb() {
    const maxIterations = 300;   // how many attempts per climb
    const stepSizes = { rsi: 5, cv: 5 };
    const bounds = {
      buyRsi:  { min: 0,   max: 100 },
      buyCv:   { min: -50, max: 0   },
      sellRsi: { min: 0,   max: 100 },
      sellCv:  { min: 0,   max: 400 },
    };

    // We'll still keep randomParams, randomNeighbor, etc.
    // (Either inline them here or keep them as separate helper functions.)

    function clamp(val: number, min: number, max: number) {
      return Math.max(min, Math.min(val, max));
    }
    function randInt(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randomParams() {
      return {
        buyRsi: randInt(bounds.buyRsi.min, bounds.buyRsi.max),
        buyCv: randInt(bounds.buyCv.min, bounds.buyCv.max),
        sellRsi: randInt(bounds.sellRsi.min, bounds.sellRsi.max),
        sellCv: randInt(bounds.sellCv.min, bounds.sellCv.max),
      };
    }
    function randomNeighbor(params: typeof bestParams) {
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

    // Start from a random position
    let current = { ...randomParams(), maxProfit: -Infinity, numTrades: 0 };

    // Update testParams to show initial position
    setTestParams({
      buyRsi: current.buyRsi,
      buyCv: current.buyCv,
      sellRsi: current.sellRsi,
      sellCv: current.sellCv
    });

    // Evaluate initial
    const initialResult = updateChartWithParameters(
      current.buyRsi, current.buyCv, current.sellRsi, current.sellCv
    );
    if (initialResult) {
      current.maxProfit = initialResult.profit;
      current.numTrades = initialResult.numTrades;
    }

    // Run hill climb
    for (let iter = 0; iter < maxIterations; iter++) {
      const candidate = randomNeighbor(current);

      // Update testParams to show what we're testing
      setTestParams({
        buyRsi: candidate.buyRsi,
        buyCv: candidate.buyCv,
        sellRsi: candidate.sellRsi,
        sellCv: candidate.sellCv
      });

      const result = updateChartWithParameters(
        candidate.buyRsi, candidate.buyCv, candidate.sellRsi, candidate.sellCv
      );
      if (!result) continue;

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

  // 2) New function that calls runOneHillClimb repeatedly for 5s:
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
          setBuyRsiThreshold(localBest.buyRsi);
          setBuyCvThreshold(localBest.buyCv);
          setSellRsiThreshold(localBest.sellRsi);
          setSellCvThreshold(localBest.sellCv);

          updateChartWithParameters(
            localBest.buyRsi,
            localBest.buyCv,
            localBest.sellRsi,
            localBest.sellCv
          );
        }
        // Add a small delay to make the animation more visible
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // After the loop ends, ensure we're showing the best result
      if (localBest.maxProfit > -Infinity) {
        // Set the final parameters
        setBuyRsiThreshold(localBest.buyRsi);
        setBuyCvThreshold(localBest.buyCv);
        setSellRsiThreshold(localBest.sellRsi);
        setSellCvThreshold(localBest.sellCv);

        // Update the chart one final time with best parameters
        updateChartWithParameters(
          localBest.buyRsi,
          localBest.buyCv,
          localBest.sellRsi,
          localBest.sellCv
        );

        // Update highest profit if we found a better one
        if (localBest.maxProfit > highestProfit.profit) {
          setHighestProfit({
            profit: localBest.maxProfit,
            params: {
              buyRsi: localBest.buyRsi,
              buyCv: localBest.buyCv,
              sellRsi: localBest.sellRsi,
              sellCv: localBest.sellCv
            }
          });
        }
      }
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <CardTitle>
              {loading 
                ? 'Loading...'
                : tokenPair.base && tokenPair.quote 
                  ? `${tokenPair.base}/${tokenPair.quote} Price Chart`
                  : 'Enter Pool Address'
              }
            </CardTitle>
            <ButtonGroup variant="outline" size="sm">
              {intervals.map((int) => (
                <Button
                  key={int.label}
                  onClick={() => setInterval(int.label)}
                  variant={interval === int.label ? "default" : "outline"}
                >
                  {int.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
          
          {/* Add search bar */}
          <form 
            onSubmit={handleSearchSubmit}
            className="flex justify-center items-center gap-2 max-w-xl mx-auto w-full"
          >
            <input
              type="text"
              value={poolAddress}
              onChange={(e) => setPoolAddress(e.target.value)}
              placeholder="Enter Pool Address..."
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <Button type="submit" size="sm">
              Load Chart
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="flex-1">
            {loading && <Skeleton className="w-full h-[500px]" />}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div ref={chartContainerRef} className="w-full h-[500px]" />

            <div className="mt-4 text-sm text-muted-foreground text-center">
              Data provided by{" "}
              <a
                href="https://www.geckoterminal.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-primary"
              >
                GeckoTerminal
              </a>
            </div>
          </div>

          {/* Strategy Controls and Trade Analytics */}
          <div className="w-64 space-y-6 p-4 border rounded-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Buy Parameters</h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 relative group"
                  onClick={() => {
                    runHillClimbForFiveSeconds();
                  }}
                  disabled={isOptimizing}
                >
                  <Rocket className="h-4 w-4" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Hill Climb Optimization
                  </span>
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm">RSI Below</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isOptimizing ? testParams.buyRsi : buyRsiThreshold}
                    onChange={(e) => setBuyRsiThreshold(Number(e.target.value))}
                    className="w-full"
                    disabled={isOptimizing}
                  />
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
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">CV Below</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="-50"
                    max="0"
                    step="0.1"
                    value={isOptimizing ? testParams.buyCv : buyCvThreshold}
                    onChange={(e) => setBuyCvThreshold(Number(e.target.value))}
                    className="w-full"
                    disabled={isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {isOptimizing ? (
                      <span>
                        Testing: {testParams.buyCv.toFixed(1)}
                        {bestParams.buyCv !== buyCvThreshold && 
                          ` (Best: ${bestParams.buyCv.toFixed(1)})`}
                      </span>
                    ) : (
                      buyCvThreshold.toFixed(1)
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-medium">Sell Parameters</h3>
              <div className="space-y-2">
                <label className="text-sm">RSI Above</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isOptimizing ? testParams.sellRsi : sellRsiThreshold}
                    onChange={(e) => setSellRsiThreshold(Number(e.target.value))}
                    className="w-full"
                    disabled={isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {isOptimizing ? (
                      <span>
                        Testing: {testParams.sellRsi}
                        {bestParams.sellRsi !== sellRsiThreshold && 
                          ` (Best: ${bestParams.sellRsi})`}
                      </span>
                    ) : (
                      sellRsiThreshold
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">CV Above</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="400"
                    step="0.1"
                    value={isOptimizing ? testParams.sellCv : sellCvThreshold}
                    onChange={(e) => setSellCvThreshold(Number(e.target.value))}
                    className="w-full"
                    disabled={isOptimizing}
                  />
                  <div className="text-sm text-right">
                    {isOptimizing ? (
                      <span>
                        Testing: {testParams.sellCv.toFixed(1)}
                        {bestParams.sellCv !== sellCvThreshold && 
                          ` (Best: ${bestParams.sellCv.toFixed(1)})`}
                      </span>
                    ) : (
                      sellCvThreshold.toFixed(1)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Trade Analytics Section */}
            <div className="mt-6 border-t pt-4">
              <h3 className="font-medium mb-4">Trade Analytics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Initial Investment:</span>
                  <span>${tradeAnalytics.initialInvestment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Portfolio:</span>
                  <span>${tradeAnalytics.currentPortfolioValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Return:</span>
                  <span 
                    className={
                      tradeAnalytics.totalPercentageChange >= 0 
                      ? "text-green-600" 
                      : "text-red-600"
                    }
                  >
                    {tradeAnalytics.totalPercentageChange >= 0 ? '+' : ''}
                    {tradeAnalytics.totalPercentageChange.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Detailed Trades List */}
              {tradeAnalytics.trades.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Trades</h4>
                  <div className="max-h-48 overflow-y-auto">
                    {tradeAnalytics.trades.map((trade, index) => (
                      <div 
                        key={index} 
                        className={`flex justify-between text-xs p-1 ${
                          trade.percentageChange >= 0 
                          ? "bg-green-50" 
                          : "bg-red-50"
                        }`}
                      >
                        <span>
                          {new Date(trade.buyTime * 1000).toLocaleDateString()} - 
                          {new Date(trade.sellTime * 1000).toLocaleDateString()}
                        </span>
                        <span>
                          {trade.percentageChange >= 0 ? '+' : ''}
                          {trade.percentageChange.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Highest Profit Found section */}
              {highestProfit.profit > -Infinity && (
                <div className="mt-4 p-2 bg-green-50 rounded">
                  <div className="font-medium text-sm">Highest Profit Found:</div>
                  <div className="text-green-600 font-bold">
                    {highestProfit.profit.toFixed(2)}%
                  </div>
                  <div className="text-xs mt-1">
                    Parameters:
                    <br />
                    Buy RSI: {highestProfit.params.buyRsi}
                    <br />
                    Buy CV: {highestProfit.params.buyCv}
                    <br />
                    Sell RSI: {highestProfit.params.sellRsi}
                    <br />
                    Sell CV: {highestProfit.params.sellCv}
                  </div>
                </div>
              )}
            </div>

            {/* New Optimize Button */}
            <div className="space-y-4">
              {hotRegions && !isOptimizing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOptimizing(true);
                    runHillClimbForFiveSeconds();
                    setIsOptimizing(false);
                  }}
                >
                  Refine Search
                </Button>
              )}

              {isOptimizing && (
                <div className="text-sm text-muted-foreground">
                  Phase: {optimizationPhase === 'crude' ? 'Finding Hot Regions' : 'Refining Search'}
                </div>
              )}

              {/* Hot Regions display */}
              {hotRegions && (
                <div className="mt-4 p-2 bg-blue-50 rounded">
                  <div className="font-medium text-sm">
                    {optimizationPhase === 'refined' ? 'Refining Within:' : 'Promising Parameter Ranges:'}
                  </div>
                  <div className="text-xs mt-1">
                    <div>Buy RSI: {hotRegions.buyRsi.min.toFixed(1)} - {hotRegions.buyRsi.max.toFixed(1)}</div>
                    <div>Buy CV: {hotRegions.buyCv.min.toFixed(1)} - {hotRegions.buyCv.max.toFixed(1)}</div>
                    <div>Sell RSI: {hotRegions.sellRsi.min.toFixed(1)} - {hotRegions.sellRsi.max.toFixed(1)}</div>
                    <div>Sell CV: {hotRegions.sellCv.min.toFixed(1)} - {hotRegions.sellCv.max.toFixed(1)}</div>
                  </div>
                </div>
              )}

              {/* >>> Add a small toggle for "Show All Signals" */}
              <div className="flex items-center justify-between">
                <label htmlFor="toggleAllSignals" className="text-sm font-medium">
                  Show All Signals
                </label>
                <input
                  id="toggleAllSignals"
                  type="checkbox"
                  checked={showAllSignals}
                  onChange={() => setShowAllSignals(!showAllSignals)}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

