import { describe, it, expect } from 'vitest';
import { TickMath } from '../../src/utils/tickMath';

describe('TickMath', () => {
  describe('tickToPrice', () => {
    it('should convert tick 0 to price 1', () => {
      expect(TickMath.tickToPrice(0)).toBe(1);
    });
    
    it('should handle positive ticks correctly', () => {
      // tick 6932 should give approximately 2
      expect(TickMath.tickToPrice(6932)).toBeCloseTo(2, 4);
      
      // tick 13863 should give approximately 4
      expect(TickMath.tickToPrice(13863)).toBeCloseTo(4, 2);
    });
    
    it('should handle negative ticks correctly', () => {
      // tick -6932 should give approximately 0.5
      expect(TickMath.tickToPrice(-6932)).toBeCloseTo(0.5, 4);
      
      // tick -13863 should give approximately 0.25
      expect(TickMath.tickToPrice(-13863)).toBeCloseTo(0.25, 4);
    });
    
    it('should throw error for out of bounds ticks', () => {
      expect(() => TickMath.tickToPrice(TickMath.MAX_TICK + 1)).toThrow('out of bounds');
      expect(() => TickMath.tickToPrice(TickMath.MIN_TICK - 1)).toThrow('out of bounds');
    });
    
    it('should handle edge cases near bounds', () => {
      // Should not throw
      expect(() => TickMath.tickToPrice(TickMath.MAX_TICK)).not.toThrow();
      expect(() => TickMath.tickToPrice(TickMath.MIN_TICK)).not.toThrow();
    });
  });
  
  describe('priceToTick', () => {
    it('should convert price 1 to tick 0', () => {
      expect(TickMath.priceToTick(1)).toBe(0);
    });
    
    it('should handle prices greater than 1', () => {
      // Price 2 should give approximately tick 6932
      expect(TickMath.priceToTick(2)).toBeGreaterThanOrEqual(6931);
      expect(TickMath.priceToTick(2)).toBeLessThanOrEqual(6932);
      
      // Price 4 should give approximately tick 13863
      expect(TickMath.priceToTick(4)).toBeGreaterThanOrEqual(13862);
      expect(TickMath.priceToTick(4)).toBeLessThanOrEqual(13864);
    });
    
    it('should handle prices less than 1', () => {
      // Price 0.5 should give approximately tick -6932
      expect(TickMath.priceToTick(0.5)).toBeGreaterThanOrEqual(-6933);
      expect(TickMath.priceToTick(0.5)).toBeLessThanOrEqual(-6931);
      
      // Price 0.25 should give approximately tick -13863
      expect(TickMath.priceToTick(0.25)).toBeGreaterThanOrEqual(-13864);
      expect(TickMath.priceToTick(0.25)).toBeLessThanOrEqual(-13862);
    });
    
    it('should throw error for invalid prices', () => {
      expect(() => TickMath.priceToTick(0)).toThrow('Price must be positive');
      expect(() => TickMath.priceToTick(-1)).toThrow('Price must be positive');
    });
    
    it('should be inverse of tickToPrice within rounding', () => {
      const testTicks = [-10000, -1000, -100, 0, 100, 1000, 10000];
      
      for (const tick of testTicks) {
        const price = TickMath.tickToPrice(tick);
        const recoveredTick = TickMath.priceToTick(price);
        // Should be within 1 tick due to rounding
        expect(Math.abs(recoveredTick - tick)).toBeLessThanOrEqual(1);
      }
    });
  });
  
  describe('getSqrtPriceX96FromTick', () => {
    it('should return correct value for tick 0', () => {
      const sqrtPriceX96 = TickMath.getSqrtPriceX96FromTick(0);
      // sqrt(1) * 2^96 = 2^96
      expect(sqrtPriceX96).toBe(TickMath.Q96);
    });
    
    it('should handle known test cases from Uniswap', () => {
      // Test cases from Uniswap v3 tests
      // Tick 0 should return Q96
      expect(TickMath.getSqrtPriceX96FromTick(0)).toBe(TickMath.Q96);
      
      // Min and max ticks should return valid values
      const minSqrtPrice = TickMath.getSqrtPriceX96FromTick(TickMath.MIN_TICK);
      const maxSqrtPrice = TickMath.getSqrtPriceX96FromTick(TickMath.MAX_TICK);
      
      // These should be valid sqrt prices
      expect(minSqrtPrice).toBeGreaterThan(0n);
      expect(maxSqrtPrice).toBeGreaterThan(0n);
      // Max tick should give a much larger sqrt price than min tick
      expect(maxSqrtPrice / minSqrtPrice).toBeGreaterThan(1000000n);
    });
    
    it('should cache results for repeated calls', () => {
      // Clear cache first
      TickMath['SQRT_PRICE_CACHE'].clear();
      
      const tick = 1000;
      const firstCall = TickMath.getSqrtPriceX96FromTick(tick);
      const secondCall = TickMath.getSqrtPriceX96FromTick(tick);
      
      // Should return same value
      expect(firstCall).toBe(secondCall);
      
      // Cache should contain the value
      expect(TickMath['SQRT_PRICE_CACHE'].has(tick)).toBe(true);
    });
    
    it('should handle negative ticks correctly', () => {
      const positiveTick = 1000;
      const negativeTick = -1000;
      
      const positiveSqrtPrice = TickMath.getSqrtPriceX96FromTick(positiveTick);
      const negativeSqrtPrice = TickMath.getSqrtPriceX96FromTick(negativeTick);
      
      // Negative tick should give reciprocal relationship
      // sqrt(1.0001^1000) * sqrt(1.0001^-1000) = sqrt(1) = 1
      const product = (positiveSqrtPrice * negativeSqrtPrice) / TickMath.Q96;
      // Should be approximately Q96 (allowing for rounding)
      expect(product).toBeGreaterThan(TickMath.Q96 - 1000000n);
      expect(product).toBeLessThan(TickMath.Q96 + 1000000n);
    });
  });
  
  describe('getTickFromSqrtPriceX96', () => {
    it('should convert Q96 to tick 0', () => {
      expect(TickMath.getTickFromSqrtPriceX96(TickMath.Q96)).toBe(0);
    });
    
    it('should handle edge cases', () => {
      // Get actual min/max sqrt prices
      const minSqrtPrice = TickMath.getSqrtPriceX96FromTick(TickMath.MIN_TICK);
      const maxSqrtPrice = TickMath.getSqrtPriceX96FromTick(TickMath.MAX_TICK);
      
      // Should be able to convert back (with some rounding)
      const recoveredMinTick = TickMath.getTickFromSqrtPriceX96(minSqrtPrice);
      const recoveredMaxTick = TickMath.getTickFromSqrtPriceX96(maxSqrtPrice);
      
      expect(Math.abs(recoveredMinTick - TickMath.MIN_TICK)).toBeLessThanOrEqual(1);
      expect(Math.abs(recoveredMaxTick - TickMath.MAX_TICK)).toBeLessThanOrEqual(1);
    });
    
    it('should throw for out of bounds values', () => {
      expect(() => TickMath.getTickFromSqrtPriceX96(0n)).toThrow('out of bounds');
      expect(() => TickMath.getTickFromSqrtPriceX96(2n ** 160n)).toThrow('out of bounds');
    });
  });
  
  describe('getAmount0ForLiquidity', () => {
    it('should calculate correct amount0 for a position', () => {
      const sqrtPriceAX96 = TickMath.getSqrtPriceX96FromTick(-1000);
      const sqrtPriceBX96 = TickMath.getSqrtPriceX96FromTick(1000);
      const liquidity = 1000000n;
      
      const amount0 = TickMath.getAmount0ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, liquidity);
      
      // Should be positive
      expect(amount0).toBeGreaterThan(0n);
    });
    
    it('should handle swapped price arguments', () => {
      const sqrtPriceAX96 = TickMath.getSqrtPriceX96FromTick(-1000);
      const sqrtPriceBX96 = TickMath.getSqrtPriceX96FromTick(1000);
      const liquidity = 1000000n;
      
      const amount1 = TickMath.getAmount0ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, liquidity);
      const amount2 = TickMath.getAmount0ForLiquidity(sqrtPriceBX96, sqrtPriceAX96, liquidity);
      
      // Should give same result regardless of order
      expect(amount1).toBe(amount2);
    });
  });
  
  describe('getAmount1ForLiquidity', () => {
    it('should calculate correct amount1 for a position', () => {
      const sqrtPriceAX96 = TickMath.getSqrtPriceX96FromTick(-1000);
      const sqrtPriceBX96 = TickMath.getSqrtPriceX96FromTick(1000);
      const liquidity = 1000000n;
      
      const amount1 = TickMath.getAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, liquidity);
      
      // Should be positive
      expect(amount1).toBeGreaterThan(0n);
    });
    
    it('should handle swapped price arguments', () => {
      const sqrtPriceAX96 = TickMath.getSqrtPriceX96FromTick(-1000);
      const sqrtPriceBX96 = TickMath.getSqrtPriceX96FromTick(1000);
      const liquidity = 1000000n;
      
      const amount1 = TickMath.getAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, liquidity);
      const amount2 = TickMath.getAmount1ForLiquidity(sqrtPriceBX96, sqrtPriceAX96, liquidity);
      
      // Should give same result regardless of order
      expect(amount1).toBe(amount2);
    });
  });
});