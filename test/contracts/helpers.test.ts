/**
 * Unit tests for contract helper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPositionInRange, getPoolState, getPositionState, tickToPrice } from '../../src/contracts/helpers';
import { ContractFactory } from '../../src/contracts/factory';
import type { Slot0 } from '../../src/contracts/types';

// Mock the factory module
vi.mock('../../src/contracts/factory');

describe('Contract Helpers', () => {
  let mockFactory: ContractFactory;

  beforeEach(() => {
    // Create a mock factory
    mockFactory = {
      getPool: vi.fn().mockReturnValue({
        liquidity: vi.fn().mockResolvedValue(1000000n),
        feeGrowthGlobal0X128: vi.fn().mockResolvedValue(100n),
        feeGrowthGlobal1X128: vi.fn().mockResolvedValue(200n),
        token0: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000001'),
        token1: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000002'),
        fee: vi.fn().mockResolvedValue(3000)
      }),
      getPoolSlot0: vi.fn().mockResolvedValue({
        sqrtPriceX96: 1234567890n,
        tick: 0,
        observationIndex: 0,
        observationCardinality: 1,
        observationCardinalityNext: 1,
        feeProtocol: 0,
        unlocked: true
      } as Slot0),
      getPosition: vi.fn().mockResolvedValue({
        nonce: 0n,
        operator: '0x0000000000000000000000000000000000000003',
        token0: '0x0000000000000000000000000000000000000001',
        token1: '0x0000000000000000000000000000000000000002',
        fee: 3000,
        tickLower: -100,
        tickUpper: 100,
        liquidity: 1000000n,
        feeGrowthInside0LastX128: 0n,
        feeGrowthInside1LastX128: 0n,
        tokensOwed0: 1000n,
        tokensOwed1: 2000n
      }),
      batchCalls: vi.fn().mockImplementation(async (calls) => {
        const results = [];
        for (const call of calls) {
          results.push(await call());
        }
        return results;
      })
    } as unknown as ContractFactory;
  });

  describe('isPositionInRange', () => {
    it('should return true when tick is within range', () => {
      expect(isPositionInRange(0, -100, 100)).toBe(true);
      expect(isPositionInRange(-50, -100, 100)).toBe(true);
      expect(isPositionInRange(99, -100, 100)).toBe(true);
      expect(isPositionInRange(-100, -100, 100)).toBe(true);
    });

    it('should return false when tick is outside range', () => {
      expect(isPositionInRange(100, -100, 100)).toBe(false);
      expect(isPositionInRange(-101, -100, 100)).toBe(false);
      expect(isPositionInRange(150, -100, 100)).toBe(false);
    });

    it('should handle edge cases correctly', () => {
      // Upper bound is exclusive
      expect(isPositionInRange(100, 0, 100)).toBe(false);
      // Lower bound is inclusive
      expect(isPositionInRange(0, 0, 100)).toBe(true);
    });
  });

  describe('getPoolState', () => {
    it('should fetch all pool data in a single batch', async () => {
      const poolAddress = '0x0000000000000000000000000000000000000004';
      const poolState = await getPoolState(mockFactory, poolAddress);

      expect(poolState).toMatchObject({
        address: poolAddress,
        token0: '0x0000000000000000000000000000000000000001',
        token1: '0x0000000000000000000000000000000000000002',
        fee: 3000,
        slot0: expect.objectContaining({
          tick: 0,
          sqrtPriceX96: 1234567890n
        }),
        liquidity: 1000000n,
        feeGrowthGlobal0X128: 100n,
        feeGrowthGlobal1X128: 200n
      });

      // Verify batch calls were used
      expect(mockFactory.batchCalls).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPositionState', () => {
    it('should return complete position state', async () => {
      const tokenId = 1;
      const positionState = await getPositionState(mockFactory, tokenId);

      expect(positionState).toMatchObject({
        tokenId,
        position: expect.objectContaining({
          tickLower: -100,
          tickUpper: 100,
          liquidity: 1000000n
        }),
        pool: expect.objectContaining({
          slot0: expect.objectContaining({
            tick: 0
          })
        }),
        inRange: true,
        feesEarned0: 1000n,
        feesEarned1: 2000n
      });

      expect(mockFactory.getPosition).toHaveBeenCalledWith(tokenId);
    });

    it('should correctly determine if position is out of range', async () => {
      // Mock a position that's out of range
      mockFactory.getPoolSlot0 = vi.fn().mockResolvedValue({
        sqrtPriceX96: 1234567890n,
        tick: 200, // Outside the -100 to 100 range
        observationIndex: 0,
        observationCardinality: 1,
        observationCardinalityNext: 1,
        feeProtocol: 0,
        unlocked: true
      });

      const positionState = await getPositionState(mockFactory, 1);
      expect(positionState.inRange).toBe(false);
    });
  });

  describe('tickToPrice', () => {
    it('should convert tick to price correctly', () => {
      // Test tick 0 (price = 1)
      const price0 = tickToPrice(0, 18, 18);
      expect(price0).toBeCloseTo(1, 5);

      // Test positive tick
      const pricePositive = tickToPrice(100, 18, 18);
      expect(pricePositive).toBeGreaterThan(1);

      // Test negative tick
      const priceNegative = tickToPrice(-100, 18, 18);
      expect(priceNegative).toBeLessThan(1);
    });

    it('should handle different decimal places', () => {
      // USDC (6 decimals) / ETH (18 decimals)
      const price = tickToPrice(0, 6, 18);
      expect(price).toBeCloseTo(1e-12, 15);
    });
  });
});