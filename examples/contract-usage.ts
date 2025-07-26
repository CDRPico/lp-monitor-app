/**
 * Example usage of the contract integration module
 */

import { ContractFactory, getPoolState, getPositionState, isPositionInRange } from '../src/contracts';

// Example environment configuration
const env = {
  ARBITRUM_RPC: 'https://arb-mainnet.g.alchemy.com/v2/your-api-key',
  POOL_ADDRESS: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // Example USDC/ETH pool
  POSITION_TOKEN_ID: 12345
};

async function main() {
  // Create contract factory
  const factory = new ContractFactory(env.ARBITRUM_RPC, {
    timeout: 10000,
    maxRetries: 3
  });

  try {
    // Example 1: Get current block number
    console.log('Fetching current block...');
    const blockNumber = await factory.getBlockNumber();
    console.log(`Current block: ${blockNumber}`);

    // Example 2: Get pool state
    console.log('\nFetching pool state...');
    const poolState = await getPoolState(factory, env.POOL_ADDRESS);
    console.log(`Pool ${poolState.address}:`);
    console.log(`  Current tick: ${poolState.slot0.tick}`);
    console.log(`  Liquidity: ${poolState.liquidity}`);
    console.log(`  Fee tier: ${poolState.fee / 10000}%`);

    // Example 3: Get position state
    console.log('\nFetching position state...');
    const positionState = await getPositionState(factory, env.POSITION_TOKEN_ID);
    console.log(`Position ${env.POSITION_TOKEN_ID}:`);
    console.log(`  Range: [${positionState.position.tickLower}, ${positionState.position.tickUpper}]`);
    console.log(`  In range: ${positionState.inRange}`);
    console.log(`  Liquidity: ${positionState.position.liquidity}`);
    console.log(`  Fees earned:`);
    console.log(`    Token0: ${positionState.feesEarned0}`);
    console.log(`    Token1: ${positionState.feesEarned1}`);

    // Example 4: Batch operations
    console.log('\nPerforming batch operations...');
    const pool = factory.getPool(env.POOL_ADDRESS);
    const [slot0, liquidity, feeGrowth0, feeGrowth1] = await factory.batchCalls([
      () => pool.slot0(),
      () => pool.liquidity(),
      () => pool.feeGrowthGlobal0X128(),
      () => pool.feeGrowthGlobal1X128()
    ] as const);
    console.log('Batch results received successfully');

    // Example 5: Error handling
    console.log('\nTesting error handling...');
    try {
      await factory.callWithRetry(
        () => pool.invalidMethod(), // This will fail
        { timeout: 1000, maxRetries: 1 }
      );
    } catch (error) {
      console.log('Error caught as expected:', error.message);
    }

    // Example 6: Check multiple positions
    console.log('\nChecking multiple positions...');
    const positionIds = [12345, 12346, 12347];
    const positionStates = await Promise.all(
      positionIds.map(id => 
        factory.getPosition(id).catch(() => null) // Handle non-existent positions
      )
    );
    
    const validPositions = positionStates.filter(p => p !== null);
    console.log(`Found ${validPositions.length} valid positions out of ${positionIds.length}`);

    // Example 7: Monitor position range
    console.log('\nMonitoring position range...');
    const currentTick = poolState.slot0.tick;
    const position = positionState.position;
    
    if (!isPositionInRange(currentTick, position.tickLower, position.tickUpper)) {
      const ticksOutOfRange = currentTick < position.tickLower 
        ? position.tickLower - currentTick 
        : currentTick - position.tickUpper;
      console.log(`⚠️  Position is ${ticksOutOfRange} ticks out of range!`);
    } else {
      const ticksToLower = currentTick - position.tickLower;
      const ticksToUpper = position.tickUpper - currentTick;
      console.log(`✅ Position is in range (${ticksToLower} ticks from lower, ${ticksToUpper} ticks from upper)`);
    }

  } catch (error) {
    console.error('Error in example:', error);
  } finally {
    // Always clean up
    factory.destroy();
    console.log('\nFactory destroyed, connections closed');
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other examples
export { main as contractExample };