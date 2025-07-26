# Task 3: Core Mathematics

## Overview
**Owner**: Developer B  
**Duration**: 2 hours  
**Dependencies**: Task 1 (Project Foundation) ✅  
**Directory**: `src/utils/`

## Objectives
- Implement Uniswap v3 math functions
- Ensure compatibility with Cloudflare's number handling
- Create efficient tick/price conversions
- Build band calculation logic for position ranges

## Deliverables

### 1. Tick Math (`src/utils/tickMath.ts`)
Core mathematical functions for Uniswap v3 tick conversions:

```typescript
export class TickMath {
  static readonly Q96 = 2n ** 96n;
  static readonly Q128 = 2n ** 128n;
  
  /**
   * Converts a tick to a price (token1/token0)
   */
  static tickToPrice(tick: number): number {
    return Math.pow(1.0001, tick);
  }
  
  /**
   * Converts a price to the nearest tick
   */
  static priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }
  
  /**
   * Gets sqrtPriceX96 from tick
   * Implementation based on Uniswap v3 math
   */
  static getSqrtPriceX96FromTick(tick: number): bigint {
    const absTick = tick < 0 ? -tick : tick;
    let ratio = absTick & 0x1 !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;
    
    if (absTick & 0x2 !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
    if (absTick & 0x4 !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
    if (absTick & 0x8 !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
    if (absTick & 0x10 !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
    if (absTick & 0x20 !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
    if (absTick & 0x40 !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
    if (absTick & 0x80 !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
    if (absTick & 0x100 !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
    if (absTick & 0x200 !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
    if (absTick & 0x400 !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
    if (absTick & 0x800 !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
    if (absTick & 0x1000 !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
    if (absTick & 0x2000 !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
    if (absTick & 0x4000 !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
    if (absTick & 0x8000 !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
    if (absTick & 0x10000 !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
    if (absTick & 0x20000 !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
    if (absTick & 0x40000 !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
    if (absTick & 0x80000 !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;
    
    if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;
    
    // Shift to get sqrtPriceX96
    return ratio >> 32n;
  }
}
```

### 2. Band Calculator (`src/utils/bandCalculator.ts`)
Logic for calculating position ranges based on basis points:

```typescript
export class BandCalculator {
  /**
   * Calculates upper and lower ticks for a position
   * @param currentTick - Current pool tick
   * @param basisPoints - Total band width in basis points (1 bp = 1 tick)
   * @param tickSpacing - Pool's tick spacing (1, 10, 60, or 200)
   * @returns Object with tickLower and tickUpper
   */
  static calculateBand(
    currentTick: number,
    basisPoints: number,
    tickSpacing: number = 1
  ): { tickLower: number; tickUpper: number } {
    const halfBand = Math.floor(basisPoints / 2);
    
    // Calculate raw bounds
    const rawLower = currentTick - halfBand;
    const rawUpper = currentTick + halfBand;
    
    // Align to tick spacing
    return {
      tickLower: Math.floor(rawLower / tickSpacing) * tickSpacing,
      tickUpper: Math.ceil(rawUpper / tickSpacing) * tickSpacing
    };
  }
  
  /**
   * Checks if current tick is within a position's range
   */
  static isInRange(
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): boolean {
    return currentTick >= tickLower && currentTick < tickUpper;
  }
  
  /**
   * Calculates how far out of range a position is (in ticks)
   */
  static getOutOfRangeDistance(
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): number {
    if (currentTick < tickLower) {
      return tickLower - currentTick;
    } else if (currentTick >= tickUpper) {
      return currentTick - tickUpper + 1;
    }
    return 0; // In range
  }
  
  /**
   * Converts tick spacing to fee tier
   */
  static tickSpacingToFeeTier(tickSpacing: number): number {
    const mapping: { [key: number]: number } = {
      1: 100,      // 0.01%
      10: 500,     // 0.05%
      60: 3000,    // 0.30%
      200: 10000   // 1.00%
    };
    return mapping[tickSpacing] || 3000;
  }
}
```

### 3. Fee Calculator (`src/utils/feeCalculator.ts`)
Calculate uncollected fees for positions:

