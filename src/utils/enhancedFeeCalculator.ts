/**
 * Enhanced fee calculator with proper Uniswap v3 impermanent loss
 * and real price integration
 */

import { TickMath } from './tickMath';
import { PriceOracle } from './priceOracle';

export interface Position {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export interface PoolInfo {
  token0: string;
  token1: string;
  decimals0: number;
  decimals1: number;
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
  currentTick: number;
  sqrtPriceX96: bigint;
}

export class EnhancedFeeCalculator {
  constructor(private priceOracle: PriceOracle) {}
  
  /**
   * Calculate uncollected fees with real USD values
   */
  async calculateUncollectedFees(
    position: Position,
    poolInfo: PoolInfo
  ): Promise<{ 
    token0: number; 
    token1: number; 
    token0Usd: number;
    token1Usd: number;
    totalUsd: number;
  }> {
    // Convert from smallest unit to decimal
    const fees0 = Number(position.tokensOwed0) / (10 ** poolInfo.decimals0);
    const fees1 = Number(position.tokensOwed1) / (10 ** poolInfo.decimals1);
    
    // Get real prices
    const [price0, price1] = await Promise.all([
      this.priceOracle.getTokenPrice(poolInfo.token0),
      this.priceOracle.getTokenPrice(poolInfo.token1)
    ]);
    
    const token0Usd = fees0 * price0;
    const token1Usd = fees1 * price1;
    
    return {
      token0: fees0,
      token1: fees1,
      token0Usd,
      token1Usd,
      totalUsd: token0Usd + token1Usd
    };
  }
  
  /**
   * Calculate proper Uniswap v3 impermanent loss
   * This accounts for concentrated liquidity positions
   */
  static calculateConcentratedImpermanentLoss(
    position: Position,
    initialSqrtPriceX96: bigint,
    currentSqrtPriceX96: bigint
  ): {
    impermanentLossPercent: number;
    token0Amount: number;
    token1Amount: number;
    initialValue: number;
    currentValue: number;
  } {
    // Get sqrt prices for position bounds
    const sqrtPriceLowerX96 = TickMath.getSqrtPriceX96FromTick(position.tickLower);
    const sqrtPriceUpperX96 = TickMath.getSqrtPriceX96FromTick(position.tickUpper);
    
    // Calculate initial amounts
    const initialAmounts = this.getPositionAmounts(
      position.liquidity,
      initialSqrtPriceX96,
      sqrtPriceLowerX96,
      sqrtPriceUpperX96
    );
    
    // Calculate current amounts
    const currentAmounts = this.getPositionAmounts(
      position.liquidity,
      currentSqrtPriceX96,
      sqrtPriceLowerX96,
      sqrtPriceUpperX96
    );
    
    // Calculate initial value (in terms of token0)
    const initialPrice = this.sqrtPriceX96ToPrice(initialSqrtPriceX96);
    const initialValue = Number(initialAmounts.amount0) + Number(initialAmounts.amount1) * initialPrice;
    
    // Calculate current value if we had held the initial amounts
    const currentPrice = this.sqrtPriceX96ToPrice(currentSqrtPriceX96);
    const holdValue = Number(initialAmounts.amount0) + Number(initialAmounts.amount1) * currentPrice;
    
    // Calculate actual current value
    const currentValue = Number(currentAmounts.amount0) + Number(currentAmounts.amount1) * currentPrice;
    
    // IL = (current value / hold value) - 1
    const impermanentLossPercent = holdValue > 0 
      ? ((currentValue / holdValue) - 1) * 100 
      : 0;
    
    return {
      impermanentLossPercent,
      token0Amount: Number(currentAmounts.amount0),
      token1Amount: Number(currentAmounts.amount1),
      initialValue: Number(initialValue),
      currentValue: Number(currentValue)
    };
  }
  
  /**
   * Calculate position amounts at a given price
   * This is the core of Uniswap v3 position math
   */
  private static getPositionAmounts(
    liquidity: bigint,
    sqrtPriceX96: bigint,
    sqrtPriceLowerX96: bigint,
    sqrtPriceUpperX96: bigint
  ): { amount0: bigint; amount1: bigint } {
    // Position is completely in token1
    if (sqrtPriceX96 <= sqrtPriceLowerX96) {
      return {
        amount0: TickMath.getAmount0ForLiquidity(
          sqrtPriceLowerX96,
          sqrtPriceUpperX96,
          liquidity
        ),
        amount1: 0n
      };
    }
    
    // Position is completely in token0
    if (sqrtPriceX96 >= sqrtPriceUpperX96) {
      return {
        amount0: 0n,
        amount1: TickMath.getAmount1ForLiquidity(
          sqrtPriceLowerX96,
          sqrtPriceUpperX96,
          liquidity
        )
      };
    }
    
    // Position is in range - has both tokens
    return {
      amount0: TickMath.getAmount0ForLiquidity(
        sqrtPriceX96,
        sqrtPriceUpperX96,
        liquidity
      ),
      amount1: TickMath.getAmount1ForLiquidity(
        sqrtPriceLowerX96,
        sqrtPriceX96,
        liquidity
      )
    };
  }
  
