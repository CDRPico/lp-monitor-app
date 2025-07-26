# How Math Functions Generate Rebalancing Suggestions

## Overview

The core mathematics module provides the foundation for making intelligent rebalancing decisions. Here's how each component contributes to generating actionable suggestions for users.

## 🧮 The Math Functions and Their Roles

### 1. **TickMath** - Price and Position Calculations

**What it does:**
- Converts between ticks and prices
- Calculates sqrt prices for Uniswap v3 math
- Determines token amounts for given liquidity

**How it helps with suggestions:**
```typescript
// Example: Check if price moved significantly
const depositPrice = TickMath.tickToPrice(depositTick);  // e.g., 1.0
const currentPrice = TickMath.tickToPrice(currentTick);  // e.g., 1.15
const priceChange = (currentPrice - depositPrice) / depositPrice; // 15% move

// Suggestion: "Price has moved 15% since deposit - consider rebalancing"
```

### 2. **BandCalculator** - Range Management

**What it does:**
- Calculates position ranges from basis points
- Checks if current price is in range
- Measures distance from range boundaries

**How it helps with suggestions:**
```typescript
// Example: Detect out-of-range positions
const isInRange = BandCalculator.isInRange(currentTick, tickLower, tickUpper);
const distance = BandCalculator.getOutOfRangeDistance(currentTick, tickLower, tickUpper);

if (!isInRange) {
  // Suggestion: "Position is out of range by 523 ticks (5.3% price move)"
}

// Example: Warn about boundary proximity
const rangePosition = BandCalculator.getRangePosition(currentTick, tickLower, tickUpper);
if (rangePosition > 90) {
  // Suggestion: "Price at 92% of range - approaching upper boundary"
}
```

### 3. **FeeCalculator** - Profitability Analysis

**What it does:**
- Calculates uncollected fees in USD
- Estimates daily fee income
- Computes APR from fees
- Analyzes gas cost vs fee income

**How it helps with suggestions:**
```typescript
// Example: Determine if rebalancing is profitable
const rebalanceAnalysis = FeeCalculator.calculateRebalanceThreshold(
  gasCostUsd: 25,
  dailyFeesUsd: 20,
  thresholdMultiplier: 3
);

if (rebalanceAnalysis.shouldRebalance) {
  // Suggestion: "Rebalancing profitable - gas costs recoverable in 1.25 days"
} else {
  // Suggestion: "Wait - would take 5 days to recover gas costs"
}
```

### 4. **EnhancedFeeCalculator** - Advanced Analysis

**What it does:**
- Calculates proper concentrated liquidity IL
- Uses real token prices for accurate USD values
- Recommends optimal position widths
- Provides comprehensive rebalancing analysis

**How it helps with suggestions:**
```typescript
// Example: IL-based recommendations
const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
  position, initialSqrtPrice, currentSqrtPrice
);

if (il.impermanentLossPercent < -5) {
  // Suggestion: "5.2% impermanent loss detected - consider rebalancing to capture gains"
}

// Example: Optimal position recommendations
const optimal = EnhancedFeeCalculator.calculateOptimalPositionWidth(
  volatility: 0.02,
  feeRate: 0.003,
  liquidityDepth: 0.1
);
// Suggestion: "Recommended range: ±4.3% (860 basis points) based on current volatility"
```

## 📊 Complete Decision Flow

Here's how all functions work together to generate suggestions:

### Step 1: Assess Current State
```typescript
// Check position status
const isInRange = BandCalculator.isInRange(currentTick, tickLower, tickUpper);
const rangeUtilization = BandCalculator.getRangePosition(currentTick, tickLower, tickUpper);
const daysOutOfRange = isInRange ? 0 : calculateDaysSinceOutOfRange();
```

### Step 2: Calculate Financial Metrics
```typescript
// Calculate fees and APR
const fees = await calculator.calculateUncollectedFees(position, poolInfo);
const dailyFeeRate = FeeCalculator.estimateDailyFeeRate(fees.totalUsd, hoursSinceLastCollection);
const currentAPR = FeeCalculator.calculateFeeAPR(dailyFeeRate, positionValueUsd);

// Calculate IL
const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
  position, initialSqrtPrice, currentSqrtPrice
);
```

