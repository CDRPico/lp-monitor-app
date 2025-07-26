/**
 * End-to-end test for contract integration in Cloudflare Workers
 * Deploy this as a separate worker or add to your main worker for testing
 */

import { ContractFactory, getPoolState, getPositionState, computePoolAddress } from './contracts';

export interface Env {
  ARBITRUM_RPC: string;
}

// Test configuration - using well-known pools/positions on Arbitrum
const TEST_CONFIG = {
  // WETH/USDC 0.05% pool - one of the most active pools
  WETH_ADDRESS: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC_ADDRESS: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native USDC on Arbitrum
  POOL_FEE: 500, // 0.05%
  
  // Alternative: WETH/USDC 0.3% pool
  POOL_FEE_ALT: 3000, // 0.3%
  
  // Test with a known position ID (you'll need to find an active one)
  TEST_POSITION_ID: 1, // Replace with actual position ID
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      if (url.pathname === '/test-contracts') {
        const results = await runContractTests(env);
        return new Response(JSON.stringify(results, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (url.pathname === '/test-pool') {
        const poolAddress = url.searchParams.get('address');
        if (!poolAddress) {
          // Calculate pool address
          const calculatedAddress = computePoolAddress(
            TEST_CONFIG.WETH_ADDRESS,
            TEST_CONFIG.USDC_ADDRESS,
            TEST_CONFIG.POOL_FEE,
            false // mainnet
          );
          return new Response(JSON.stringify({
            message: 'No pool address provided. Use calculated address:',
            calculatedAddress,
            example: `/test-pool?address=${calculatedAddress}`
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const poolData = await testPoolData(env, poolAddress);
        return new Response(JSON.stringify(poolData, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (url.pathname === '/test-position') {
        const tokenId = parseInt(url.searchParams.get('id') || '1');
        const positionData = await testPositionData(env, tokenId);
        return new Response(JSON.stringify(positionData, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        message: 'Contract Integration E2E Test',
        endpoints: [
          '/test-contracts - Run all contract tests',
          '/test-pool?address=0x... - Test specific pool',
          '/test-position?id=123 - Test specific position',
        ],
        testConfig: TEST_CONFIG,
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

async function runContractTests(env: Env) {
  const factory = new ContractFactory(env.ARBITRUM_RPC);
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {},
  };
  
  try {
    // Test 1: RPC Connection
    console.log('Testing RPC connection...');
    const startTime = Date.now();
    const blockNumber = await factory.getBlockNumber();
    const rpcTime = Date.now() - startTime;
    
    results.tests.rpcConnection = {
      success: true,
      blockNumber,
      responseTime: `${rpcTime}ms`,
    };
    
    // Test 2: Pool Address Calculation
    console.log('Testing pool address calculation...');
    const calculatedAddress = computePoolAddress(
      TEST_CONFIG.WETH_ADDRESS,
      TEST_CONFIG.USDC_ADDRESS,
      TEST_CONFIG.POOL_FEE,
      false
    );
    
    results.tests.poolAddressCalculation = {
      success: true,
      token0: TEST_CONFIG.WETH_ADDRESS,
      token1: TEST_CONFIG.USDC_ADDRESS,
      fee: TEST_CONFIG.POOL_FEE,
      calculatedAddress,
    };
    
    // Test 3: Pool Data Fetching
    console.log('Testing pool data fetching...');
    const poolStartTime = Date.now();
    const poolState = await getPoolState(factory, calculatedAddress);
    const poolTime = Date.now() - poolStartTime;
    
    results.tests.poolDataFetch = {
      success: true,
      poolAddress: calculatedAddress,
      currentTick: poolState.slot0.tick,
      sqrtPriceX96: poolState.slot0.sqrtPriceX96.toString(),
      liquidity: poolState.liquidity.toString(),
      token0: poolState.token0,
      token1: poolState.token1,
      fee: poolState.fee,
      responseTime: `${poolTime}ms`,
    };
    
    // Test 4: NPM Contract
    console.log('Testing NPM contract...');
    const npm = factory.getNPM();
    results.tests.npmContract = {
      success: true,
      address: await npm.getAddress(),
    };
    
    // Test 5: Batch Calls
    console.log('Testing batch calls...');
    const batchStartTime = Date.now();
    const pool = factory.getPool(calculatedAddress);
    const [slot0, liquidity, token0, token1] = await factory.batchCalls([
      () => pool.slot0(),
      () => pool.liquidity(),
      () => pool.token0(),
      () => pool.token1(),
    ] as const);
    const batchTime = Date.now() - batchStartTime;
    
    results.tests.batchCalls = {
      success: true,
      callsExecuted: 4,
      responseTime: `${batchTime}ms`,
      averageTimePerCall: `${(batchTime / 4).toFixed(2)}ms`,
    };
    
    // Test 6: Error Handling
    console.log('Testing error handling...');
    try {
      // Try to get a position that likely doesn't exist
      await factory.getPosition(999999999);
      results.tests.errorHandling = {
        success: false,
        message: 'Expected error was not thrown',
      };
    } catch (error) {
      results.tests.errorHandling = {
        success: true,
        errorCaught: true,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      };
    }
    
    // Summary
    results.summary = {
      totalTests: Object.keys(results.tests).length,
      passed: Object.values(results.tests).filter((t: any) => t.success).length,
      failed: Object.values(results.tests).filter((t: any) => !t.success).length,
      totalTime: `${Date.now() - startTime}ms`,
    };
    
  } finally {
    factory.destroy();
  }
  
  return results;
}

async function testPoolData(env: Env, poolAddress: string) {
  const factory = new ContractFactory(env.ARBITRUM_RPC);
  
  try {
    const poolState = await getPoolState(factory, poolAddress);
    
    // Calculate human-readable price
    const price = Math.pow(1.0001, poolState.slot0.tick);
    
    return {
      success: true,
      pool: {
        address: poolAddress,
        token0: poolState.token0,
        token1: poolState.token1,
        fee: poolState.fee,
        feePercent: `${poolState.fee / 10000}%`,
      },
      state: {
        currentTick: poolState.slot0.tick,
        sqrtPriceX96: poolState.slot0.sqrtPriceX96.toString(),
        price: price.toFixed(6),
        liquidity: poolState.liquidity.toString(),
        unlocked: poolState.slot0.unlocked,
      },
      feeGrowth: {
        token0: poolState.feeGrowthGlobal0X128.toString(),
        token1: poolState.feeGrowthGlobal1X128.toString(),
      },
    };
  } finally {
    factory.destroy();
  }
}

async function testPositionData(env: Env, tokenId: number) {
  const factory = new ContractFactory(env.ARBITRUM_RPC);
  
  try {
    const positionState = await getPositionState(factory, tokenId);
    
    // Calculate price range
    const priceLower = Math.pow(1.0001, positionState.position.tickLower);
    const priceUpper = Math.pow(1.0001, positionState.position.tickUpper);
    const currentPrice = Math.pow(1.0001, positionState.pool.slot0.tick);
    
    return {
      success: true,
      position: {
        tokenId,
        owner: positionState.position.operator,
        token0: positionState.position.token0,
        token1: positionState.position.token1,
        fee: positionState.position.fee,
        feePercent: `${positionState.position.fee / 10000}%`,
      },
      range: {
        tickLower: positionState.position.tickLower,
        tickUpper: positionState.position.tickUpper,
        priceLower: priceLower.toFixed(6),
        priceUpper: priceUpper.toFixed(6),
        currentPrice: currentPrice.toFixed(6),
        inRange: positionState.inRange,
      },
      liquidity: {
        amount: positionState.position.liquidity.toString(),
        hasLiquidity: positionState.position.liquidity > 0n,
      },
      fees: {
        earned0: positionState.feesEarned0.toString(),
        earned1: positionState.feesEarned1.toString(),
        tokensOwed0: positionState.position.tokensOwed0.toString(),
        tokensOwed1: positionState.position.tokensOwed1.toString(),
      },
      pool: {
        address: positionState.pool.address,
        currentTick: positionState.pool.slot0.tick,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Position may not exist. Try a different tokenId.',
    };
  } finally {
    factory.destroy();
  }
}