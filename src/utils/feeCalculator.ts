/**
 * Calculate uncollected fees and fee-related metrics for positions
 * Handles fee APR calculations and profitability analysis
 */

export class FeeCalculator {
  /**
   * Calculates uncollected fees for a position
   * Simplified version for MVP - uses tokensOwed directly
   * In production, would calculate from feeGrowthInside
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
    // Validate decimals
    if (decimals0 < 0 || decimals0 > 18 || decimals1 < 0 || decimals1 > 18) {
      throw new Error('Invalid token decimals');
    }
    
    // Convert from smallest unit to decimal
    const fees0 = Number(position.tokensOwed0) / (10 ** decimals0);
    const fees1 = Number(position.tokensOwed1) / (10 ** decimals1);
    
    // For USDC/USDT pair, assume both are $1
    // In production, fetch actual prices from oracle
    const price0 = 1; // USD per token0
    const price1 = 1; // USD per token1
    
    return {
      token0: fees0,
      token1: fees1,
      totalUsd: (fees0 * price0) + (fees1 * price1)
    };
  }
  
  /**
   * Estimates daily fee income based on current rate
   * @param currentFees - Current uncollected fees in USD
   * @param hoursSinceLastCollection - Hours since fees were last collected
   */
  static estimateDailyFeeRate(
    currentFees: number,
    hoursSinceLastCollection: number
  ): number {
    if (hoursSinceLastCollection <= 0) return 0;
    if (currentFees < 0) {
      throw new Error('Current fees cannot be negative');
    }
    
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
    if (positionValueUsd <= 0) return 0;
    if (dailyFees < 0) {
      throw new Error('Daily fees cannot be negative');
    }
    
    // APR = (daily fees * 365 / position value) * 100%
    return (dailyFees * 365 / positionValueUsd) * 100;
  }
  
  /**
   * Calculates the gas cost threshold for profitable rebalancing
   * @param estimatedGasCost - Estimated gas cost in USD
   * @param dailyFees - Daily fee income in USD
   * @param thresholdMultiplier - Multiplier for gas cost (default 3x)
   */
  static calculateRebalanceThreshold(
    estimatedGasCost: number,
    dailyFees: number,
    thresholdMultiplier: number = 3
  ): { shouldRebalance: boolean; daysToBreakeven: number } {
    if (estimatedGasCost < 0 || dailyFees < 0 || thresholdMultiplier <= 0) {
      throw new Error('Invalid input parameters');
    }
    
    // Don't rebalance if daily fees are too low
    if (dailyFees === 0) {
      return {
        shouldRebalance: false,
        daysToBreakeven: Infinity
      };
    }
    
    const daysToBreakeven = estimatedGasCost / dailyFees;
    const shouldRebalance = daysToBreakeven <= thresholdMultiplier;
    
    return {
      shouldRebalance,
      daysToBreakeven
    };
  }
  
  /**
   * Calculates cumulative fees earned over a time period
   * @param feeRate - Fee rate (e.g., 0.003 for 0.3%)
   * @param volume - Trading volume over the period
   * @param liquidityShare - Position's share of total liquidity (0-1)
   */
  static calculateExpectedFees(
    feeRate: number,
    volume: number,
    liquidityShare: number
  ): number {
    if (feeRate < 0 || feeRate > 1) {
      throw new Error('Fee rate must be between 0 and 1');
    }
    if (liquidityShare < 0 || liquidityShare > 1) {
      throw new Error('Liquidity share must be between 0 and 1');
    }
    if (volume < 0) {
      throw new Error('Volume cannot be negative');
    }
    
    return volume * feeRate * liquidityShare;
  }
  
  /**
   * Converts fee tier from basis points to decimal
   * @param feeTier - Fee tier in basis points (e.g., 3000 for 0.3%)
   */
  static feeTierToDecimal(feeTier: number): number {
    return feeTier / 1_000_000; // Convert from basis points to decimal
  }
  
  /**
   * Calculates impermanent loss for a position
   * Simplified calculation - assumes position was minted at range center
   * @param initialPrice - Price when position was created
   * @param currentPrice - Current price
   * @param tickLower - Lower tick of position
   * @param tickUpper - Upper tick of position
   */
  static estimateImpermanentLoss(
    initialPrice: number,
    currentPrice: number,
    tickLower: number,
    tickUpper: number
  ): number {
    // If price hasn't moved, no IL
    if (initialPrice === currentPrice) return 0;
    
    // Calculate price bounds
    const priceLower = Math.pow(1.0001, tickLower);
    const priceUpper = Math.pow(1.0001, tickUpper);
    
    // Simplified IL calculation
    // In production, would use full Uniswap v3 IL formula
    const priceRatio = currentPrice / initialPrice;
    
    // If still in range, calculate concentrated IL
    if (currentPrice >= priceLower && currentPrice <= priceUpper) {
      // Concentrated positions have higher IL than full range
      const concentrationFactor = Math.sqrt(priceUpper / priceLower);
      const il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
      return Math.abs(il) * concentrationFactor;
    } else {
      // Out of range - IL is locked in
      if (currentPrice < priceLower) {
        return Math.abs(1 - priceLower / initialPrice);
      } else {
        return Math.abs(1 - priceUpper / initialPrice);
      }
    }
  }
  
  /**
   * Calculates net APR including fees and impermanent loss
   * @param feeAPR - Annual fee return percentage
   * @param impermanentLoss - Impermanent loss percentage
   * @param timeHorizonDays - Time horizon for IL calculation
   */
  static calculateNetAPR(
    feeAPR: number,
    impermanentLoss: number,
    timeHorizonDays: number = 365
  ): number {
    // Annualize the impermanent loss
    const annualizedIL = (impermanentLoss / timeHorizonDays) * 365;
    
    // Net APR = Fee APR - Annualized IL
    return feeAPR - annualizedIL;
  }
}