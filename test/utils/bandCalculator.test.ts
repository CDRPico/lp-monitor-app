import { describe, it, expect } from 'vitest';
import { BandCalculator } from '../../src/utils/bandCalculator';

describe('BandCalculator', () => {
  describe('calculateBand', () => {
    it('should calculate symmetric band around current tick', () => {
      const currentTick = 0;
      const basisPoints = 100;
      const result = BandCalculator.calculateBand(currentTick, basisPoints, 1);
      
      expect(result.tickLower).toBe(-50);
      expect(result.tickUpper).toBe(50);
    });
    
    it('should align to tick spacing of 10', () => {
      const currentTick = 5;
      const basisPoints = 100;
      const result = BandCalculator.calculateBand(currentTick, basisPoints, 10);
      
      // -45 rounded down to -50, 55 rounded up to 60
      expect(result.tickLower).toBe(-50);
      expect(result.tickUpper).toBe(60);
    });
    
    it('should align to tick spacing of 60', () => {
      const currentTick = 100;
      const basisPoints = 200;
      const result = BandCalculator.calculateBand(currentTick, basisPoints, 60);
      
      // 0 is already aligned, 200 rounds up to 240
      expect(result.tickLower).toBe(0);
      expect(result.tickUpper).toBe(240);
    });
    
    it('should align to tick spacing of 200', () => {
      const currentTick = 1000;
      const basisPoints = 500;
      const result = BandCalculator.calculateBand(currentTick, basisPoints, 200);
      
      // 750 rounds down to 600, 1250 rounds up to 1400
      expect(result.tickLower).toBe(600);
      expect(result.tickUpper).toBe(1400);
    });
    
    it('should handle odd basis points', () => {
      const currentTick = 0;
      const basisPoints = 99; // Odd number
      const result = BandCalculator.calculateBand(currentTick, basisPoints, 1);
      
      // halfBand = floor(99/2) = 49
      expect(result.tickLower).toBe(-49);
      expect(result.tickUpper).toBe(49);
    });
    
    it('should throw error for invalid inputs', () => {
      expect(() => BandCalculator.calculateBand(0, 0, 1)).toThrow('Basis points must be positive');
      expect(() => BandCalculator.calculateBand(0, -100, 1)).toThrow('Basis points must be positive');
      expect(() => BandCalculator.calculateBand(0, 100, 5)).toThrow('Invalid tick spacing');
    });
    
    it('should work with negative current ticks', () => {
      const currentTick = -1000;
      const basisPoints = 200;
      const result = BandCalculator.calculateBand(currentTick, basisPoints, 10);
      
      expect(result.tickLower).toBe(-1100);
      expect(result.tickUpper).toBe(-900);
    });
  });
  
  describe('isInRange', () => {
    it('should return true when tick is within range', () => {
      expect(BandCalculator.isInRange(0, -100, 100)).toBe(true);
      expect(BandCalculator.isInRange(50, -100, 100)).toBe(true);
      expect(BandCalculator.isInRange(-50, -100, 100)).toBe(true);
    });
    
    it('should return true when tick equals lower bound', () => {
      expect(BandCalculator.isInRange(-100, -100, 100)).toBe(true);
    });
    
    it('should return false when tick equals upper bound', () => {
      // Upper bound is exclusive
      expect(BandCalculator.isInRange(100, -100, 100)).toBe(false);
    });
    
    it('should return false when tick is out of range', () => {
      expect(BandCalculator.isInRange(-101, -100, 100)).toBe(false);
      expect(BandCalculator.isInRange(101, -100, 100)).toBe(false);
    });
  });
  
  describe('getOutOfRangeDistance', () => {
    it('should return 0 when in range', () => {
      expect(BandCalculator.getOutOfRangeDistance(0, -100, 100)).toBe(0);
      expect(BandCalculator.getOutOfRangeDistance(-100, -100, 100)).toBe(0);
      expect(BandCalculator.getOutOfRangeDistance(99, -100, 100)).toBe(0);
    });
    
    it('should calculate distance when below range', () => {
      expect(BandCalculator.getOutOfRangeDistance(-150, -100, 100)).toBe(50);
      expect(BandCalculator.getOutOfRangeDistance(-101, -100, 100)).toBe(1);
    });
    
    it('should calculate distance when above range', () => {
      expect(BandCalculator.getOutOfRangeDistance(100, -100, 100)).toBe(1);
      expect(BandCalculator.getOutOfRangeDistance(150, -100, 100)).toBe(51);
    });
  });
  
  describe('getRangePosition', () => {
    it('should return 0% at lower bound', () => {
      expect(BandCalculator.getRangePosition(-100, -100, 100)).toBe(0);
    });
    
    it('should return 50% at middle', () => {
      expect(BandCalculator.getRangePosition(0, -100, 100)).toBe(50);
    });
    
    it('should return close to 100% near upper bound', () => {
      expect(BandCalculator.getRangePosition(99, -100, 100)).toBeCloseTo(99.5, 1);
    });
    
    it('should return null when out of range', () => {
      expect(BandCalculator.getRangePosition(-101, -100, 100)).toBeNull();
      expect(BandCalculator.getRangePosition(100, -100, 100)).toBeNull();
    });
    
    it('should handle asymmetric ranges', () => {
      expect(BandCalculator.getRangePosition(50, 0, 200)).toBe(25);
      expect(BandCalculator.getRangePosition(150, 0, 200)).toBe(75);
    });
  });
  
  describe('tickSpacingToFeeTier', () => {
    it('should convert standard tick spacings correctly', () => {
      expect(BandCalculator.tickSpacingToFeeTier(1)).toBe(100);
      expect(BandCalculator.tickSpacingToFeeTier(10)).toBe(500);
      expect(BandCalculator.tickSpacingToFeeTier(60)).toBe(3000);
      expect(BandCalculator.tickSpacingToFeeTier(200)).toBe(10000);
    });
    
    it('should throw error for unknown tick spacing', () => {
      expect(() => BandCalculator.tickSpacingToFeeTier(5)).toThrow('Unknown tick spacing');
      expect(() => BandCalculator.tickSpacingToFeeTier(100)).toThrow('Unknown tick spacing');
    });
  });
  
  describe('feeTierToTickSpacing', () => {
    it('should convert standard fee tiers correctly', () => {
      expect(BandCalculator.feeTierToTickSpacing(100)).toBe(1);
      expect(BandCalculator.feeTierToTickSpacing(500)).toBe(10);
      expect(BandCalculator.feeTierToTickSpacing(3000)).toBe(60);
      expect(BandCalculator.feeTierToTickSpacing(10000)).toBe(200);
    });
    
    it('should throw error for unknown fee tier', () => {
      expect(() => BandCalculator.feeTierToTickSpacing(250)).toThrow('Unknown fee tier');
      expect(() => BandCalculator.feeTierToTickSpacing(5000)).toThrow('Unknown fee tier');
    });
  });
  
  describe('calculateOptimalBandWidth', () => {
    it('should calculate band width based on volatility', () => {
      const lowVolBand = BandCalculator.calculateOptimalBandWidth(0.01, 3000);
      const highVolBand = BandCalculator.calculateOptimalBandWidth(0.05, 3000);
      
      // Higher volatility should result in wider bands
      expect(highVolBand).toBeGreaterThan(lowVolBand);
    });
    
    it('should adjust for fee tier', () => {
      const lowFeeBand = BandCalculator.calculateOptimalBandWidth(0.02, 100);
      const highFeeBand = BandCalculator.calculateOptimalBandWidth(0.02, 10000);
      
      // Higher fees should allow tighter bands
      expect(highFeeBand).toBeLessThan(lowFeeBand);
    });
    
    it('should return reasonable values', () => {
      const band = BandCalculator.calculateOptimalBandWidth(0.02, 3000, 0.20);
      
      // Should be positive and reasonable
      expect(band).toBeGreaterThan(0);
      expect(band).toBeLessThan(10000); // Reasonable upper bound
    });
  });
  
  describe('isAlignedToSpacing', () => {
    it('should return true for aligned ticks', () => {
      expect(BandCalculator.isAlignedToSpacing(0, 1)).toBe(true);
      expect(BandCalculator.isAlignedToSpacing(100, 10)).toBe(true);
      expect(BandCalculator.isAlignedToSpacing(120, 60)).toBe(true);
      expect(BandCalculator.isAlignedToSpacing(1000, 200)).toBe(true);
    });
    
    it('should return false for misaligned ticks', () => {
      expect(BandCalculator.isAlignedToSpacing(5, 10)).toBe(false);
      expect(BandCalculator.isAlignedToSpacing(101, 60)).toBe(false);
      expect(BandCalculator.isAlignedToSpacing(999, 200)).toBe(false);
    });
    
    it('should handle negative ticks', () => {
      expect(BandCalculator.isAlignedToSpacing(-100, 10)).toBe(true);
      expect(BandCalculator.isAlignedToSpacing(-95, 10)).toBe(false);
    });
  });
  
  describe('alignToSpacing', () => {
    it('should round down by default', () => {
      expect(BandCalculator.alignToSpacing(5, 10)).toBe(0);
      expect(BandCalculator.alignToSpacing(15, 10)).toBe(10);
      expect(BandCalculator.alignToSpacing(119, 60)).toBe(60);
    });
    
    it('should round up when specified', () => {
      expect(BandCalculator.alignToSpacing(5, 10, true)).toBe(10);
      expect(BandCalculator.alignToSpacing(15, 10, true)).toBe(20);
      expect(BandCalculator.alignToSpacing(119, 60, true)).toBe(120);
    });
    
    it('should handle already aligned ticks', () => {
      expect(BandCalculator.alignToSpacing(100, 10)).toBe(100);
      expect(BandCalculator.alignToSpacing(100, 10, true)).toBe(100);
    });
    
    it('should handle negative ticks', () => {
      expect(BandCalculator.alignToSpacing(-95, 10)).toBe(-100);
      expect(BandCalculator.alignToSpacing(-95, 10, true)).toBe(-90);
    });
  });
});