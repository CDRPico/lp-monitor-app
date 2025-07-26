/**
 * Utility functions for Uniswap v3 calculations
 */

import { ethers } from 'ethers';
import { ARBITRUM_ADDRESSES, ARBITRUM_SEPOLIA_ADDRESSES } from './abis';

// Pool init code hash - required for CREATE2 address calculation
// This is the keccak256 hash of the Pool contract creation code
const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

/**
 * Compute the CREATE2 address of a Uniswap v3 pool
 * @param token0 Address of token0 (must be sorted)
 * @param token1 Address of token1 (must be sorted)
 * @param fee Pool fee tier (500, 3000, or 10000)
 * @param isTestnet Whether to use testnet factory address
 * @returns The deterministic pool address
 */
export function computePoolAddress(
  token0: string,
  token1: string,
  fee: number,
  isTestnet: boolean = false
): string {
  // Ensure addresses are checksummed
  const tokenA = ethers.getAddress(token0);
  const tokenB = ethers.getAddress(token1);
  
  // Sort tokens
  const [sortedToken0, sortedToken1] = tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
  
  // Get factory address
  const factoryAddress = isTestnet 
    ? ARBITRUM_SEPOLIA_ADDRESSES.FACTORY
    : ARBITRUM_ADDRESSES.FACTORY;
  
  // Encode the pool key
  const encodedPoolKey = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint24'],
    [sortedToken0, sortedToken1, fee]
  );
  
  // Calculate salt for CREATE2
  const salt = ethers.keccak256(encodedPoolKey);
  
  // Calculate CREATE2 address
  const create2Input = ethers.concat([
    '0xff',
    factoryAddress,
    salt,
    POOL_INIT_CODE_HASH
  ]);
  
  const poolAddress = ethers.getAddress(
    '0x' + ethers.keccak256(create2Input).slice(-40)
  );
  
  return poolAddress;
}

/**
 * Convert sqrtPriceX96 to a human-readable price
 * @param sqrtPriceX96 The sqrt price in X96 format
 * @param decimals0 Decimals of token0
 * @param decimals1 Decimals of token1
 * @returns Price of token0 in terms of token1
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number {
  // Convert sqrtPriceX96 to a decimal number
  const sqrtPrice = Number(sqrtPriceX96) / Math.pow(2, 96);
  
  // Square to get the actual price
  const price = sqrtPrice * sqrtPrice;
  
  // Adjust for decimals
  const decimalAdjustment = Math.pow(10, decimals1 - decimals0);
  
  return price * decimalAdjustment;
}

/**
 * Convert a price to sqrtPriceX96 format
 * @param price Price of token0 in terms of token1
 * @param decimals0 Decimals of token0
 * @param decimals1 Decimals of token1
 * @returns The sqrt price in X96 format
 */
export function priceToSqrtPriceX96(
  price: number,
  decimals0: number,
  decimals1: number
): bigint {
  // Adjust for decimals
  const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
  const adjustedPrice = price * decimalAdjustment;
  
  // Calculate square root
  const sqrtPrice = Math.sqrt(adjustedPrice);
  
  // Convert to X96 format
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Math.pow(2, 96)));
  
  return sqrtPriceX96;
}

/**
 * Calculate the amount of token0 and token1 for a given liquidity amount
 * @param liquidity The liquidity amount
 * @param sqrtPriceX96 Current sqrt price
 * @param tickLower Lower tick of the position
 * @param tickUpper Upper tick of the position
 * @returns Amounts of token0 and token1
 */
export function getAmountsForLiquidity(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number
): { amount0: bigint; amount1: bigint } {
  // Calculate sqrt prices for tick bounds
  const sqrtPriceLowerX96 = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpperX96 = tickToSqrtPriceX96(tickUpper);
  
  let amount0: bigint;
  let amount1: bigint;
  
  if (sqrtPriceX96 <= sqrtPriceLowerX96) {
    // Current price is below the range, position is entirely in token0
    amount0 = getAmount0ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity);
    amount1 = 0n;
  } else if (sqrtPriceX96 >= sqrtPriceUpperX96) {
    // Current price is above the range, position is entirely in token1
    amount0 = 0n;
    amount1 = getAmount1ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity);
  } else {
    // Current price is within the range
    amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceUpperX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtPriceLowerX96, sqrtPriceX96, liquidity);
  }
  
  return { amount0, amount1 };
}

/**
 * Calculate amount0 for a given liquidity and price range
 */
function getAmount0ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  
  const numerator = liquidity * 2n ** 96n * (sqrtPriceBX96 - sqrtPriceAX96);
  const denominator = sqrtPriceBX96 * sqrtPriceAX96;
  
  return numerator / denominator;
}

/**
 * Calculate amount1 for a given liquidity and price range
 */
