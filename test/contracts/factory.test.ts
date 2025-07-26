/**
 * Unit tests for ContractFactory
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContractFactory } from '../../src/contracts/factory';
import { ContractError, ContractErrorCode } from '../../src/contracts/types';

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(12345),
      destroy: vi.fn()
    })),
    Contract: vi.fn().mockImplementation((address, abi, provider) => ({
      slot0: vi.fn().mockResolvedValue({
        sqrtPriceX96: 1234567890n,
        tick: 100,
        observationIndex: 0,
        observationCardinality: 1,
        observationCardinalityNext: 1,
        feeProtocol: 0,
        unlocked: true
      }),
      liquidity: vi.fn().mockResolvedValue(1000000n),
      feeGrowthGlobal0X128: vi.fn().mockResolvedValue(0n),
      feeGrowthGlobal1X128: vi.fn().mockResolvedValue(0n),
      token0: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000001'),
      token1: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000002'),
      fee: vi.fn().mockResolvedValue(3000),
      positions: vi.fn().mockResolvedValue({
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
        tokensOwed0: 0n,
        tokensOwed1: 0n
      })
    }))
  }
}));

describe('ContractFactory', () => {
  let factory: ContractFactory;

  beforeEach(() => {
    factory = new ContractFactory('https://arb-mainnet.g.alchemy.com/v2/test-key');
  });

  afterEach(() => {
    factory.destroy();
  });

  describe('constructor', () => {
    it('should detect testnet from RPC URL', () => {
      const testnetFactory = new ContractFactory('https://arb-sepolia.g.alchemy.com/v2/test-key');
      expect(testnetFactory['isTestnet']).toBe(true);
      testnetFactory.destroy();
    });

    it('should detect mainnet from RPC URL', () => {
      expect(factory['isTestnet']).toBe(false);
    });
  });

  describe('getPool', () => {
    it('should create a pool contract instance', () => {
      const poolAddress = '0x0000000000000000000000000000000000000004';
      const pool = factory.getPool(poolAddress);
      expect(pool).toBeDefined();
      expect(pool.slot0).toBeDefined();
    });
  });

  describe('getNPM', () => {
    it('should create an NPM contract instance with correct address', () => {
      const npm = factory.getNPM();
      expect(npm).toBeDefined();
      expect(npm.positions).toBeDefined();
    });
  });

  describe('callWithRetry', () => {
    it('should execute successful calls', async () => {
      const mockCall = vi.fn().mockResolvedValue('success');
      const result = await factory.callWithRetry(mockCall);
      expect(result).toBe('success');
      expect(mockCall).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const mockCall = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');
      
      const result = await factory.callWithRetry(mockCall, { retryDelay: 10 });
      expect(result).toBe('success');
      expect(mockCall).toHaveBeenCalledTimes(2);
    });

    it('should timeout after specified duration', async () => {
      const mockCall = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('late'), 1000))
      );

      await expect(
        factory.callWithRetry(mockCall, { timeout: 100, maxRetries: 1 })
      ).rejects.toThrow(ContractError);
    });

    it('should handle rate limit errors', async () => {
      const mockCall = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'));
      
      await expect(
        factory.callWithRetry(mockCall, { maxRetries: 1 })
      ).rejects.toThrow(ContractError);
    });
  });

  describe('batchCalls', () => {
    it('should execute multiple calls in parallel', async () => {
      const call1 = vi.fn().mockResolvedValue('result1');
      const call2 = vi.fn().mockResolvedValue('result2');
      const call3 = vi.fn().mockResolvedValue('result3');

      const results = await factory.batchCalls([call1, call2, call3]);
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(call1).toHaveBeenCalled();
      expect(call2).toHaveBeenCalled();
      expect(call3).toHaveBeenCalled();
    });
  });

  describe('getPoolSlot0', () => {
    it('should return properly typed slot0 data', async () => {
      const poolAddress = '0x0000000000000000000000000000000000000004';
      const slot0 = await factory.getPoolSlot0(poolAddress);
      
      expect(slot0).toMatchObject({
        sqrtPriceX96: expect.any(BigInt),
        tick: expect.any(Number),
        observationIndex: expect.any(Number),
        observationCardinality: expect.any(Number),
        observationCardinalityNext: expect.any(Number),
        feeProtocol: expect.any(Number),
        unlocked: expect.any(Boolean)
      });
    });
  });

  describe('getPosition', () => {
    it('should return properly typed position data', async () => {
      const position = await factory.getPosition(1);
      
      expect(position).toMatchObject({
        nonce: expect.any(BigInt),
        operator: expect.any(String),
        token0: expect.any(String),
        token1: expect.any(String),
        fee: expect.any(Number),
        tickLower: expect.any(Number),
        tickUpper: expect.any(Number),
        liquidity: expect.any(BigInt),
        feeGrowthInside0LastX128: expect.any(BigInt),
        feeGrowthInside1LastX128: expect.any(BigInt),
        tokensOwed0: expect.any(BigInt),
        tokensOwed1: expect.any(BigInt)
      });
    });
  });

  describe('getBlockNumber', () => {
    it('should return the current block number', async () => {
      const blockNumber = await factory.getBlockNumber();
      expect(blockNumber).toBe(12345);
    });
  });
});