Below is a high-level documentation of the changes and features we've introduced. This is intended to provide a clear reference on what has been done, why it was done, and how it all fits together.
---
Overview
We started with a React component (ChartContainer) that loads price data for a given pool address using GeckoTerminal's API and displays an interactive chart (using Lightweight Charts). The user can adjust certain “buy” and “sell” parameters (RSI, Chaikin Volatility (CV)) to see how a strategy would theoretically perform.
Over time, we added:
Brute-force parameter search (later replaced/augmented by hill-climbing).
Real-time chart updates and trade analytics each time parameters are changed.
A multi-phase approach for optimization (crude search, refined search).
Hill-climbing with random restarts, then updated to run for five seconds at a time.
UI changes to move the “Optimize” button near the “Buy Parameters” heading, making it an icon button with a tooltip.
Real-time slider updates/animation during hill-climb optimization (showing how parameters change while testing).
Automatic resetting of strategy parameters when the user changes to a new pool address.
Below is a more detailed breakdown.
---
1. Basic Parameter Management
Initially, the component used separate state variables for each parameter:
buyRsiThreshold
buyCvThreshold
sellRsiThreshold
sellCvThreshold
These indicate the thresholds for entering and exiting trades based on RSI and Chaikin Volatility. Using React’s built-in useState ensures these controls remain reactive.
We also introduced:
• testParams: A state variable that holds whichever parameters are currently being tested by the optimizer (so the UI can show “Testing: X” while optimizing).
• bestParams: A state variable that holds the best combination found so far (i.e., the highest profit that meets some criteria like minimum trades).
---
2. Parameter Brute Force (Superseded by Hill Climb)
For some time, we used a brute-force technique to test every possible combination of RSI and CV parameters. This was effective but slow and cluttered. It tested all parameter combinations and updated the chart each time. We later replaced it with a more efficient hill-climbing approach.
---
3. Hill-Climbing Optimization
We introduced a “hill-climbing with random restarts” algorithm to find better parameter combinations without enumerating the entire parameter space:
We define a set of bounds (e.g., 0–100 for RSI).
We pick a random set of parameters and evaluate profit via updateChartWithParameters.
We randomly tweak one parameter (± stepSize).
If it improves profit (and has a minimum number of trades), we keep it. Otherwise, we revert to the previous parameters.
Repeat for many iterations.
We do random restarts to avoid local maxima. This was wrapped in:
runOneHillClimb (performs one hill-climb).
runHillClimbForFiveSeconds (repeatedly calls runOneHillClimb for 5 seconds).
We also included an optional slowdown (await new Promise(resolve => setTimeout(resolve, 0 or 50))) so the UI remains responsive, and users can see parameters changing.
---
4. updateChartWithParameters
This function:
• Clears existing chart markers.
• Recalculates RSI and Chaikin Volatility arrays.
• Iterates over the data; if RSI/CV conditions are met for BUY or SELL, it adds chart markers.
• Creates a trades array for each buy-sell pair, updating a notional “currentPortfolioValue” from 1000 to measure total % change.
• Passes that final % change and trade list to the tradeAnalytics state.
• Returns the profit (percentage change) and number of trades for immediate use by the optimizer.
Because it returns profit and number of trades, the optimizer can directly compare those results without waiting for asynchronous state updates.
---
5. UI Changes: Icon Button for Optimization
We moved (or replaced) the old “Optimize” button with an icon button (using Lucide React’s Rocket icon).
• On hover, we show a small tooltip with text “Hill Climb Optimization.”
• When clicked, it triggers runHillClimbForFiveSeconds.
This is done by:
Importing the Rocket icon at the top.
Using <Button variant="ghost" size="icon" …> with an absolutely positioned tooltip.
---
6. Real-time Slider Updates
To animate the parameter sliders during optimization, we do two things:
When the optimizer picks a new candidate param set, we call setTestParams(...).
The input range elements check isOptimizing ? testParams.buyRsi : buyRsiThreshold so the slider is forced to whichever param the optimizer is testing.
Hence, while isOptimizing is true, the parameter sliders reflect testParams, updated every iteration in runOneHillClimb.
---
7. Reset Parameters on New Pool
When the user enters a different pool address, we added code to fetchData so it resets:
buyRsiThreshold, buyCvThreshold, sellRsiThreshold, sellCvThreshold to default values (e.g., 40, -19.9, 72, 65).
bestParams, highestProfit, etc.
This ensures that the new pool starts fresh and doesn’t reuse leftover parameters from prior optimization.
---
8. Two-phase Search (Optional)
Some code references a “crude” and “refined” approach:
Crude search identifies a “hot region.”
Refined search focuses on that region with finer increments.
However, this approach has been largely superseded by hill climbing. You can still keep or remove it if you want a two-step approach.
---
9. Trade Analytics & Highest Profit Found
We maintain a separate tradeAnalytics state for showing current portfolio value, total % return, and listing consecutive trades. We also maintain a highestProfit object that stores:
• The best profit found so far.
• The parameter set that achieved that profit.
So even if you run multiple optimization attempts, you’ll see the best overall result remains saved.
---
10. Summary of Key Functions and States
• fetchData:
– Loads data from GeckoTerminal.
– Resets parameters on each new pool.
• updateChartWithParameters(rsi, cvBuy, rsiSell, cvSell):
– Applies signals based on RSI and CV thresholds.
– Updates chart markers.
– Calculates and stores final % profit.
– Returns { profit, numTrades }.
• runOneHillClimb():
– A single hill-climbing run with maxIterations.
– Tries random neighbors until no improvement.
– Returns the best found param set.
• runHillClimbForFiveSeconds():
– Repeatedly calls runOneHillClimb until 5s have elapsed.
– Applies improvements to bestParams, chart, etc.
– Slows down slightly to animate the parameter sliders.
• State variables:
– (buyRsiThreshold, buyCvThreshold, sellRsiThreshold, sellCvThreshold): Synchronized to user sliders.
– (testParams): The parameters currently being tested.
– (bestParams): The best combination found by the optimizer.
– (highestProfit): The best overall profit and its parameters.
– (tradeAnalytics): Current trade analytics, updated with each parameter set.
– (isOptimizing): Boolean that disables UI changes during optimization.
---
Closing Notes
With these optimizations and UI updates:
• The user can run a 5-second hill climb to tweak parameters.
• The sliders “dance” around as they test different combinations.
• We track the best combos and final results.
• Switching pool addresses starts fresh.
This setup provides a more dynamic and interactive optimization experience, letting you quickly see how different trading parameters perform on various liquidity pools. You can further enhance it by modifying step sizes, iteration counts, or introducing advanced search heuristics (like simulated annealing or gradient-based methods, if a differentiable model is used).
If you have any more ideas or run into issues, feel free to extend the logic or ask away. Happy optimizing!
