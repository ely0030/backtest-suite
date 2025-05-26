import { useState, useCallback } from 'react';
import { generateTradingSignals, SignalParameters } from '@/lib/technical-analysis';

export interface OptimizationBounds {
  buyRsi: { min: number; max: number };
  buyCv: { min: number; max: number };
  sellRsi: { min: number; max: number };
  sellCv: { min: number; max: number };
}

export interface OptimizationResult extends SignalParameters {
  maxProfit: number;
  numTrades: number;
}

export interface UseOptimizationProps {
  ohlcvData: { time: number; open: number; high: number; low: number; close: number }[] | null;
  onParametersUpdate: (params: SignalParameters) => void;
}

export function useOptimization({ ohlcvData, onParametersUpdate }: UseOptimizationProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [testParams, setTestParams] = useState<SignalParameters>({
    buyRsiThreshold: 40,
    buyCvThreshold: -19.9,
    sellRsiThreshold: 72,
    sellCvThreshold: 65
  });
  const [bestParams, setBestParams] = useState<OptimizationResult>({
    buyRsiThreshold: 40,
    buyCvThreshold: -19.9,
    sellRsiThreshold: 72,
    sellCvThreshold: 65,
    maxProfit: -Infinity,
    numTrades: 0
  });
  const [highestProfit, setHighestProfit] = useState({
    profit: -Infinity,
    params: {
      buyRsiThreshold: 40,
      buyCvThreshold: -19.9,
      sellRsiThreshold: 72,
      sellCvThreshold: 65
    }
  });

  const bounds: OptimizationBounds = {
    buyRsi: { min: 0, max: 100 },
    buyCv: { min: -50, max: 0 },
    sellRsi: { min: 0, max: 100 },
    sellCv: { min: 0, max: 400 },
  };

  const clamp = useCallback((val: number, min: number, max: number) => {
    return Math.max(min, Math.min(val, max));
  }, []);

  const randInt = useCallback((min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, []);

  const randomParams = useCallback((): SignalParameters => {
    return {
      buyRsiThreshold: randInt(bounds.buyRsi.min, bounds.buyRsi.max),
      buyCvThreshold: randInt(bounds.buyCv.min, bounds.buyCv.max),
      sellRsiThreshold: randInt(bounds.sellRsi.min, bounds.sellRsi.max),
      sellCvThreshold: randInt(bounds.sellCv.min, bounds.sellCv.max),
    };
  }, [bounds, randInt]);

  const randomNeighbor = useCallback((params: SignalParameters): SignalParameters => {
    const neighbor = { ...params };
    const paramKeys = ["buyRsiThreshold", "buyCvThreshold", "sellRsiThreshold", "sellCvThreshold"] as const;
    const chosenKey = paramKeys[Math.floor(Math.random() * paramKeys.length)];
    const stepSize = 5;

    const delta = Math.random() < 0.5 ? -stepSize : stepSize;

    if (chosenKey === "buyRsiThreshold" || chosenKey === "sellRsiThreshold") {
      const boundKey = chosenKey === "buyRsiThreshold" ? "buyRsi" : "sellRsi";
      neighbor[chosenKey] = clamp(neighbor[chosenKey] + delta, bounds[boundKey].min, bounds[boundKey].max);
    } else {
      const boundKey = chosenKey === "buyCvThreshold" ? "buyCv" : "sellCv";
      neighbor[chosenKey] = clamp(neighbor[chosenKey] + delta, bounds[boundKey].min, bounds[boundKey].max);
    }
    
    return neighbor;
  }, [bounds, clamp]);

  const runOneHillClimb = useCallback((): OptimizationResult => {
    if (!ohlcvData) {
      return { ...testParams, maxProfit: -Infinity, numTrades: 0 };
    }

    const maxIterations = 300;
    
    // Start from a random position
    let current: OptimizationResult = { 
      ...randomParams(), 
      maxProfit: -Infinity, 
      numTrades: 0 
    };

    // Evaluate initial
    const initialResult = generateTradingSignals(ohlcvData, current);
    current.maxProfit = initialResult.profit;
    current.numTrades = initialResult.numTrades;

    // Run hill climb (removed frequent setTestParams calls)
    for (let iter = 0; iter < maxIterations; iter++) {
      const candidate = randomNeighbor(current);
      const result = generateTradingSignals(ohlcvData, candidate);
      
      if (result.profit > current.maxProfit && result.numTrades >= 3) {
        current = {
          ...candidate,
          maxProfit: result.profit,
          numTrades: result.numTrades
        };
        
        // Only update test params when we find a better solution
        setTestParams(current);
      }
    }
    
    return current;
  }, [ohlcvData, randomParams, randomNeighbor]);

  const runHillClimbForFiveSeconds = useCallback(async () => {
    setIsOptimizing(true);

    const startTime = Date.now();
    let localBest = { ...bestParams };
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 200; // Only update UI every 200ms

    try {
      while (Date.now() - startTime < 5000) {
        const attempt = runOneHillClimb();
        if (attempt.maxProfit > localBest.maxProfit) {
          localBest = attempt;
          
          // Throttle UI updates to prevent jank
          const now = Date.now();
          if (now - lastUpdateTime >= UPDATE_THROTTLE) {
            setBestParams(localBest);
            onParametersUpdate({
              buyRsiThreshold: localBest.buyRsiThreshold,
              buyCvThreshold: localBest.buyCvThreshold,
              sellRsiThreshold: localBest.sellRsiThreshold,
              sellCvThreshold: localBest.sellCvThreshold
            });
            lastUpdateTime = now;
          }
        }
        // Add a small delay to make the animation more visible
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final update with best parameters found
      setBestParams(localBest);
      onParametersUpdate({
        buyRsiThreshold: localBest.buyRsiThreshold,
        buyCvThreshold: localBest.buyCvThreshold,
        sellRsiThreshold: localBest.sellRsiThreshold,
        sellCvThreshold: localBest.sellCvThreshold
      });

      // Update highest profit if we found a better one
      if (localBest.maxProfit > highestProfit.profit) {
        setHighestProfit({
          profit: localBest.maxProfit,
          params: {
            buyRsiThreshold: localBest.buyRsiThreshold,
            buyCvThreshold: localBest.buyCvThreshold,
            sellRsiThreshold: localBest.sellRsiThreshold,
            sellCvThreshold: localBest.sellCvThreshold
          }
        });
      }
    } finally {
      setIsOptimizing(false);
    }
  }, [runOneHillClimb]); // Simplified dependencies

  const resetParameters = useCallback(() => {
    const defaultParams = {
      buyRsiThreshold: 40,
      buyCvThreshold: -19.9,
      sellRsiThreshold: 72,
      sellCvThreshold: 65
    };
    
    setTestParams(defaultParams);
    setBestParams({
      ...defaultParams,
      maxProfit: -Infinity,
      numTrades: 0
    });
    setHighestProfit({
      profit: -Infinity,
      params: defaultParams
    });
  }, []); // No dependencies to prevent re-creation

  return {
    isOptimizing,
    testParams,
    bestParams,
    highestProfit,
    runHillClimbForFiveSeconds,
    resetParameters
  };
}