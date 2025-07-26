# Contract Integration Module

This module provides type-safe interfaces for interacting with Uniswap v3 contracts in a Cloudflare Workers environment.

## Overview

The contract integration module is optimized for:
- Cloudflare Workers runtime constraints (30-second execution limit)
- Minimal ABI footprint (only required functions)
- Type safety with TypeScript
- Automatic retry and timeout handling
- Efficient batch operations

## Architecture

```
src/contracts/
├── abis.ts      # Minimal contract ABIs and addresses
├── factory.ts   # Contract instance factory with retry logic
├── helpers.ts   # Helper functions for common operations
├── types.ts     # TypeScript interfaces
└── index.ts     # Module exports
```

## Usage

### Basic Setup

```typescript
import { ContractFactory } from './contracts';

// Create factory instance
const factory = new ContractFactory(env.ARBITRUM_RPC);

// Get contract instances
const pool = factory.getPool('0xPoolAddress');
const npm = factory.getNPM();
```

### Fetching Pool State

```typescript
import { getPoolState } from './contracts';

const poolState = await getPoolState(factory, '0xPoolAddress');
console.log('Current tick:', poolState.slot0.tick);
console.log('Pool liquidity:', poolState.liquidity);
```

### Fetching Position State

```typescript
import { getPositionState } from './contracts';

const positionState = await getPositionState(factory, tokenId);
console.log('Position in range:', positionState.inRange);
console.log('Fees earned:', positionState.feesEarned0, positionState.feesEarned1);
```

### Batch Operations

```typescript
// Batch multiple calls for efficiency
const [slot0, liquidity, position] = await factory.batchCalls([
  () => factory.getPoolSlot0(poolAddress),
  () => pool.liquidity(),
  () => factory.getPosition(tokenId)
]);
```

### Error Handling

```typescript
try {
  const result = await factory.callWithRetry(
    () => pool.slot0(),
    { timeout: 5000, maxRetries: 3 }
  );
} catch (error) {
  if (error instanceof ContractError) {
    switch (error.code) {
      case ContractErrorCode.RPC_TIMEOUT:
        console.error('RPC call timed out');
        break;
      case ContractErrorCode.RPC_RATE_LIMIT:
        console.error('Rate limited by RPC provider');
        break;
      default:
        console.error('Contract error:', error.message);
    }
  }
}
```

## Configuration

### RPC Options

```typescript
const factory = new ContractFactory(rpcUrl, {
  timeout: 10000,      // 10 seconds (default)
  maxRetries: 3,       // Retry failed calls 3 times
  retryDelay: 1000     // Wait 1 second between retries
});
```

### Network Detection

The factory automatically detects testnet vs mainnet based on the RPC URL:
- URLs containing "sepolia" use testnet addresses
- All other URLs use mainnet addresses

## Testing

### Unit Tests

Run unit tests with mocked RPC responses:

```bash
npm test test/contracts/
```

### Integration Tests

Run integration tests against Arbitrum Sepolia:

```bash
INTEGRATION_TESTS=true ARBITRUM_SEPOLIA_RPC=your-rpc-url npm test test/contracts/integration.test.ts
```

## Cloudflare Workers Considerations

1. **Fetch API**: The module uses ethers.js v6 which is compatible with the native fetch API in Workers
2. **Timeout Handling**: All RPC calls have a 10-second default timeout (configurable)
3. **No WebSockets**: Only HTTP JSON-RPC is supported
4. **Memory Limits**: Minimal ABIs reduce memory footprint

## Types

### Core Types

```typescript
interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

interface Position {
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

## Performance Tips

1. **Batch Calls**: Always batch multiple contract calls when possible
2. **Cache Results**: Store frequently accessed data in KV storage
3. **Timeout Strategy**: Use shorter timeouts for non-critical calls
4. **Error Recovery**: Implement fallback strategies for RPC failures

## Future Improvements

- [ ] Implement CREATE2 pool address calculation
- [ ] Add support for Multicall contract
- [ ] Implement proper fee calculation logic
- [ ] Add WebSocket support when available in Workers
- [ ] Cache contract instances for reuse