function getAmount1ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  
  return (liquidity * (sqrtPriceBX96 - sqrtPriceAX96)) / 2n ** 96n;
}

/**
 * Convert tick to sqrtPriceX96
 */
export function tickToSqrtPriceX96(tick: number): bigint {
  const sqrtPrice = Math.pow(1.0001, tick / 2);
  return BigInt(Math.floor(sqrtPrice * Math.pow(2, 96)));
}

/**
 * Convert sqrtPriceX96 to tick
 */
export function sqrtPriceX96ToTick(sqrtPriceX96: bigint): number {
  const sqrtPrice = Number(sqrtPriceX96) / Math.pow(2, 96);
  const tick = Math.floor(Math.log(sqrtPrice * sqrtPrice) / Math.log(1.0001));
  return tick;
}

/**
 * Calculate uncollected fees for a position
 * @param liquidity Position liquidity
 * @param feeGrowthInside0LastX128 Last recorded fee growth for token0
 * @param feeGrowthInside1LastX128 Last recorded fee growth for token1
 * @param feeGrowthInside0X128 Current fee growth for token0
 * @param feeGrowthInside1X128 Current fee growth for token1
 * @returns Uncollected fees for token0 and token1
 */
export function calculateUncollectedFees(
  liquidity: bigint,
  feeGrowthInside0LastX128: bigint,
  feeGrowthInside1LastX128: bigint,
  feeGrowthInside0X128: bigint,
  feeGrowthInside1X128: bigint
): { fees0: bigint; fees1: bigint } {
  const fees0 = (liquidity * (feeGrowthInside0X128 - feeGrowthInside0LastX128)) / 2n ** 128n;
  const fees1 = (liquidity * (feeGrowthInside1X128 - feeGrowthInside1LastX128)) / 2n ** 128n;
  
  return { fees0, fees1 };
}

/**
 * Calculate fee growth inside a position's range
 * @param tickLower Lower tick of the position
 * @param tickUpper Upper tick of the position
 * @param tickCurrent Current tick
 * @param feeGrowthGlobal0X128 Global fee growth for token0
 * @param feeGrowthGlobal1X128 Global fee growth for token1
 * @param feeGrowthOutsideLower0X128 Fee growth outside lower tick for token0
 * @param feeGrowthOutsideLower1X128 Fee growth outside lower tick for token1
 * @param feeGrowthOutsideUpper0X128 Fee growth outside upper tick for token0
 * @param feeGrowthOutsideUpper1X128 Fee growth outside upper tick for token1
 */
export function getFeeGrowthInside(
  tickLower: number,
  tickUpper: number,
  tickCurrent: number,
  feeGrowthGlobal0X128: bigint,
  feeGrowthGlobal1X128: bigint,
  feeGrowthOutsideLower0X128: bigint = 0n,
  feeGrowthOutsideLower1X128: bigint = 0n,
  feeGrowthOutsideUpper0X128: bigint = 0n,
  feeGrowthOutsideUpper1X128: bigint = 0n
): { feeGrowthInside0X128: bigint; feeGrowthInside1X128: bigint } {
  // Calculate fee growth below
  let feeGrowthBelow0X128: bigint;
  let feeGrowthBelow1X128: bigint;
  
  if (tickCurrent >= tickLower) {
    feeGrowthBelow0X128 = feeGrowthOutsideLower0X128;
    feeGrowthBelow1X128 = feeGrowthOutsideLower1X128;
  } else {
    feeGrowthBelow0X128 = feeGrowthGlobal0X128 - feeGrowthOutsideLower0X128;
    feeGrowthBelow1X128 = feeGrowthGlobal1X128 - feeGrowthOutsideLower1X128;
  }
  
  // Calculate fee growth above
  let feeGrowthAbove0X128: bigint;
  let feeGrowthAbove1X128: bigint;
  
  if (tickCurrent < tickUpper) {
    feeGrowthAbove0X128 = feeGrowthOutsideUpper0X128;
    feeGrowthAbove1X128 = feeGrowthOutsideUpper1X128;
  } else {
    feeGrowthAbove0X128 = feeGrowthGlobal0X128 - feeGrowthOutsideUpper0X128;
    feeGrowthAbove1X128 = feeGrowthGlobal1X128 - feeGrowthOutsideUpper1X128;
  }
  
  // Calculate fee growth inside
  const feeGrowthInside0X128 = feeGrowthGlobal0X128 - feeGrowthBelow0X128 - feeGrowthAbove0X128;
  const feeGrowthInside1X128 = feeGrowthGlobal1X128 - feeGrowthBelow1X128 - feeGrowthAbove1X128;
  
  return { feeGrowthInside0X128, feeGrowthInside1X128 };
}