  /**
   * Convert sqrtPriceX96 to human readable price
   */
  private static sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    // price = (sqrtPriceX96 / 2^96)^2
    const Q96 = 2n ** 96n;
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    return sqrtPrice * sqrtPrice;
  }
  
  /**
   * Calculate if rebalancing is profitable considering gas costs
   */
  async shouldRebalance(
    position: Position,
    poolInfo: PoolInfo,
    estimatedGasUnits: bigint,
    gasPriceGwei: number
  ): Promise<{
    shouldRebalance: boolean;
    reason: string;
    metrics: {
      dailyFeesUsd: number;
      gasCostUsd: number;
      daysToBreakeven: number;
      currentIL: number;
    }
  }> {
    // Calculate current fees
    const fees = await this.calculateUncollectedFees(position, poolInfo);
    
    // Estimate daily fee rate (assuming 24h since last collection)
    const dailyFeesUsd = fees.totalUsd;
    
    // Calculate gas cost in USD
    const gasPrice = gasPriceGwei * 1e-9; // Convert gwei to ETH
    const gasCostEth = Number(estimatedGasUnits) * gasPrice;
    const ethPrice = await this.priceOracle.getTokenPrice('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'); // WETH
    const gasCostUsd = gasCostEth * ethPrice;
    
    // Calculate current IL
    const currentTick = poolInfo.currentTick;
    const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
      position,
      poolInfo.sqrtPriceX96, // Assuming position was created at current price
      poolInfo.sqrtPriceX96
    );
    
    // Decision logic
    const daysToBreakeven = dailyFeesUsd > 0 ? gasCostUsd / dailyFeesUsd : Infinity;
    
    // Check if position is out of range
    const isOutOfRange = currentTick < position.tickLower || currentTick >= position.tickUpper;
    
    let shouldRebalance = false;
    let reason = '';
    
    if (isOutOfRange && daysToBreakeven < 3) {
      shouldRebalance = true;
      reason = 'Position out of range and gas cost recoverable in < 3 days';
    } else if (Math.abs(il.impermanentLossPercent) > 5 && daysToBreakeven < 7) {
      shouldRebalance = true;
      reason = 'High impermanent loss (>5%) and reasonable gas costs';
    } else if (isOutOfRange) {
      reason = 'Out of range but gas costs too high relative to fees';
    } else {
      reason = 'In range and IL acceptable';
    }
    
    return {
      shouldRebalance,
      reason,
      metrics: {
        dailyFeesUsd,
        gasCostUsd,
        daysToBreakeven,
        currentIL: il.impermanentLossPercent
      }
    };
  }
  
  /**
   * Calculate optimal position width based on volatility and fees
   * Uses historical data to optimize fee capture vs IL risk
   */
  static calculateOptimalPositionWidth(
    volatility: number,       // Daily volatility as decimal
    feeRate: number,         // Pool fee rate as decimal
    liquidityDepth: number,  // Average liquidity in range as % of total
    riskTolerance: 'low' | 'medium' | 'high' = 'medium'
  ): {
    recommendedBasisPoints: number;
    expectedDailyReturn: number;
    maxExpectedIL: number;
  } {
    // Base width on volatility - wider for more volatile pairs
    const volatilityMultiplier = Math.sqrt(volatility * 365); // Annualized
    
    // Adjust for fee tier - tighter ranges for higher fees
    const feeMultiplier = Math.sqrt(0.003 / feeRate); // Normalized to 0.3%
    
    // Adjust for liquidity competition
    const competitionMultiplier = 1 / Math.sqrt(liquidityDepth);
    
    // Risk tolerance adjustments
    const riskMultipliers = {
      low: 1.5,      // Wider ranges, less IL risk
      medium: 1.0,   // Balanced
      high: 0.7      // Tighter ranges, more fees but more IL risk
    };
    
    // Calculate recommended width in basis points
    const baseBps = 100; // Start with 1% (100 bps)
    const recommendedBasisPoints = Math.round(
      baseBps * 
      volatilityMultiplier * 
      feeMultiplier * 
      competitionMultiplier * 
      riskMultipliers[riskTolerance]
    );
    
    // Estimate returns (simplified model)
    const concentrationBonus = 100 / recommendedBasisPoints; // How concentrated we are
    const expectedDailyReturn = feeRate * concentrationBonus * liquidityDepth;
    
    // Estimate max IL based on range width
    const rangeWidth = recommendedBasisPoints / 10000; // Convert to decimal
    const maxExpectedIL = rangeWidth * volatility * Math.sqrt(365);
    
    return {
      recommendedBasisPoints,
      expectedDailyReturn: expectedDailyReturn * 100, // As percentage
      maxExpectedIL: maxExpectedIL * 100 // As percentage
    };
  }
}