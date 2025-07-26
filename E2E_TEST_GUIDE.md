# E2E Test Guide for Core Mathematics Module

## Overview

I've created a comprehensive end-to-end test that runs directly in a Cloudflare Worker to verify all the core mathematics functionality is working correctly.

## Files Created

1. **`src/worker-e2e-test.ts`** - The main E2E test worker
2. **`wrangler-e2e.toml`** - Wrangler configuration for the test worker

## How to Run

### 1. Local Development (Recommended First)

```bash
# Run locally with wrangler
npx wrangler dev --config wrangler-e2e.toml

# The worker will be available at http://localhost:8787
```

### 2. Deploy to Cloudflare Workers

```bash
# Deploy to your Cloudflare account
npx wrangler deploy --config wrangler-e2e.toml

# You'll get a URL like: https://uniswap-math-e2e-test.YOUR-SUBDOMAIN.workers.dev
```

## Available Endpoints

Once running, you can access these endpoints:

1. **`/`** - HTML dashboard showing all test results
2. **`/tick-math`** - JSON output of tick math tests
3. **`/band-calculator`** - JSON output of band calculator tests
4. **`/fee-calculator`** - JSON output of fee calculator tests
5. **`/enhanced-features`** - JSON output of enhanced features (price oracle, IL)
6. **`/performance`** - Performance benchmarks

## What the Tests Verify

### Tick Math Tests
- ✅ Tick to price conversions (tick 0 = price 1)
- ✅ Price to tick conversions (price 2 ≈ tick 6931)
- ✅ SqrtPriceX96 calculations
- ✅ Inverse functions work correctly
- ✅ Liquidity to token amount conversions

### Band Calculator Tests
- ✅ Basic band calculations
- ✅ Tick spacing alignment (1, 10, 60, 200)
- ✅ Range checking (in/out of range)
- ✅ Distance calculations
- ✅ Fee tier mappings

### Fee Calculator Tests
- ✅ Uncollected fee calculations
- ✅ Daily fee rate estimations
- ✅ APR calculations
- ✅ Rebalancing threshold logic

### Enhanced Features Tests
- ✅ Price oracle functionality
- ✅ Enhanced fee calculations with real prices
- ✅ Impermanent loss calculations
- ✅ Optimal position width recommendations

### Performance Tests
- ✅ 2000 tick math operations < 100ms
- ✅ 1000 band calculations < 50ms
- ✅ Caching performance
- ✅ Complex rebalancing decisions < 10ms each

## Expected Results

When you visit the root URL, you should see:

```
Uniswap v3 Core Mathematics E2E Tests

Tick Math - ✅ PASSED
5/5 tests passed

Band Calculator - ✅ PASSED
5/5 tests passed

Fee Calculator - ✅ PASSED
4/4 tests passed

Enhanced Features - ✅ PASSED
4/4 tests passed

Performance - ✅ PASSED
All operations completed within performance targets
```

## Interpreting Results

- **Green boxes (✅)**: Test suite passed
- **Red boxes (❌)**: Test suite failed - check details
- **Performance metrics**: Ensure all operations complete quickly

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure you've run `npm install` first
   - Check that TypeScript compilation works: `npx tsc --noEmit`

2. **Wrangler errors**
   - Make sure you have wrangler installed: `npm install -g wrangler`
   - Login to Cloudflare: `wrangler login`

3. **Performance failures**
   - These might occur on cold starts
   - Refresh to test with warm worker

## Integration with CI/CD

You can add this to your GitHub Actions:

```yaml
- name: Deploy E2E Test Worker
  run: npx wrangler deploy --config wrangler-e2e.toml
  
- name: Run E2E Tests
  run: |
    WORKER_URL=$(npx wrangler whoami --json | jq -r '.workers_dev_subdomain')
    curl -f https://uniswap-math-e2e-test.$WORKER_URL.workers.dev/
```

## Local Testing Without Deployment

If you just want to verify the math works without deploying:

```bash
# Run the example directly
npx tsx examples/enhanced-calculations.ts

# Run unit tests
npm test
```

## Summary

This E2E test provides confidence that:
1. All mathematical functions work correctly in the Cloudflare Workers environment
2. BigInt operations are properly supported
3. Performance is acceptable for production use
4. Enhanced features (price oracle, IL) function as expected

The test worker can be kept deployed as a health check endpoint for your production system.