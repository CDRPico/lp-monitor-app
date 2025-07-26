/**
 * Minimal ABIs for Uniswap v3 contracts
 * Only includes the functions we need for monitoring positions
 */

// Uniswap v3 Pool ABI - minimal subset
export const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)'
] as const;

// Uniswap v3 NonfungiblePositionManager ABI - minimal subset
export const NPM_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
] as const;

// ERC20 ABI - minimal subset for token info
export const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
] as const;

// Contract addresses on Arbitrum
export const ARBITRUM_ADDRESSES = {
  NPM: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
} as const;

// Contract addresses on Arbitrum Sepolia (testnet)
export const ARBITRUM_SEPOLIA_ADDRESSES = {
  NPM: '0x622e4726a167799826d1E1D150b076A7725f5D81',
  FACTORY: '0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e'
} as const;