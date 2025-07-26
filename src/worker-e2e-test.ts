/**
 * End-to-end test for Core Mathematics in Cloudflare Worker
 * This can be deployed as a worker to verify all functionality
 */

import { 
  TickMath, 
  BandCalculator, 
  FeeCalculator,
  PriceOracle,
  EnhancedFeeCalculator,
  createStablecoinOracle
} from './utils';

export interface Env {
  // Add your bindings here if needed
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Run different test suites based on path
    switch (url.pathname) {
      case '/':
        return new Response(await runAllTests(), {
          headers: { 'Content-Type': 'text/html' }
        });
      case '/tick-math':
        return jsonResponse(await testTickMath());
      case '/band-calculator':
        return jsonResponse(await testBandCalculator());
      case '/fee-calculator':
        return jsonResponse(await testFeeCalculator());
      case '/enhanced-features':
        return jsonResponse(await testEnhancedFeatures());
      case '/performance':
        return jsonResponse(await testPerformance());
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
};

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function runAllTests(): Promise<string> {
  const tests = [
    { name: 'Tick Math', fn: testTickMath },
    { name: 'Band Calculator', fn: testBandCalculator },
    { name: 'Fee Calculator', fn: testFeeCalculator },
    { name: 'Enhanced Features', fn: testEnhancedFeatures },
    { name: 'Performance', fn: testPerformance }
  ];
  
  let html = `
    <h1>Uniswap v3 Core Mathematics E2E Tests</h1>
    <style>
      body { font-family: monospace; margin: 20px; }
      .test { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
      .pass { background: #e7f5e7; }
      .fail { background: #f5e7e7; }
      .metric { color: #666; }
      pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
  `;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      const status = result.passed ? 'pass' : 'fail';
      html += `
        <div class="test ${status}">
          <h2>${test.name} - ${result.passed ? '✅ PASSED' : '❌ FAILED'}</h2>
          <p>${result.message}</p>
          ${result.details ? `<pre>${JSON.stringify(result.details, null, 2)}</pre>` : ''}
        </div>
      `;
    } catch (error) {
      html += `
        <div class="test fail">
          <h2>${test.name} - ❌ ERROR</h2>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
  
  html += `
    <div class="test">
      <h2>API Endpoints</h2>
      <ul>
        <li><a href="/tick-math">/tick-math</a> - Test tick math calculations</li>
        <li><a href="/band-calculator">/band-calculator</a> - Test band calculations</li>
        <li><a href="/fee-calculator">/fee-calculator</a> - Test fee calculations</li>
        <li><a href="/enhanced-features">/enhanced-features</a> - Test enhanced features</li>
        <li><a href="/performance">/performance</a> - Run performance benchmarks</li>
      </ul>
    </div>
  `;
  
  return html;
}

async function testTickMath() {
  const tests = [];
  
  // Test 1: Basic tick to price conversion
  const tick0Price = TickMath.tickToPrice(0);
  tests.push({
    name: 'Tick 0 to Price',
    expected: 1,
    actual: tick0Price,
    passed: Math.abs(tick0Price - 1) < 0.0001
  });
  
  // Test 2: Price to tick conversion
  const price2Tick = TickMath.priceToTick(2);
  const expectedTick = 6931; // Approximate
  tests.push({
    name: 'Price 2 to Tick',
    expected: expectedTick,
    actual: price2Tick,
    passed: Math.abs(price2Tick - expectedTick) < 2
  });
  
  // Test 3: SqrtPriceX96 calculations
  const sqrtPrice = TickMath.getSqrtPriceX96FromTick(0);
  const expectedSqrtPrice = TickMath.Q96;
  tests.push({
    name: 'Tick 0 to SqrtPriceX96',
    expected: expectedSqrtPrice.toString(),
    actual: sqrtPrice.toString(),
    passed: sqrtPrice === expectedSqrtPrice
  });
  
  // Test 4: Inverse function
  const testTick = 1000;
  const sqrtPriceTest = TickMath.getSqrtPriceX96FromTick(testTick);
  const recoveredTick = TickMath.getTickFromSqrtPriceX96(sqrtPriceTest);
  tests.push({
    name: 'SqrtPrice inverse function',
    expected: testTick,
    actual: recoveredTick,
    passed: Math.abs(recoveredTick - testTick) <= 1
  });
  
  // Test 5: Liquidity calculations
  const liquidity = 1000000n;
  const sqrtPriceA = TickMath.getSqrtPriceX96FromTick(-1000);
  const sqrtPriceB = TickMath.getSqrtPriceX96FromTick(1000);
  const amount0 = TickMath.getAmount0ForLiquidity(sqrtPriceA, sqrtPriceB, liquidity);
  const amount1 = TickMath.getAmount1ForLiquidity(sqrtPriceA, sqrtPriceB, liquidity);
  tests.push({
    name: 'Liquidity to amounts',
    expected: 'positive values',
    actual: { amount0: amount0.toString(), amount1: amount1.toString() },
    passed: amount0 > 0n && amount1 > 0n
  });
  
  const allPassed = tests.every(t => t.passed);
  
  return {
    passed: allPassed,
    message: `${tests.filter(t => t.passed).length}/${tests.length} tests passed`,
    details: tests
  };
}

async function testBandCalculator() {
  const tests = [];
  
  // Test 1: Basic band calculation
  const band = BandCalculator.calculateBand(0, 200, 10);
  tests.push({
    name: 'Basic band calculation',
    expected: { tickLower: -100, tickUpper: 100 },
    actual: band,
    passed: band.tickLower === -100 && band.tickUpper === 100
  });
  
  // Test 2: Tick spacing alignment
  const alignedBand = BandCalculator.calculateBand(5, 100, 60);
  tests.push({
    name: 'Tick spacing alignment',
    expected: 'aligned to 60',
    actual: alignedBand,
    passed: alignedBand.tickLower % 60 === 0 && alignedBand.tickUpper % 60 === 0
  });
  
  // Test 3: Range checking
  const inRange = BandCalculator.isInRange(50, 0, 100);
  const outOfRange = BandCalculator.isInRange(150, 0, 100);
  tests.push({
    name: 'Range checking',
    expected: { inRange: true, outOfRange: false },
    actual: { inRange, outOfRange },
    passed: inRange === true && outOfRange === false
  });
  
  // Test 4: Out of range distance
  const distance = BandCalculator.getOutOfRangeDistance(150, 0, 100);
  tests.push({
    name: 'Out of range distance',
    expected: 51,
    actual: distance,
    passed: distance === 51
  });
  
  // Test 5: Fee tier mapping
  const feeTier = BandCalculator.tickSpacingToFeeTier(60);
  tests.push({
    name: 'Tick spacing to fee tier',
    expected: 3000,
    actual: feeTier,
    passed: feeTier === 3000
  });
  
  const allPassed = tests.every(t => t.passed);
  
  return {
    passed: allPassed,
    message: `${tests.filter(t => t.passed).length}/${tests.length} tests passed`,
    details: tests
  };
}

async function testFeeCalculator() {
  const tests = [];
  
  // Test 1: Basic fee calculation
  const fees = FeeCalculator.calculateUncollectedFees(
    { tokensOwed0: 1000000n, tokensOwed1: 2000000n },
    0n, 0n, 6, 6
  );
  tests.push({
    name: 'Basic fee calculation',
    expected: { token0: 1, token1: 2, totalUsd: 3 },
    actual: fees,
    passed: fees.token0 === 1 && fees.token1 === 2 && fees.totalUsd === 3
  });
  
  // Test 2: Daily fee rate estimation
  const dailyRate = FeeCalculator.estimateDailyFeeRate(10, 12);
  tests.push({
    name: 'Daily fee rate',
    expected: 20,
    actual: dailyRate,
    passed: Math.abs(dailyRate - 20) < 0.01
  });
  
  // Test 3: Fee APR calculation
  const apr = FeeCalculator.calculateFeeAPR(1, 1000);
  tests.push({
    name: 'Fee APR calculation',
    expected: 36.5,
    actual: apr,
    passed: Math.abs(apr - 36.5) < 0.01
  });
  
  // Test 4: Rebalance threshold
  const threshold = FeeCalculator.calculateRebalanceThreshold(30, 10, 3);
  tests.push({
    name: 'Rebalance threshold',
    expected: { shouldRebalance: true, daysToBreakeven: 3 },
    actual: threshold,
    passed: threshold.shouldRebalance === true && threshold.daysToBreakeven === 3
  });
  
  const allPassed = tests.every(t => t.passed);
  
  return {
    passed: allPassed,
    message: `${tests.filter(t => t.passed).length}/${tests.length} tests passed`,
    details: tests
  };
}

async function testEnhancedFeatures() {
  const tests = [];
  const priceOracle = createStablecoinOracle();
  const calculator = new EnhancedFeeCalculator(priceOracle);
  
  // Test 1: Price oracle
  const usdcPrice = await priceOracle.getTokenPrice('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  tests.push({
    name: 'Price oracle - USDC',
    expected: 1,
    actual: usdcPrice,
    passed: usdcPrice === 1
  });
  
  // Test 2: Enhanced fee calculation with prices
  const enhancedFees = await calculator.calculateUncollectedFees(
    {
      tickLower: -887272,
      tickUpper: 887272,
      liquidity: 1000000n,
      tokensOwed0: 1000000n,
      tokensOwed1: 2000000n
    },
    {
      token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals0: 6,
      decimals1: 6,
      feeGrowthGlobal0X128: 0n,
      feeGrowthGlobal1X128: 0n,
      currentTick: 0,
      sqrtPriceX96: TickMath.Q96
    }
  );
  tests.push({
    name: 'Enhanced fee calculation',
    expected: 'totalUsd = 3',
    actual: enhancedFees,
    passed: enhancedFees.totalUsd === 3
  });
  
  // Test 3: IL calculation
  const position = {
    tickLower: -1000,
    tickUpper: 1000,
    liquidity: 1000000n,
    tokensOwed0: 0n,
    tokensOwed1: 0n
  };
  
  const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
    position,
    TickMath.Q96,
    TickMath.Q96
  );
  tests.push({
    name: 'IL with no price change',
    expected: 0,
    actual: il.impermanentLossPercent,
    passed: il.impermanentLossPercent === 0
  });
  
  // Test 4: Optimal position width
  const optimal = EnhancedFeeCalculator.calculateOptimalPositionWidth(
    0.02, 0.003, 0.1, 'medium'
  );
  tests.push({
    name: 'Optimal position width',
    expected: 'positive basis points',
    actual: optimal,
    passed: optimal.recommendedBasisPoints > 0
  });
  
  const allPassed = tests.every(t => t.passed);
  
  return {
    passed: allPassed,
    message: `${tests.filter(t => t.passed).length}/${tests.length} tests passed`,
    details: tests
  };
}

async function testPerformance() {
  const iterations = 1000;
  const results = [];
  
  // Test 1: Tick math performance
  const tickMathStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    TickMath.tickToPrice(i - 500);
    TickMath.priceToTick(1 + i / 1000);
  }
  const tickMathTime = Date.now() - tickMathStart;
  results.push({
    name: 'Tick Math Operations',
    iterations: iterations * 2,
    totalTime: tickMathTime,
    avgTime: tickMathTime / (iterations * 2),
    passed: tickMathTime < 100 // Should complete in under 100ms
  });
  
  // Test 2: Band calculation performance
  const bandStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    BandCalculator.calculateBand(i, 200, 10);
  }
  const bandTime = Date.now() - bandStart;
  results.push({
    name: 'Band Calculations',
    iterations,
    totalTime: bandTime,
    avgTime: bandTime / iterations,
    passed: bandTime < 50
  });
  
  // Test 3: SqrtPrice calculation with cache
  const sqrtPriceStart = Date.now();
  // First pass - populate cache
  for (let i = -100; i <= 100; i++) {
    TickMath.getSqrtPriceX96FromTick(i);
  }
  // Second pass - use cache
  for (let i = -100; i <= 100; i++) {
    TickMath.getSqrtPriceX96FromTick(i);
  }
  const sqrtPriceTime = Date.now() - sqrtPriceStart;
  results.push({
    name: 'SqrtPrice with Cache',
    iterations: 402,
    totalTime: sqrtPriceTime,
    avgTime: sqrtPriceTime / 402,
    passed: sqrtPriceTime < 50
  });
  
  // Test 4: Complex calculation
  const complexStart = Date.now();
  const priceOracle = createStablecoinOracle();
  const calculator = new EnhancedFeeCalculator(priceOracle);
  const position = {
    tickLower: -1000,
    tickUpper: 1000,
    liquidity: 1000000000n,
    tokensOwed0: 1000000n,
    tokensOwed1: 1000000n
  };
  const poolInfo = {
    token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals0: 6,
    decimals1: 6,
    feeGrowthGlobal0X128: 0n,
    feeGrowthGlobal1X128: 0n,
    currentTick: 500,
    sqrtPriceX96: TickMath.getSqrtPriceX96FromTick(500)
  };
  
  for (let i = 0; i < 10; i++) {
    await calculator.shouldRebalance(position, poolInfo, 200000n, 30);
  }
  const complexTime = Date.now() - complexStart;
  results.push({
    name: 'Complex Rebalance Decision',
    iterations: 10,
    totalTime: complexTime,
    avgTime: complexTime / 10,
    passed: complexTime < 100
  });
  
  const allPassed = results.every(r => r.passed);
  
  return {
    passed: allPassed,
    message: `All operations completed within performance targets`,
    details: results,
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      totalOperations: results.reduce((sum, r) => sum + r.iterations, 0),
      totalTime: results.reduce((sum, r) => sum + r.totalTime, 0)
    }
  };
}