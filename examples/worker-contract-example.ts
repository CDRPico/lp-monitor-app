/**
 * Example: How to use the contract integration in your main worker
 * Add this to your src/index.ts or create a new route
 */

import { ContractFactory, getPoolState, computePoolAddress } from '../src/contracts';

// Add this handler to your worker
export async function handleContractExample(request: Request, env: { ARBITRUM_RPC: string }) {
  const url = new URL(request.url);
  
  // Example: Get pool info for WETH/USDC
  if (url.pathname === '/api/pool-info') {
    const factory = new ContractFactory(env.ARBITRUM_RPC);
    
    try {
      // Calculate pool address
      const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
      const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
      const poolAddress = computePoolAddress(WETH, USDC, 500, false); // 0.05% fee
      
      // Get pool state
      const poolState = await getPoolState(factory, poolAddress);
      
      // Calculate human-readable values
      const currentPrice = Math.pow(1.0001, poolState.slot0.tick);
      const priceUSDCperWETH = 1 / currentPrice * 1e12; // Adjust for decimals (USDC 6, WETH 18)
      
      return new Response(JSON.stringify({
        pool: {
          address: poolAddress,
          token0: 'WETH',
          token1: 'USDC',
          fee: '0.05%',
        },
        state: {
          currentTick: poolState.slot0.tick,
          priceUSDCperWETH: priceUSDCperWETH.toFixed(2),
          liquidity: (Number(poolState.liquidity) / 1e18).toFixed(2),
        },
        timestamp: new Date().toISOString(),
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    } finally {
      factory.destroy();
    }
  }
  
  // Example: Check if a position needs rebalancing
  if (url.pathname === '/api/check-position') {
    const tokenId = parseInt(url.searchParams.get('id') || '0');
    if (!tokenId) {
      return new Response('Missing position ID', { status: 400 });
    }
    
    const factory = new ContractFactory(env.ARBITRUM_RPC);
    
    try {
      const { position, pool, inRange } = await factory.getPositionState(tokenId);
      
      // Simple rebalancing check
      const tickDistance = pool.slot0.tick - position.tickLower;
      const rangeSize = position.tickUpper - position.tickLower;
      const positionInRange = (tickDistance / rangeSize) * 100;
      
      return new Response(JSON.stringify({
        tokenId,
        inRange,
        currentTick: pool.slot0.tick,
        position: {
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          liquidity: position.liquidity.toString(),
        },
        analysis: {
          positionInRangePercent: inRange ? positionInRange.toFixed(2) : 0,
          needsRebalancing: !inRange || positionInRange < 20 || positionInRange > 80,
          reason: !inRange ? 'Out of range' : 
                  positionInRange < 20 ? 'Near lower bound' :
                  positionInRange > 80 ? 'Near upper bound' : 'Healthy',
        },
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Position not found or error fetching data',
        details: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      factory.destroy();
    }
  }
  
  return new Response('Not found', { status: 404 });
}

// Example integration in your main worker:
/*
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Contract integration routes
    if (url.pathname.startsWith('/api/')) {
      return handleContractExample(request, env);
    }
    
    // Your existing routes...
    return new Response('LP Bot API', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
*/