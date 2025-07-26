import { describe, it, expect } from 'vitest';
import { FeeCalculator } from '../../src/utils/feeCalculator';

describe('FeeCalculator', () => {
  describe('calculateUncollectedFees', () => {
    it('should calculate fees correctly for USDC/USDT pair', () => {
      const position = {
        tokensOwed0: 1000000n, // 1 USDC (6 decimals)
        tokensOwed1: 2000000n  // 2 USDT (6 decimals)
      };
      
      const result = FeeCalculator.calculateUncollectedFees(
        position,
        0n, // Not used in simplified version
        0n,
        6,
        6
      );
      
      expect(result.token0).toBe(1);
      expect(result.token1).toBe(2);
      expect(result.totalUsd).toBe(3);
    });
    
    it('should handle different decimal places', () => {
      const position = {
        tokensOwed0: 1000000000000000000n, // 1 token with 18 decimals
        tokensOwed1: 1000000n               // 1 token with 6 decimals
      };
      
      const result = FeeCalculator.calculateUncollectedFees(
        position,
        0n,
        0n,
        18,
        6
      );
      
      expect(result.token0).toBe(1);
      expect(result.token1).toBe(1);
      expect(result.totalUsd).toBe(2);
    });
    
    it('should handle zero fees', () => {
      const position = {
        tokensOwed0: 0n,
        tokensOwed1: 0n
      };
      
      const result = FeeCalculator.calculateUncollectedFees(position, 0n, 0n);
      
      expect(result.token0).toBe(0);
      expect(result.token1).toBe(0);
      expect(result.totalUsd).toBe(0);
    });
    
    it('should validate decimals', () => {
      const position = { tokensOwed0: 0n, tokensOwed1: 0n };
      
      expect(() => 
        FeeCalculator.calculateUncollectedFees(position, 0n, 0n, -1, 6)
      ).toThrow('Invalid token decimals');
      
      expect(() => 
        FeeCalculator.calculateUncollectedFees(position, 0n, 0n, 6, 19)
      ).toThrow('Invalid token decimals');
    });
  });
  
  describe('estimateDailyFeeRate', () => {
    it('should calculate daily rate from hourly data', () => {
      const currentFees = 10; // $10 in 4 hours
      const hours = 4;
      
      const dailyRate = FeeCalculator.estimateDailyFeeRate(currentFees, hours);
      
      // $10/4h * 24h = $60/day
      expect(dailyRate).toBe(60);
    });
    
    it('should handle edge cases', () => {
      expect(FeeCalculator.estimateDailyFeeRate(0, 10)).toBe(0);
      expect(FeeCalculator.estimateDailyFeeRate(100, 0)).toBe(0);
    });
    
    it('should throw error for negative fees', () => {
      expect(() => 
        FeeCalculator.estimateDailyFeeRate(-10, 5)
      ).toThrow('Current fees cannot be negative');
    });
    
    it('should handle fractional hours', () => {
      const currentFees = 5;
      const hours = 0.5; // 30 minutes
      
      const dailyRate = FeeCalculator.estimateDailyFeeRate(currentFees, hours);
      
      // $5/0.5h * 24h = $240/day
      expect(dailyRate).toBe(240);
    });
  });
  
  describe('calculateFeeAPR', () => {
    it('should calculate APR correctly', () => {
      const dailyFees = 10; // $10/day
      const positionValue = 10000; // $10,000 position
      
      const apr = FeeCalculator.calculateFeeAPR(dailyFees, positionValue);
      
      // ($10 * 365 / $10,000) * 100 = 36.5%
      expect(apr).toBe(36.5);
    });
    
    it('should handle zero position value', () => {
      expect(FeeCalculator.calculateFeeAPR(10, 0)).toBe(0);
    });
    
    it('should handle zero daily fees', () => {
      expect(FeeCalculator.calculateFeeAPR(0, 10000)).toBe(0);
    });
    
    it('should throw error for negative values', () => {
      expect(() => 
        FeeCalculator.calculateFeeAPR(-10, 10000)
      ).toThrow('Daily fees cannot be negative');
    });
    
    it('should calculate high APRs correctly', () => {
      const dailyFees = 100;
      const positionValue = 1000;
      
      const apr = FeeCalculator.calculateFeeAPR(dailyFees, positionValue);
      
      // ($100 * 365 / $1000) * 100 = 3650%
      expect(apr).toBe(3650);
    });
  });
  
  describe('calculateRebalanceThreshold', () => {
    it('should recommend rebalancing when profitable', () => {
      const gasCost = 30; // $30
      const dailyFees = 20; // $20/day
      const threshold = 3; // 3x multiplier
      
      const result = FeeCalculator.calculateRebalanceThreshold(gasCost, dailyFees, threshold);
      
      // Days to breakeven: $30 / $20 = 1.5 days < 3 days
      expect(result.shouldRebalance).toBe(true);
      expect(result.daysToBreakeven).toBe(1.5);
    });
    
    it('should not recommend rebalancing when unprofitable', () => {
      const gasCost = 100;
      const dailyFees = 10;
      const threshold = 3;
      
      const result = FeeCalculator.calculateRebalanceThreshold(gasCost, dailyFees, threshold);
      
      // Days to breakeven: $100 / $10 = 10 days > 3 days
      expect(result.shouldRebalance).toBe(false);
      expect(result.daysToBreakeven).toBe(10);
    });
    
    it('should handle zero daily fees', () => {
      const result = FeeCalculator.calculateRebalanceThreshold(50, 0, 3);
      
      expect(result.shouldRebalance).toBe(false);
      expect(result.daysToBreakeven).toBe(Infinity);
    });
    
    it('should validate inputs', () => {
      expect(() => 
        FeeCalculator.calculateRebalanceThreshold(-10, 20, 3)
      ).toThrow('Invalid input parameters');
      
      expect(() => 
        FeeCalculator.calculateRebalanceThreshold(10, -20, 3)
      ).toThrow('Invalid input parameters');
      
      expect(() => 
        FeeCalculator.calculateRebalanceThreshold(10, 20, 0)
      ).toThrow('Invalid input parameters');
    });
  });
  
  describe('calculateExpectedFees', () => {
    it('should calculate fees from volume and liquidity share', () => {
      const feeRate = 0.003; // 0.3%
      const volume = 1000000; // $1M volume
      const liquidityShare = 0.1; // 10% of pool
      
      const fees = FeeCalculator.calculateExpectedFees(feeRate, volume, liquidityShare);
      
      // $1M * 0.003 * 0.1 = $300
      expect(fees).toBe(300);
    });
    
    it('should handle edge cases', () => {
      expect(FeeCalculator.calculateExpectedFees(0, 1000000, 0.1)).toBe(0);
      expect(FeeCalculator.calculateExpectedFees(0.003, 0, 0.1)).toBe(0);
      expect(FeeCalculator.calculateExpectedFees(0.003, 1000000, 0)).toBe(0);
    });
    
    it('should validate inputs', () => {
      expect(() => 
        FeeCalculator.calculateExpectedFees(-0.1, 1000000, 0.5)
      ).toThrow('Fee rate must be between 0 and 1');
      
      expect(() => 
        FeeCalculator.calculateExpectedFees(1.1, 1000000, 0.5)
      ).toThrow('Fee rate must be between 0 and 1');
      
      expect(() => 
        FeeCalculator.calculateExpectedFees(0.003, 1000000, -0.1)
      ).toThrow('Liquidity share must be between 0 and 1');
      
      expect(() => 
        FeeCalculator.calculateExpectedFees(0.003, -1000000, 0.5)
      ).toThrow('Volume cannot be negative');
    });
  });
  
  describe('feeTierToDecimal', () => {
    it('should convert standard fee tiers', () => {
      expect(FeeCalculator.feeTierToDecimal(100)).toBe(0.0001);
      expect(FeeCalculator.feeTierToDecimal(500)).toBe(0.0005);
      expect(FeeCalculator.feeTierToDecimal(3000)).toBe(0.003);
      expect(FeeCalculator.feeTierToDecimal(10000)).toBe(0.01);
    });
  });
  
  describe('estimateImpermanentLoss', () => {
    it('should return 0 when price hasnt moved', () => {
      const il = FeeCalculator.estimateImpermanentLoss(100, 100, -100, 100);
      expect(il).toBe(0);
    });
    
    it('should calculate IL for in-range position', () => {
      const initialPrice = 100;
      const currentPrice = 110; // 10% increase
      const tickLower = -1000;
      const tickUpper = 1000;
      
      const il = FeeCalculator.estimateImpermanentLoss(
        initialPrice,
        currentPrice,
        tickLower,
        tickUpper
      );
      
      // Should be positive (loss)
      expect(il).toBeGreaterThan(0);
    });
    
    it('should handle out of range positions', () => {
      const initialPrice = 100;
      const currentPrice = 50; // Price dropped 50%
      const tickLower = -100;
      const tickUpper = 100;
      
      const il = FeeCalculator.estimateImpermanentLoss(
        initialPrice,
        currentPrice,
        tickLower,
        tickUpper
      );
      
      // IL should be locked in when out of range
      expect(il).toBeGreaterThan(0);
    });
  });
  
  describe('calculateNetAPR', () => {
    it('should subtract annualized IL from fee APR', () => {
      const feeAPR = 50; // 50% fee APR
      const impermanentLoss = 10; // 10% IL
      const timeHorizon = 365; // 1 year
      
      const netAPR = FeeCalculator.calculateNetAPR(feeAPR, impermanentLoss, timeHorizon);
      
      // 50% - 10% = 40%
      expect(netAPR).toBe(40);
    });
    
    it('should annualize IL correctly', () => {
      const feeAPR = 50;
      const impermanentLoss = 5; // 5% IL over 30 days
      const timeHorizon = 30;
      
      const netAPR = FeeCalculator.calculateNetAPR(feeAPR, impermanentLoss, timeHorizon);
      
      // Annualized IL = 5% * (365/30) = 60.83%
      // Net = 50% - 60.83% = -10.83%
      expect(netAPR).toBeCloseTo(-10.83, 1);
    });
    
    it('should handle negative net APR', () => {
      const feeAPR = 10;
      const impermanentLoss = 20;
      const timeHorizon = 365;
      
      const netAPR = FeeCalculator.calculateNetAPR(feeAPR, impermanentLoss, timeHorizon);
      
      // Should be negative when IL exceeds fees
      expect(netAPR).toBe(-10);
    });
  });
});