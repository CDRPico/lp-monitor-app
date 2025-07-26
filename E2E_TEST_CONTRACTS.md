# Contract Integration E2E Tests

This guide explains how to run end-to-end tests for the contract integration module in a Cloudflare Worker environment.

## Setup

### 1. Set your Arbitrum RPC URL

```bash
# For the test worker
wrangler secret put ARBITRUM_RPC --config wrangler-test.toml
# Enter your RPC URL when prompted (e.g., https://arb1.arbitrum.io/rpc or your Alchemy/Infura URL)
```

### 2. Deploy the test worker

```bash
# Deploy to Cloudflare
wrangler deploy --config wrangler-test.toml

# Or run locally with Miniflare
wrangler dev --config wrangler-test.toml --local
```

## Available Test Endpoints

### 1. Run All Contract Tests
```bash
curl https://your-worker.workers.dev/test-contracts
```

This runs a comprehensive test suite including:
- RPC connection test
- Pool address calculation
- Pool data fetching
- NPM contract interaction
- Batch call performance
- Error handling

Expected response:
```json
{
  "timestamp": "2024-01-26T...",
  "tests": {
    "rpcConnection": {
      "success": true,
      "blockNumber": 123456789,
      "responseTime": "250ms"
    },
    "poolAddressCalculation": {
      "success": true,
      "calculatedAddress": "0x..."
    },
    "poolDataFetch": {
      "success": true,
      "currentTick": -201234,
      "liquidity": "123456789000000000000"
    }
    // ... more tests
  },
  "summary": {
    "totalTests": 6,
    "passed": 6,
    "failed": 0,
    "totalTime": "1250ms"
  }
}
```

### 2. Test Specific Pool
```bash
# Get calculated pool address first
curl https://your-worker.workers.dev/test-pool

# Then test with the address
curl https://your-worker.workers.dev/test-pool?address=0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443
```

Returns detailed pool state including:
- Current tick and price
- Liquidity
- Fee growth
- Token addresses

### 3. Test Specific Position
```bash
# Test with a position ID (need to find an active one)
curl https://your-worker.workers.dev/test-position?id=700000
```

Returns position details including:
- Range (ticks and prices)
- Whether position is in range
- Uncollected fees
- Liquidity amount

## Local Testing with Miniflare

```bash
# Install dependencies
npm install

# Set environment variable for local testing
export ARBITRUM_RPC="https://arb1.arbitrum.io/rpc"

# Run with Miniflare
wrangler dev --config wrangler-test.toml --local

# Test locally
curl http://localhost:8787/test-contracts
```

## Finding Test Data

### Active Pools
You can find active Uniswap v3 pools on Arbitrum at:
- https://info.uniswap.org/#/arbitrum/pools

Popular pools for testing:
- WETH/USDC 0.05%: Calculate address with fee=500
- WETH/USDC 0.3%: Calculate address with fee=3000
- WETH/ARB 0.3%: Calculate address with fee=3000

### Active Positions
Finding active position IDs is harder. You can:
1. Use the Uniswap UI to find your own positions
2. Query recent transactions to the NPM contract
3. Try sequential IDs starting from a recent number (e.g., 700000+)

## Performance Benchmarks

Expected response times on Cloudflare Workers:
- RPC connection: 200-400ms
- Single contract call: 300-500ms
- Batch of 4 calls: 400-700ms (parallel execution)
- Full test suite: 1000-2000ms

## Troubleshooting

### "Position does not exist" error
- Try different position IDs
- Positions may have been burned (NFT destroyed when liquidity removed)

### Timeout errors
- Check your RPC provider's rate limits
- Ensure your RPC URL is correct
- Try a different RPC provider

### Pool address mismatch
- Verify token addresses are correct
- Check fee tier (500, 3000, or 10000)
- Ensure you're using Arbitrum One addresses (not Ethereum mainnet)

## Integration with Main Worker

To add these tests to your main worker, you can:

1. Import the test functions into your main `index.ts`
2. Add test routes alongside your main functionality
3. Use environment-based routing (e.g., only enable in development)

Example:
```typescript
// In your main worker
import { runContractTests } from './test-contract-integration';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Enable tests only in development
    if (env.ENVIRONMENT === 'development' && url.pathname.startsWith('/test')) {
      // Handle test routes
    }
    
    // Regular worker logic
  }
}
```