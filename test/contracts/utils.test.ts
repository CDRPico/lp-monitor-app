/**
 * Unit tests for contract utilities
 */

import { describe, it, expect } from 'vitest';
import {
  computePoolAddress,
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  getAmountsForLiquidity,
  tickToSqrtPriceX96,
  sqrtPriceX96ToTick,
  calculateUncollectedFees,
  getFeeGrowthInside
} from '../../src/contracts/utils';

describe('Contract Utils', () => {
  describe('computePoolAddress', () => {
    it('should compute deterministic pool address', () => {
      // Example: USDC/WETH 0.3% pool on Arbitrum
      const token0 = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'; // WETH
      const token1 = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'; // USDC
      const fee = 3000;
      
      const poolAddress = computePoolAddress(token0, token1, fee, false);
      
      // Should return a valid address
      expect(poolAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(poolAddress.length).toBe(42);
    });

    it('should handle unsorted tokens correctly', () => {
      // Same tokens but in reverse order
      const token0 = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'; // USDC
      const token1 = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'; // WETH
      const fee = 3000;
      
      const poolAddress1 = computePoolAddress(token0, token1, fee, false);
      const poolAddress2 = computePoolAddress(token1, token0, fee, false);
      
      // Should produce the same address regardless of token order
      expect(poolAddress1).toBe(poolAddress2);
    });
  });

  describe('sqrtPriceX96ToPrice', () => {
    it('should convert sqrtPriceX96 to price correctly', () => {
      // Example: sqrtPriceX96 representing price ~= 1
      const sqrtPriceX96 = BigInt('79228162514264337593543950336'); // 2^96
      const decimals0 = 18;
      const decimals1 = 18;
      
      const price = sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);
      
      expect(price).toBeCloseTo(1, 5);
    });

    it('should handle different decimals correctly', () => {
      // When token0 has more decimals than token1, price should be adjusted up
      const sqrtPriceX96 = BigInt('1961964942763815959255092417280');
      const decimals0 = 18; // WETH (more decimals)
      const decimals1 = 6;  // USDC (fewer decimals)
      
      const price = sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);
      
      // Price represents WETH/USDC, but we need to verify the calculation is correct
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThan(1); // Since this represents WETH price in USDC terms (inverted)
    });
  });

  describe('priceToSqrtPriceX96', () => {
    it('should convert price to sqrtPriceX96 correctly', () => {
      const price = 1;
      const decimals0 = 18;
      const decimals1 = 18;
      
      const sqrtPriceX96 = priceToSqrtPriceX96(price, decimals0, decimals1);
      
      // Should be close to 2^96
      const expected = BigInt('79228162514264337593543950336');
      const diff = sqrtPriceX96 > expected ? sqrtPriceX96 - expected : expected - sqrtPriceX96;
      expect(Number(diff)).toBeLessThan(1000000000000000); // Allow small rounding error
    });
  });

  describe('getAmountsForLiquidity', () => {
    it('should calculate amounts when price is within range', () => {
      const liquidity = BigInt('1000000000000000000'); // 1e18
      const sqrtPriceX96 = BigInt('79228162514264337593543950336'); // price = 1
      const tickLower = -887220; // ~0.5
      const tickUpper = 887220;  // ~2
      
      const { amount0, amount1 } = getAmountsForLiquidity(
        liquidity,
        sqrtPriceX96,
        tickLower,
        tickUpper
      );
      
      expect(amount0).toBeGreaterThan(0n);
      expect(amount1).toBeGreaterThan(0n);
    });

    it('should return only token0 when price is below range', () => {
      const liquidity = BigInt('1000000000000000000'); // 1e18
      const sqrtPriceX96 = BigInt('39614081257132168796771975168'); // price = 0.25
      const tickLower = 0;     // price = 1
      const tickUpper = 6932;  // price = 2
      
      const { amount0, amount1 } = getAmountsForLiquidity(
        liquidity,
        sqrtPriceX96,
        tickLower,
        tickUpper
      );
      
      expect(amount0).toBeGreaterThan(0n);
      expect(amount1).toBe(0n);
    });

    it('should return only token1 when price is above range', () => {
      const liquidity = BigInt('1000000000000000000'); // 1e18
      const sqrtPriceX96 = BigInt('158456325028528675187087900672'); // price = 4
      const tickLower = -6932; // price = 0.5
      const tickUpper = 0;     // price = 1
      
      const { amount0, amount1 } = getAmountsForLiquidity(
        liquidity,
        sqrtPriceX96,
        tickLower,
        tickUpper
      );
      
      expect(amount0).toBe(0n);
      expect(amount1).toBeGreaterThan(0n);
    });
  });

  describe('tick conversions', () => {
    it('should convert tick to sqrtPriceX96', () => {
      const tick = 0;
      const sqrtPriceX96 = tickToSqrtPriceX96(tick);
      
      // At tick 0, price should be 1, so sqrtPrice should be ~2^96
      const expected = BigInt('79228162514264337593543950336');
      const diff = sqrtPriceX96 > expected ? sqrtPriceX96 - expected : expected - sqrtPriceX96;
      expect(Number(diff)).toBeLessThan(1000000000000000000); // Allow rounding
    });

    it('should convert sqrtPriceX96 to tick', () => {
      const sqrtPriceX96 = BigInt('79228162514264337593543950336'); // price = 1
      const tick = sqrtPriceX96ToTick(sqrtPriceX96);
      
      expect(tick).toBe(0);
    });
  });

  describe('calculateUncollectedFees', () => {
    it('should calculate fees correctly', () => {
      const liquidity = BigInt('1000000000000000000'); // 1e18
      const feeGrowthInside0LastX128 = BigInt('1000000000000000000000000000000000000');
      const feeGrowthInside1LastX128 = BigInt('2000000000000000000000000000000000000');
      const feeGrowthInside0X128 = BigInt('1500000000000000000000000000000000000');
      const feeGrowthInside1X128 = BigInt('2500000000000000000000000000000000000');
      
      const { fees0, fees1 } = calculateUncollectedFees(
        liquidity,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        feeGrowthInside0X128,
        feeGrowthInside1X128
      );
      
      expect(fees0).toBeGreaterThan(0n);
      expect(fees1).toBeGreaterThan(0n);
    });
  });

  describe('getFeeGrowthInside', () => {
    it('should calculate fee growth when position is in range', () => {
      const tickLower = -100;
      const tickUpper = 100;
      const tickCurrent = 0;
      const feeGrowthGlobal0X128 = BigInt('1000000000000000000000000000000000000');
      const feeGrowthGlobal1X128 = BigInt('2000000000000000000000000000000000000');
      
      const { feeGrowthInside0X128, feeGrowthInside1X128 } = getFeeGrowthInside(
        tickLower,
        tickUpper,
        tickCurrent,
        feeGrowthGlobal0X128,
        feeGrowthGlobal1X128
      );
      
      expect(feeGrowthInside0X128).toBe(feeGrowthGlobal0X128);
      expect(feeGrowthInside1X128).toBe(feeGrowthGlobal1X128);
    });
  });
});