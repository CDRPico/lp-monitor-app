# Contract Integration Module

This module provides type-safe integration with Uniswap v3 contracts on Arbitrum, optimized for Cloudflare Workers.

## Features

### Core Functionality
- ✅ Minimal ABIs for Uniswap v3 Pool and NonfungiblePositionManager
- ✅ Type-safe contract interfaces with proper BigInt handling
- ✅ RPC timeout and retry logic (10-second default timeout)
- ✅ Batch call support for efficiency
- ✅ CREATE2 pool address calculation
- ✅ Position value calculations with liquidity-to-token conversion
- ✅ Fee calculation using feeGrowthGlobal values
- ✅ Price conversion utilities (sqrtPriceX96, tick conversions)

### Key Components

1. **ABIs** (`abis.ts`)
   - Minimal Pool ABI (slot0, liquidity, feeGrowthGlobal, token info)
   - NPM ABI (positions function)
   - ERC20 ABI for token metadata
   - Contract addresses for mainnet and testnet

2. **Factory** (`factory.ts`)
   - Creates contract instances with ethers.js v6
   - Handles RPC timeouts and retries
   - Provides typed helper methods (getPoolSlot0, getPosition)
   - Supports batch calls for efficiency

3. **Types** (`types.ts`)
   - TypeScript interfaces for all contract return types
   - Error types and codes for proper error handling
   - RPC options for configurable timeouts

4. **Utils** (`utils.ts`)
   - `computePoolAddress`: CREATE2 address calculation
   - `getAmountsForLiquidity`: Convert liquidity to token amounts
   - `calculateUncollectedFees`: Calculate pending fees
   - Price conversions (sqrtPriceX96 ↔ price, tick ↔ sqrtPrice)
   - Fee growth calculations

5. **Helpers** (`helpers.ts`)
   - High-level functions for common operations
   - `getPoolState`: Fetch all pool data in one call
   - `getPositionState`: Get position with calculated fees
   - `calculatePositionValue`: USD value calculation

## Usage Examples

### Basic Pool Query
```typescript
const factory = new ContractFactory(env.ARBITRUM_RPC);
const pool = factory.getPool(poolAddress);
const slot0 = await factory.getPoolSlot0(poolAddress);
console.log('Current tick:', slot0.tick);
```

### Get Position with Fees
```typescript
const positionState = await getPositionState(factory, tokenId);
console.log('Position in range:', positionState.inRange);
console.log('Uncollected fees:', {
  token0: positionState.feesEarned0.toString(),
  token1: positionState.feesEarned1.toString()
});
```

### Calculate Pool Address
```typescript
const poolAddress = computePoolAddress(
  token0Address,
  token1Address,
  3000, // 0.3% fee tier
  false // mainnet
);
```

### Calculate Position Value
```typescript
const valueUSD = calculatePositionValue(
  position.liquidity,
  pool.slot0.sqrtPriceX96,
  position.tickLower,
  position.tickUpper,
  token0PriceUSD,
  token1PriceUSD
);
```

## Testing

Run unit tests:
```bash
npm test -- test/contracts/
```

Run Arbitrum Sepolia integration test:
```bash
export ARBITRUM_SEPOLIA_RPC="https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY"
npm test -- test/contracts/integration-sepolia.test.ts --run
```

## Notes

- All BigInt values are properly typed and handled
- Cloudflare Workers' native fetch is used (no node-fetch needed)
- 30-second worker execution limit is respected (10s RPC timeout)
- Rate limiting is detected and properly reported
- For complete fee calculations, tick-level data would need to be fetched (currently simplified)