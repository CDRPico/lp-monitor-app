# Task 2: Contract Integration

## Overview
**Owner**: Developer A  
**Duration**: 2 hours  
**Dependencies**: Task 1 (Project Foundation) ✅  
**Directory**: `src/contracts/`

## Objectives
- Create minimal ABIs for Uniswap v3 contracts
- Set up ethers.js providers optimized for Cloudflare Workers
- Implement type-safe contract interfaces
- Handle RPC rate limits and timeouts

## Deliverables

### 1. Contract ABIs (`src/contracts/abis.ts`)
Create minimal ABIs containing only the functions we need:

```typescript
export const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)'
];

export const NPM_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];
```

### 2. Contract Factory (`src/contracts/factory.ts`)
Implement a factory pattern for creating contract instances:

```typescript
import { ethers } from 'ethers';
import { POOL_ABI, NPM_ABI } from './abis';

export class ContractFactory {
  private provider: ethers.JsonRpcProvider;
  
  constructor(rpcUrl: string) {
    // Note: Cloudflare Workers have fetch built-in
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  
  getPool(address: string): ethers.Contract {
    return new ethers.Contract(address, POOL_ABI, this.provider);
  }
  
  getNPM(address: string): ethers.Contract {
    return new ethers.Contract(address, NPM_ABI, this.provider);
  }
}
```

### 3. Type Definitions (`src/contracts/types.ts`)
Define TypeScript interfaces for contract return types:

```typescript
export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

export interface Position {
  nonce: bigint;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}
```

### 4. Index Export (`src/contracts/index.ts`)
Create a barrel export for clean imports:

```typescript
export * from './abis';
export * from './factory';
export * from './types';
```

## Cloudflare-Specific Considerations

### Fetch API
- Cloudflare Workers use native fetch, no need for node-fetch
- Ethers.js v6 works with fetch-based providers

### Timeout Handling
- Implement 10-second timeout for RPC calls
- Workers have a 30-second total execution limit

### Request Batching
```typescript
// Example of batching multiple calls
const [slot0, liquidity, feeGrowth0, feeGrowth1] = await Promise.all([
  pool.slot0(),
  pool.liquidity(),
  pool.feeGrowthGlobal0X128(),
  pool.feeGrowthGlobal1X128()
]);
```

### Error Handling
```typescript
try {
  const result = await contract.method();
  return result;
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Handle timeout
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network issues
  }
  throw error;
}
```

## Testing Requirements

### Unit Tests
- Mock RPC responses
- Test type conversions
- Verify ABI encoding/decoding

### Integration Tests
- Test against Arbitrum Sepolia
- Verify timeout handling
- Test error scenarios

## Acceptance Criteria
- [ ] Contract instances can be created and called from worker
- [ ] TypeScript types are properly inferred from contract calls
- [ ] RPC calls complete within 10-second timeout
- [ ] Proper error handling for network issues and timeouts
- [ ] All tests pass with Miniflare

## Implementation Notes

1. **Start Simple**: Begin with just the ABIs and types
2. **Test Early**: Set up a simple test to verify RPC connection
3. **Type Safety**: Ensure all contract returns are properly typed
4. **Error Messages**: Provide clear error messages for debugging

## Dependencies to Install
```bash
npm install ethers@^6.0.0
```

## Example Usage
```typescript
const factory = new ContractFactory(env.ARBITRUM_RPC);
const pool = factory.getPool(env.POOL_ADDRESS);
const slot0 = await pool.slot0();
console.log('Current tick:', slot0.tick);
```