import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedFeeCalculator, Position, PoolInfo } from '../../src/utils/enhancedFeeCalculator';
import { PriceOracle, createStablecoinOracle } from '../../src/utils/priceOracle';
import { TickMath } from '../../src/utils/tickMath';

describe('EnhancedFeeCalculator', () => {
  let calculator: EnhancedFeeCalculator;
  let priceOracle: PriceOracle;
  
  beforeEach(() => {
    priceOracle = createStablecoinOracle();
    calculator = new EnhancedFeeCalculator(priceOracle);
  });
  
  describe('calculateUncollectedFees with real prices', () => {
    it('should calculate fees with actual USD values', async () => {
      const position: Position = {
        tickLower: -887272,
        tickUpper: 887272,
        liquidity: 1000000n,
        tokensOwed0: 1000000n, // 1 USDC (6 decimals)
        tokensOwed1: 2000000n  // 2 USDT (6 decimals)
      };
      
      const poolInfo: PoolInfo = {
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        decimals0: 6,
        decimals1: 6,
        feeGrowthGlobal0X128: 0n,
        feeGrowthGlobal1X128: 0n,
        currentTick: 0,
        sqrtPriceX96: TickMath.Q96
      };
      
      const fees = await calculator.calculateUncollectedFees(position, poolInfo);
      
      expect(fees.token0).toBe(1); // 1 USDC
      expect(fees.token1).toBe(2); // 2 USDT
      expect(fees.token0Usd).toBe(1); // $1
      expect(fees.token1Usd).toBe(2); // $2
      expect(fees.totalUsd).toBe(3);  // $3 total
    });
  });
  
  describe('calculateConcentratedImpermanentLoss', () => {
    it('should calculate no IL when price unchanged', () => {
      const position: Position = {
        tickLower: -6932,  // ~0.5
        tickUpper: 6932,   // ~2.0
        liquidity: 1000000000n,
        tokensOwed0: 0n,
        tokensOwed1: 0n
      };
      
      const currentPrice = TickMath.Q96; // Price = 1
      
      const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
        position,
        currentPrice,
        currentPrice // No price change
      );
      
      expect(il.impermanentLossPercent).toBe(0);
    });
    
    it('should calculate IL for out of range position', () => {
      const position: Position = {
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: 1000000000n,
        tokensOwed0: 0n,
        tokensOwed1: 0n
      };
      
      const initialPrice = TickMath.getSqrtPriceX96FromTick(0); // Price = 1
      const currentPrice = TickMath.getSqrtPriceX96FromTick(2000); // Price > upper bound
      
      const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
        position,
        initialPrice,
        currentPrice
      );
      
      // When out of range, position is 100% in one token
      expect(il.impermanentLossPercent).toBeLessThan(0); // Negative IL (loss)
      expect(il.token1Amount).toBeGreaterThan(0); // All in token1
      expect(il.token0Amount).toBe(0); // No token0
    });
    
    it('should show higher IL for concentrated positions', () => {
      // Wide range position
      const widePosition: Position = {
        tickLower: -20000,
        tickUpper: 20000,
        liquidity: 1000000000n,
        tokensOwed0: 0n,
        tokensOwed1: 0n
      };
      
      // Narrow range position (same liquidity)
      const narrowPosition: Position = {
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: 1000000000n,
        tokensOwed0: 0n,
        tokensOwed1: 0n
      };
      
      const initialPrice = TickMath.getSqrtPriceX96FromTick(0);
      const currentPrice = TickMath.getSqrtPriceX96FromTick(500); // Small price move
      
      const wideIL = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
        widePosition,
        initialPrice,
        currentPrice
      );
      
      const narrowIL = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
        narrowPosition,
        initialPrice,
        currentPrice
      );
      
      // Concentrated positions experience more IL for same price movement
      expect(Math.abs(narrowIL.impermanentLossPercent)).toBeGreaterThan(
        Math.abs(wideIL.impermanentLossPercent)
      );
    });
  });
  
  describe('shouldRebalance', () => {
    it('should recommend rebalancing when out of range with low gas costs', async () => {
      const position: Position = {
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: 1000000000n,
        tokensOwed0: 10000000n, // 10 USDC in fees
        tokensOwed1: 10000000n  // 10 USDT in fees
      };
      
      const poolInfo: PoolInfo = {
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        decimals0: 6,
        decimals1: 6,
        feeGrowthGlobal0X128: 0n,
        feeGrowthGlobal1X128: 0n,
        currentTick: 2000, // Out of range!
        sqrtPriceX96: TickMath.getSqrtPriceX96FromTick(2000)
      };
      
      // Mock ETH price
      const oracle = new PriceOracle({
        staticPrices: {
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1.0, // USDC
          '0xdAC17F958D2ee523a2206206994597C13D831ec7': 1.0, // USDT
          '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 2000 // ETH
        }
      });
      
      const enhancedCalc = new EnhancedFeeCalculator(oracle);
      
      const result = await enhancedCalc.shouldRebalance(
        position,
        poolInfo,
        200000n, // 200k gas units
        30       // 30 gwei
      );
      
      expect(result.shouldRebalance).toBe(true);
      expect(result.reason).toContain('out of range');
      expect(result.metrics.dailyFeesUsd).toBe(20); // $20 in fees
      expect(result.metrics.gasCostUsd).toBeCloseTo(12); // 200k * 30 gwei * $2000
      expect(result.metrics.daysToBreakeven).toBeLessThan(1); // Profitable
    });
  });
  
  describe('calculateOptimalPositionWidth', () => {
    it('should recommend wider ranges for volatile pairs', () => {
      const lowVolResult = EnhancedFeeCalculator.calculateOptimalPositionWidth(
        0.01,   // 1% daily volatility
        0.003,  // 0.3% fee tier
        0.1,    // 10% of liquidity in range
        'medium'
      );
      
      const highVolResult = EnhancedFeeCalculator.calculateOptimalPositionWidth(
        0.05,   // 5% daily volatility
        0.003,  // 0.3% fee tier
        0.1,    // 10% of liquidity in range
        'medium'
      );
      
      expect(highVolResult.recommendedBasisPoints).toBeGreaterThan(
        lowVolResult.recommendedBasisPoints
      );
      expect(highVolResult.maxExpectedIL).toBeGreaterThan(
        lowVolResult.maxExpectedIL
      );
    });
    
    it('should recommend tighter ranges for higher fee tiers', () => {
      const lowFeeResult = EnhancedFeeCalculator.calculateOptimalPositionWidth(
        0.02,    // 2% daily volatility
        0.0005,  // 0.05% fee tier
        0.1,     // 10% of liquidity in range
        'medium'
      );
      
      const highFeeResult = EnhancedFeeCalculator.calculateOptimalPositionWidth(
        0.02,   // 2% daily volatility
        0.01,   // 1% fee tier
        0.1,    // 10% of liquidity in range
        'medium'
      );
      
      expect(highFeeResult.recommendedBasisPoints).toBeLessThan(
        lowFeeResult.recommendedBasisPoints
      );
    });
    
    it('should adjust for risk tolerance', () => {
      const baseParams = [0.02, 0.003, 0.1] as const;
      
      const lowRisk = EnhancedFeeCalculator.calculateOptimalPositionWidth(
        ...baseParams,
        'low'
      );
      
      const highRisk = EnhancedFeeCalculator.calculateOptimalPositionWidth(
        ...baseParams,
        'high'
      );
      
      expect(lowRisk.recommendedBasisPoints).toBeGreaterThan(
        highRisk.recommendedBasisPoints
      );
      expect(lowRisk.maxExpectedIL).toBeLessThan(highRisk.maxExpectedIL);
      expect(highRisk.expectedDailyReturn).toBeGreaterThan(
        lowRisk.expectedDailyReturn
      );
    });
  });
});