### Step 3: Evaluate Triggers
```typescript
const triggers = {
  outOfRange: !isInRange,
  timeCap: daysOutOfRange > 1,        // 24-hour rule
  highGasRatio: gasCost / dailyFees > 3,
  nearBoundary: rangeUtilization > 90 || rangeUtilization < 10,
  highIL: Math.abs(il) > 5,
  lowAPR: currentAPR < 10
};
```

### Step 4: Generate Suggestion
```typescript
if (triggers.outOfRange && triggers.timeCap) {
  return {
    action: 'REBALANCE_NOW',
    urgency: 'critical',
    reason: 'Position out of range for over 24 hours'
  };
} else if (triggers.outOfRange && gasCost < dailyFees * 3) {
  return {
    action: 'REBALANCE_NOW',
    urgency: 'high',
    reason: 'Out of range and gas costs recoverable in < 3 days'
  };
} else if (triggers.nearBoundary) {
  return {
    action: 'MONITOR_CLOSELY',
    urgency: 'medium',
    reason: 'Price approaching range boundary'
  };
}
```

## 🎯 Real-World Examples

### Example 1: Profitable Rebalance
```
Current State:
- Position: -1000 to 1000 ticks
- Current tick: 2000 (out of range)
- Uncollected fees: $20
- Time out of range: 12 hours
- Gas cost: $22.50

Analysis:
✓ Out of range: YES
✓ Daily fee rate: $40 (projected)
✓ Gas payback: 0.56 days
✓ APR improvement: +225%

Suggestion: REBALANCE NOW (High Priority)
"Position is earning no fees while out of range. Rebalancing costs will be recovered in less than 1 day, and APR will improve from 73% to 298%."
```

### Example 2: Wait Despite Being Out of Range
```
Current State:
- Position: -100 to 100 ticks (very narrow)
- Current tick: 500 (out of range)
- Uncollected fees: $2
- Time out of range: 6 hours
- Gas cost: $22.50

Analysis:
✓ Out of range: YES
✓ Daily fee rate: $8
✓ Gas payback: 2.8 days
✓ High gas/fee ratio: YES

Suggestion: MONITOR CLOSELY (Medium Priority)
"While out of range, gas costs are high relative to expected fees. Consider waiting for gas prices to drop or fees to accumulate. Monitor for 24-hour time cap."
```

### Example 3: Collect Fees Only
```
Current State:
- Position: -500 to 500 ticks
- Current tick: 0 (centered)
- Uncollected fees: $100
- APR: 35%
- Gas cost (collect): $10

Analysis:
✓ In range: YES
✓ Good APR: YES
✓ High uncollected fees: YES

Suggestion: COLLECT FEES (Low Priority)
"Position performing well with 35% APR. $100 in fees ready to collect. No rebalancing needed."
```

## 🔧 Customization Options

The math functions allow customizing suggestion logic:

### Risk Tolerance
```typescript
const optimalRange = EnhancedFeeCalculator.calculateOptimalPositionWidth(
  volatility,
  feeRate,
  liquidityDepth,
  'low'    // Conservative: wider ranges, less IL risk
  'medium' // Balanced approach
  'high'   // Aggressive: tighter ranges, more fees but more IL
);
```

### Time Preferences
```typescript
// Adjust time cap for out-of-range positions
const timeCap = userPreference.maxHoursOutOfRange || 24;

// Adjust gas payback threshold
const maxDaysToBreakeven = userPreference.maxGasPayback || 3;
```

### APR Targets
```typescript
// Set minimum acceptable APR
const minAcceptableAPR = userPreference.minAPR || 10;

// Set improvement threshold for rebalancing
const minAPRImprovement = userPreference.minImprovement || 5;
```

## Summary

The math functions work together to:
1. **Monitor** position health (in/out of range, proximity to boundaries)
2. **Calculate** financial metrics (fees, APR, IL, gas costs)
3. **Evaluate** multiple triggers and conditions
4. **Generate** specific, actionable suggestions with clear reasoning

This creates a sophisticated decision engine that helps users maximize returns while managing risks and costs effectively.