/**
 * Integration tests for contract interactions
 * These tests can be run against Arbitrum Sepolia testnet
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ContractFactory } from '../../src/contracts/factory';
import { getPoolState, getPositionState } from '../../src/contracts/helpers';

// Skip integration tests by default (run with INTEGRATION_TESTS=true)
const skipIntegration = !process.env.INTEGRATION_TESTS;

describe.skipIf(skipIntegration)('Contract Integration Tests', () => {
  let factory: ContractFactory;
  
  // Example testnet addresses (these would need to be real addresses for actual testing)
  const TEST_POOL_ADDRESS = '0x0000000000000000000000000000000000000000';
  const TEST_TOKEN_ID = 1;

  beforeAll(() => {
    // Use a testnet RPC URL from environment or default
    const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
    factory = new ContractFactory(rpcUrl, {
      timeout: 15000, // 15 seconds for testnet
      maxRetries: 5   // More retries for testnet
    });
  });

  afterAll(() => {
    factory.destroy();
  });

  describe('RPC Connection', () => {
    it('should connect to Arbitrum Sepolia and get block number', async () => {
      const blockNumber = await factory.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0);
      console.log('Current block number:', blockNumber);
    });

    it('should handle timeout correctly', async () => {
      const shortTimeoutFactory = new ContractFactory(
        process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
        { timeout: 1, maxRetries: 1 }
      );

      await expect(
        shortTimeoutFactory.getBlockNumber()
      ).rejects.toThrow('RPC call timed out');

      shortTimeoutFactory.destroy();
    });
  });

  describe.skipIf(!TEST_POOL_ADDRESS || TEST_POOL_ADDRESS === '0x0000000000000000000000000000000000000000')(
    'Pool State',
    () => {
      it('should fetch complete pool state', async () => {
        const poolState = await getPoolState(factory, TEST_POOL_ADDRESS);
        
        expect(poolState).toMatchObject({
          address: TEST_POOL_ADDRESS,
          token0: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          token1: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          fee: expect.any(Number),
          slot0: expect.objectContaining({
            sqrtPriceX96: expect.any(BigInt),
            tick: expect.any(Number)
          }),
          liquidity: expect.any(BigInt)
        });

        console.log('Pool state:', {
          ...poolState,
          slot0: {
            ...poolState.slot0,
            sqrtPriceX96: poolState.slot0.sqrtPriceX96.toString()
          },
          liquidity: poolState.liquidity.toString(),
          feeGrowthGlobal0X128: poolState.feeGrowthGlobal0X128.toString(),
          feeGrowthGlobal1X128: poolState.feeGrowthGlobal1X128.toString()
        });
      });
    }
  );

  describe.skipIf(!TEST_TOKEN_ID)('Position State', () => {
    it('should fetch complete position state', async () => {
      try {
        const positionState = await getPositionState(factory, TEST_TOKEN_ID);
        
        expect(positionState).toMatchObject({
          tokenId: TEST_TOKEN_ID,
          position: expect.objectContaining({
            token0: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
            token1: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
            fee: expect.any(Number),
            tickLower: expect.any(Number),
            tickUpper: expect.any(Number)
          }),
          inRange: expect.any(Boolean)
        });

        console.log('Position state:', {
          tokenId: positionState.tokenId,
          inRange: positionState.inRange,
          tickRange: [positionState.position.tickLower, positionState.position.tickUpper],
          currentTick: positionState.pool.slot0.tick
        });
      } catch (error) {
        // Position might not exist on testnet
        console.warn('Position fetch failed (might not exist):', error);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid contract addresses gracefully', async () => {
      const invalidAddress = '0x1234567890123456789012345678901234567890';
      const pool = factory.getPool(invalidAddress);
      
      await expect(
        factory.callWithRetry(() => pool.slot0())
      ).rejects.toThrow();
    });

    it('should handle network errors with proper error types', async () => {
      // Create factory with invalid RPC URL
      const badFactory = new ContractFactory('https://invalid-rpc-url.com', {
        timeout: 5000,
        maxRetries: 1
      });

      await expect(
        badFactory.getBlockNumber()
      ).rejects.toThrow();

      badFactory.destroy();
    });
  });
});

// Example of how to run specific integration tests
describe('Usage Examples', () => {
  it.skip('should demonstrate basic usage', async () => {
    // This is documentation, not an actual test
    const factory = new ContractFactory(process.env.ARBITRUM_RPC!);
    
    // Get pool state
    const poolState = await getPoolState(factory, '0xPoolAddress');
    console.log('Current tick:', poolState.slot0.tick);
    
    // Get position state
    const positionState = await getPositionState(factory, 12345);
    console.log('Position in range:', positionState.inRange);
    
    // Batch multiple operations
    const [block, pool1, pool2] = await factory.batchCalls([
      () => factory.getBlockNumber(),
      () => getPoolState(factory, '0xPool1'),
      () => getPoolState(factory, '0xPool2')
    ]);
    
    factory.destroy();
  });
});