```typescript
export class FeeCalculator {
  /**
   * Calculates uncollected fees for a position
   * Simplified version for MVP - uses tokensOwed directly
   */
  static calculateUncollectedFees(
    position: {
      tokensOwed0: bigint;
      tokensOwed1: bigint;
    },
    feeGrowthGlobal0: bigint,
    feeGrowthGlobal1: bigint,
    decimals0: number = 6,
    decimals1: number = 6
  ): { token0: number; token1: number; totalUsd: number } {
    // Convert from smallest unit to decimal
    const fees0 = Number(position.tokensOwed0) / (10 ** decimals0);
    const fees1 = Number(position.tokensOwed1) / (10 ** decimals1);
    
    // For USDC/USDT pair, assume both are $1
    // In production, fetch actual prices
    return {
      token0: fees0,
      token1: fees1,
      totalUsd: fees0 + fees1
    };
  }
  
  /**
   * Estimates daily fee income based on current rate
   * @param currentFees - Current uncollected fees
   * @param hoursSinceLastCollection - Hours since fees were last collected
   */
  static estimateDailyFeeRate(
    currentFees: number,
    hoursSinceLastCollection: number
  ): number {
    if (hoursSinceLastCollection === 0) return 0;
    const hourlyRate = currentFees / hoursSinceLastCollection;
    return hourlyRate * 24;
  }
  
  /**
   * Calculates fee APR for a position
   * @param dailyFees - Estimated daily fee income in USD
   * @param positionValueUsd - Total position value in USD
   */
  static calculateFeeAPR(
    dailyFees: number,
    positionValueUsd: number
  ): number {
    if (positionValueUsd === 0) return 0;
    return (dailyFees * 365 / positionValueUsd) * 100;
  }
}
```

### 4. Index Export (`src/utils/index.ts`)
Barrel export for clean imports:

```typescript
export * from './tickMath';
export * from './bandCalculator';
export * from './feeCalculator';
```

## Cloudflare-Specific Considerations

### BigInt Operations
- Cloudflare Workers support BigInt natively
- Be mindful of CPU time when doing complex BigInt math
- Cache frequently used calculations

### Number Precision
- JavaScript numbers lose precision above 2^53
- Use BigInt for all Uniswap math involving X96/X128
- Convert to regular numbers only for display

### Performance Optimization
```typescript
// Cache expensive calculations
const TICK_TO_SQRT_PRICE_CACHE = new Map<number, bigint>();

function getCachedSqrtPrice(tick: number): bigint {
  if (!TICK_TO_SQRT_PRICE_CACHE.has(tick)) {
    TICK_TO_SQRT_PRICE_CACHE.set(tick, TickMath.getSqrtPriceX96FromTick(tick));
  }
  return TICK_TO_SQRT_PRICE_CACHE.get(tick)!;
}
```

## Testing Requirements

### Unit Tests (`test/utils/`)
- Test tick/price conversions with known values
- Verify band calculations align to tick spacing
- Test edge cases (negative ticks, extreme values)
- Verify fee calculations

### Test Cases
```typescript
describe('TickMath', () => {
  it('should convert tick 0 to price 1', () => {
    expect(TickMath.tickToPrice(0)).toBe(1);
  });
  
  it('should handle negative ticks', () => {
    expect(TickMath.tickToPrice(-6932)).toBeCloseTo(0.5, 4);
  });
});

describe('BandCalculator', () => {
  it('should align to tick spacing', () => {
    const result = BandCalculator.calculateBand(5, 10, 10);
    expect(result.tickLower).toBe(0);
    expect(result.tickUpper).toBe(10);
  });
});
```

## Acceptance Criteria
- [ ] All math functions return correct values matching Uniswap v3
- [ ] BigInt operations work correctly in Workers environment
- [ ] Calculations complete quickly without timeout issues
- [ ] Band alignment works correctly for all tick spacings
- [ ] Fee calculations are accurate
- [ ] All unit tests pass

## Implementation Notes

1. **Start with Tests**: Write tests first using known values from Uniswap docs
2. **Verify Against Mainnet**: Compare calculations with actual pool data
3. **Optimize Later**: Get it working first, then optimize if needed
4. **Document Edge Cases**: Clear comments for non-obvious math

## References
- [Uniswap v3 Math](https://docs.uniswap.org/contracts/v3/reference/core/libraries/TickMath)
- [Uniswap v3 Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [Tick and Price Relationship](https://docs.uniswap.org/contracts/v3/concepts/tick-spacing)

## Common Pitfalls to Avoid
1. **Integer Division**: Always use BigInt for intermediate calculations
2. **Tick Spacing**: Remember different pools have different tick spacings
3. **Price Direction**: tick to price is 1.0001^tick (not 0.9999^tick)
4. **Range Boundaries**: Upper tick is exclusive, lower is inclusive