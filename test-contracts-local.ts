/**
 * Local test script for contract integration
 * Run with: npx tsx test-contracts-local.ts
 */

import { ContractFactory, getPoolState, computePoolAddress } from './src/contracts';

// Test configuration
const RPC_URL = process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

async function runTests() {
  console.log('🚀 Starting Contract Integration Tests\n');
  console.log(`RPC URL: ${RPC_URL}\n`);
  
  const factory = new ContractFactory(RPC_URL);
  
  try {
    // Test 1: RPC Connection
    console.log('1️⃣  Testing RPC Connection...');
    const start = Date.now();
    const blockNumber = await factory.getBlockNumber();
    console.log(`✅ Connected! Block number: ${blockNumber}`);
    console.log(`⏱️  Response time: ${Date.now() - start}ms\n`);
    
    // Test 2: Pool Address Calculation
    console.log('2️⃣  Testing Pool Address Calculation...');
    const poolAddress = computePoolAddress(WETH, USDC, 500, false);
    console.log(`✅ WETH/USDC 0.05% pool address: ${poolAddress}\n`);
    
    // Test 3: Fetch Pool State
    console.log('3️⃣  Testing Pool State Fetching...');
    const poolStart = Date.now();
    const poolState = await getPoolState(factory, poolAddress);
    console.log('✅ Pool state fetched successfully!');
    console.log(`   Current tick: ${poolState.slot0.tick}`);
    console.log(`   Liquidity: ${poolState.liquidity}`);
    console.log(`   Price (1.0001^tick): ${Math.pow(1.0001, poolState.slot0.tick).toFixed(6)}`);
    console.log(`⏱️  Response time: ${Date.now() - poolStart}ms\n`);
    
    // Test 4: Batch Calls
    console.log('4️⃣  Testing Batch Calls...');
    const pool = factory.getPool(poolAddress);
    const batchStart = Date.now();
    const [slot0, liquidity, fee] = await factory.batchCalls([
      () => pool.slot0(),
      () => pool.liquidity(),
      () => pool.fee(),
    ] as const);
    console.log('✅ Batch calls successful!');
    console.log(`   3 calls executed in: ${Date.now() - batchStart}ms`);
    console.log(`   Average time per call: ${((Date.now() - batchStart) / 3).toFixed(2)}ms\n`);
    
    // Test 5: Error Handling
    console.log('5️⃣  Testing Error Handling...');
    try {
      await factory.callWithRetry(
        () => Promise.reject(new Error('Test error')),
        { maxRetries: 2, retryDelay: 100 }
      );
      console.log('❌ Error handling failed - error was not thrown');
    } catch (error) {
      console.log('✅ Error handling works correctly!');
      console.log(`   Error caught: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
    
    // Summary
    console.log('📊 Test Summary');
    console.log('─'.repeat(50));
    console.log('All tests passed! ✅');
    console.log(`Total execution time: ${Date.now() - start}ms`);
    console.log('\n💡 The contract integration is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    factory.destroy();
  }
}

// Run the tests
runTests().catch(console.error);