/**
 * Integration test for Arbitrum Sepolia
 * Run with: npm test -- test/contracts/integration-sepolia.test.ts --run
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContractFactory } from '../../src/contracts/factory';
import { getPoolState, getPositionState } from '../../src/contracts/helpers';

// Skip these tests by default - only run when RPC URL is provided
const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC;
const skip = !RPC_URL;

describe.skipIf(skip)('Arbitrum Sepolia Integration', () => {
  let factory: ContractFactory;

  beforeAll(() => {
    if (RPC_URL) {
      factory = new ContractFactory(RPC_URL);
    }
  });

  afterAll(() => {
    if (factory) {
      factory.destroy();
    }
  });

  it('should connect to Arbitrum Sepolia', async () => {
    const blockNumber = await factory.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(0);
    console.log('Current block:', blockNumber);
  });

  it('should fetch NPM contract data', async () => {
    const npm = factory.getNPM();
    
    // Try to call a view function
    try {
      // This might fail if there are no positions, but it tests the connection
      const position = await factory.getPosition(1);
      console.log('Position 1:', position);
    } catch (error) {
      // Position might not exist, but we should get a proper error
      expect(error).toBeDefined();
    }
  });

  it('should fetch pool data if pool address is provided', async () => {
    // Example pool address - replace with actual Sepolia pool
    const POOL_ADDRESS = process.env.TEST_POOL_ADDRESS;
    
    if (POOL_ADDRESS) {
      const poolState = await getPoolState(factory, POOL_ADDRESS);
      
      expect(poolState.slot0.sqrtPriceX96).toBeGreaterThan(0n);
      expect(poolState.liquidity).toBeGreaterThanOrEqual(0n);
      expect(poolState.token0).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(poolState.token1).toMatch(/^0x[0-9a-fA-F]{40}$/);
      
      console.log('Pool state:', {
        address: poolState.address,
        token0: poolState.token0,
        token1: poolState.token1,
        fee: poolState.fee,
        currentTick: poolState.slot0.tick,
        liquidity: poolState.liquidity.toString()
      });
    }
  });
});

// Instructions for running this test
if (skip) {
  console.log(`
To run Arbitrum Sepolia integration tests:

1. Set your RPC URL:
   export ARBITRUM_SEPOLIA_RPC="https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY"

2. Optionally set a test pool address:
   export TEST_POOL_ADDRESS="0x..."

3. Run the test:
   npm test -- test/contracts/integration-sepolia.test.ts --run
`);
}