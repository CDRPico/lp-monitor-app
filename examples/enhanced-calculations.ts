/**
 * Example demonstrating the enhanced fee calculations with real prices
 * and proper impermanent loss calculations
 */

import { 
  EnhancedFeeCalculator, 
  PriceOracle, 
  TickMath,
  BandCalculator 
} from '../src/utils';

async function demonstrateEnhancements() {
  console.log('=== Enhanced Uniswap v3 Mathematics Demo ===\n');
  
  // 1. Price Oracle Demo
  console.log('1. Price Oracle with Multiple Sources:');
  const priceOracle = new PriceOracle({
    staticPrices: {
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 0.9998,  // USDC (slight depeg)
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 1.0001,  // USDT
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 2500,   // ETH
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 45000   // WBTC
    },
    cacheTimeMs: 60000 // 1 minute cache
  });
  
  const usdcPrice = await priceOracle.getTokenPrice('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  const ethPrice = await priceOracle.getTokenPrice('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
  console.log(`  USDC Price: $${usdcPrice} (detecting slight depeg)`);
  console.log(`  ETH Price: $${ethPrice}`);
  console.log(`  Relative price ETH/USDC: ${ethPrice/usdcPrice}\n`);
  
  // 2. Enhanced Fee Calculations with Real Prices
  console.log('2. Fee Calculations with Real USD Values:');
  const calculator = new EnhancedFeeCalculator(priceOracle);
  
  const position = {
    tickLower: -887272,
    tickUpper: 887272,
    liquidity: 1000000000n,
    tokensOwed0: 5000000n,  // 5 USDC
    tokensOwed1: 2000000n   // 2 USDT
  };
  
  const poolInfo = {
    token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    decimals0: 6,
    decimals1: 6,
    feeGrowthGlobal0X128: 0n,
    feeGrowthGlobal1X128: 0n,
    currentTick: 100,
    sqrtPriceX96: TickMath.getSqrtPriceX96FromTick(100)
  };
  
  const fees = await calculator.calculateUncollectedFees(position, poolInfo);
  console.log(`  Token0 (USDC): ${fees.token0} tokens = $${fees.token0Usd.toFixed(4)}`);
  console.log(`  Token1 (USDT): ${fees.token1} tokens = $${fees.token1Usd.toFixed(4)}`);
  console.log(`  Total USD: $${fees.totalUsd.toFixed(4)}`);
  console.log(`  Impact of price difference: $${(fees.totalUsd - (fees.token0 + fees.token1)).toFixed(4)}\n`);
  
  // 3. Concentrated Liquidity IL Calculation
  console.log('3. Concentrated Liquidity Impermanent Loss:');
  
  // Create a concentrated position
  const concentratedPosition = {
    tickLower: -1000,  // ~0.9048
    tickUpper: 1000,   // ~1.1052
    liquidity: 1000000000n,
    tokensOwed0: 0n,
    tokensOwed1: 0n
  };
  
  const initialTick = 0;
  const currentTick = 500; // Price moved up
  
  const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
    concentratedPosition,
    TickMath.getSqrtPriceX96FromTick(initialTick),
    TickMath.getSqrtPriceX96FromTick(currentTick)
  );
  
  console.log(`  Initial price: ${TickMath.tickToPrice(initialTick).toFixed(4)}`);
  console.log(`  Current price: ${TickMath.tickToPrice(currentTick).toFixed(4)}`);
  console.log(`  Price change: ${((TickMath.tickToPrice(currentTick) / TickMath.tickToPrice(initialTick) - 1) * 100).toFixed(2)}%`);
  console.log(`  Impermanent Loss: ${il.impermanentLossPercent.toFixed(2)}%`);
  console.log(`  Position still in range: ${BandCalculator.isInRange(currentTick, concentratedPosition.tickLower, concentratedPosition.tickUpper)}\n`);
  
  // 4. Rebalancing Decision Logic
  console.log('4. Smart Rebalancing Decision:');
  
  const outOfRangePosition = {
    tickLower: -500,
    tickUpper: 500,
    liquidity: 1000000000n,
    tokensOwed0: 10000000n,  // 10 USDC in fees
    tokensOwed1: 10000000n   // 10 USDT in fees
  };
  
  const outOfRangePool = {
    ...poolInfo,
    currentTick: 1500  // Well out of range!
  };
  
  const rebalanceDecision = await calculator.shouldRebalance(
    outOfRangePosition,
    outOfRangePool,
    250000n,  // 250k gas units
    35        // 35 gwei
  );
  
  console.log(`  Should rebalance: ${rebalanceDecision.shouldRebalance}`);
  console.log(`  Reason: ${rebalanceDecision.reason}`);
  console.log(`  Daily fees: $${rebalanceDecision.metrics.dailyFeesUsd.toFixed(2)}`);
  console.log(`  Gas cost: $${rebalanceDecision.metrics.gasCostUsd.toFixed(2)}`);
  console.log(`  Days to breakeven: ${rebalanceDecision.metrics.daysToBreakeven.toFixed(2)}\n`);
  
  // 5. Optimal Position Width Calculator
  console.log('5. Optimal Position Width Recommendations:');
  
  const scenarios = [
    { volatility: 0.01, feeRate: 0.0005, desc: 'Stable pair, 0.05% fee' },
    { volatility: 0.05, feeRate: 0.003, desc: 'Volatile pair, 0.3% fee' },
    { volatility: 0.02, feeRate: 0.01, desc: 'Medium volatility, 1% fee' }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n  ${scenario.desc}:`);
    const recommendation = EnhancedFeeCalculator.calculateOptimalPositionWidth(
      scenario.volatility,
      scenario.feeRate,
      0.1,  // 10% of liquidity in similar ranges
      'medium'
    );
    
    console.log(`    Recommended width: ${recommendation.recommendedBasisPoints} basis points`);
    console.log(`    Price range: ±${(recommendation.recommendedBasisPoints/200).toFixed(1)}%`);
    console.log(`    Expected daily return: ${recommendation.expectedDailyReturn.toFixed(3)}%`);
    console.log(`    Max expected IL (annual): ${recommendation.maxExpectedIL.toFixed(2)}%`);
  }
  
  console.log('\n=== Key Improvements Over Basic Implementation ===');
  console.log('✅ Real price feeds instead of hardcoded $1');
  console.log('✅ Proper concentrated liquidity IL formula');
  console.log('✅ Gas cost analysis for rebalancing decisions');
  console.log('✅ Data-driven position width recommendations');
  console.log('✅ Multi-source price oracle with caching');
}

// Run the demo
demonstrateEnhancements().catch(console.error);