/**
 * Helper functions for working with Uniswap v3 contracts
 */

import { ContractFactory } from './factory';
import { PoolState, PositionState } from './types';
import { 
  computePoolAddress as computePoolAddressUtil,
  getAmountsForLiquidity,
  calculateUncollectedFees,
  getFeeGrowthInside,
  sqrtPriceX96ToPrice
} from './utils';

/**
 * Calculate if a position is in range
 */
export function isPositionInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
  return currentTick >= tickLower && currentTick < tickUpper;
}

/**
 * Get complete pool state
 */
export async function getPoolState(factory: ContractFactory, poolAddress: string): Promise<PoolState> {
  const pool = factory.getPool(poolAddress);
  
  // Batch all pool calls for efficiency
  const [slot0, liquidity, feeGrowthGlobal0X128, feeGrowthGlobal1X128, token0, token1, fee] = 
    await factory.batchCalls([
      () => factory.getPoolSlot0(poolAddress),
      () => pool.liquidity(),
      () => pool.feeGrowthGlobal0X128(),
      () => pool.feeGrowthGlobal1X128(),
      () => pool.token0(),
      () => pool.token1(),
      () => pool.fee()
    ] as const);

  return {
    address: poolAddress,
    token0: token0 as string,
    token1: token1 as string,
    fee: Number(fee),
    slot0,
    liquidity: liquidity as bigint,
    feeGrowthGlobal0X128: feeGrowthGlobal0X128 as bigint,
    feeGrowthGlobal1X128: feeGrowthGlobal1X128 as bigint
  };
}

/**
 * Get complete position state including pool data
 */
export async function getPositionState(
  factory: ContractFactory,
  tokenId: number
): Promise<PositionState> {
  // Get position data
  const position = await factory.getPosition(tokenId);
  
  // Calculate pool address
  const poolAddress = computePoolAddressUtil(
    position.token0,
    position.token1,
    position.fee,
    factory['isTestnet'] // Access private property for network check
  );
  
  // Get pool state
  const pool = await getPoolState(factory, poolAddress);
  
  // Check if position is in range
  const inRange = isPositionInRange(
    pool.slot0.tick,
    position.tickLower,
    position.tickUpper
  );
  
  // Calculate fees earned
  // Note: For a complete implementation, we'd need to fetch tick data for feeGrowthOutside values
  // For now, we'll calculate based on global fee growth (simplified)
  const { feeGrowthInside0X128, feeGrowthInside1X128 } = getFeeGrowthInside(
    position.tickLower,
    position.tickUpper,
    pool.slot0.tick,
    pool.feeGrowthGlobal0X128,
    pool.feeGrowthGlobal1X128
  );
  
  const { fees0, fees1 } = calculateUncollectedFees(
    position.liquidity,
    position.feeGrowthInside0LastX128,
    position.feeGrowthInside1LastX128,
    feeGrowthInside0X128,
    feeGrowthInside1X128
  );
  
  // Add already collected fees
  const feesEarned0 = position.tokensOwed0 + fees0;
  const feesEarned1 = position.tokensOwed1 + fees1;
  
  return {
    tokenId,
    position,
    pool,
    inRange,
    feesEarned0,
    feesEarned1
  };
}

/**
 * Compute pool address from token addresses and fee
 */
export function computePoolAddress(
  token0: string,
  token1: string,
  fee: number,
  isTestnet: boolean
): string {
  return computePoolAddressUtil(token0, token1, fee, isTestnet);
}

/**
 * Format tick to human-readable price
 */
export function tickToPrice(tick: number, token0Decimals: number, token1Decimals: number): number {
  const price = Math.pow(1.0001, tick) * Math.pow(10, token0Decimals - token1Decimals);
  return price;
}

/**
 * Calculate position value in USD
 */
export function calculatePositionValue(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  token0Price: number,
  token1Price: number
): number {
  // Get token amounts for the position
  const { amount0, amount1 } = getAmountsForLiquidity(
    liquidity,
    sqrtPriceX96,
    tickLower,
    tickUpper
  );
  
  // Convert amounts to human-readable values (assuming 18 decimals for simplicity)
  // In production, you'd need to fetch actual token decimals
  const amount0Decimal = Number(amount0) / 1e18;
  const amount1Decimal = Number(amount1) / 1e18;
  
  // Calculate USD value
  const value0 = amount0Decimal * token0Price;
  const value1 = amount1Decimal * token1Price;
  
  return value0 + value1;
}