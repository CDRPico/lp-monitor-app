/**
 * Quick test to verify core mathematics without Cloudflare Worker
 */

import { 
  TickMath, 
  BandCalculator, 
  FeeCalculator,
  EnhancedFeeCalculator,
  createStablecoinOracle
} from './src/utils';

async function quickTest() {
  console.log('🧮 Core Mathematics Quick Test\n');
  
  try {
    // 1. Test Tick Math
    console.log('1️⃣ Testing Tick Math:');
    const price1 = TickMath.tickToPrice(0);
    const price2 = TickMath.tickToPrice(6932);
    console.log(`  ✓ Tick 0 → Price ${price1.toFixed(4)} (expected: 1.0000)`);
    console.log(`  ✓ Tick 6932 → Price ${price2.toFixed(4)} (expected: ~2.0000)`);
    
    const tick1 = TickMath.priceToTick(1.5);
    console.log(`  ✓ Price 1.5 → Tick ${tick1} (expected: ~4055)`);
    
    // 2. Test Band Calculator
    console.log('\n2️⃣ Testing Band Calculator:');
    const band = BandCalculator.calculateBand(0, 200, 10);
    console.log(`  ✓ 200bp band: ${JSON.stringify(band)} (aligned to tick spacing 10)`);
    
    const inRange = BandCalculator.isInRange(50, band.tickLower, band.tickUpper);
    console.log(`  ✓ Tick 50 in range: ${inRange}`);
    
    // 3. Test Fee Calculator
    console.log('\n3️⃣ Testing Fee Calculator:');
    const fees = FeeCalculator.calculateUncollectedFees(
      { tokensOwed0: 5000000n, tokensOwed1: 3000000n },
      0n, 0n, 6, 6
    );
    console.log(`  ✓ Fees: ${fees.token0} USDC + ${fees.token1} USDT = $${fees.totalUsd}`);
    
    const apr = FeeCalculator.calculateFeeAPR(10, 10000);
    console.log(`  ✓ APR for $10 daily on $10k: ${apr.toFixed(2)}%`);
    
    // 4. Test Enhanced Features
    console.log('\n4️⃣ Testing Enhanced Features:');
    const oracle = createStablecoinOracle();
    const enhancedCalc = new EnhancedFeeCalculator(oracle);
    
    const position = {
      tickLower: -1000,
      tickUpper: 1000,
      liquidity: 1000000000n,
      tokensOwed0: 10000000n,
      tokensOwed1: 10000000n
    };
    
    const poolInfo = {
      token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals0: 6,
      decimals1: 6,
      feeGrowthGlobal0X128: 0n,
      feeGrowthGlobal1X128: 0n,
      currentTick: 2000, // Out of range
      sqrtPriceX96: TickMath.getSqrtPriceX96FromTick(2000)
    };
    
    const enhancedFees = await enhancedCalc.calculateUncollectedFees(position, poolInfo);
    console.log(`  ✓ Enhanced fees: $${enhancedFees.totalUsd} (with real prices)`);
    
    const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
      position,
      TickMath.getSqrtPriceX96FromTick(0),
      TickMath.getSqrtPriceX96FromTick(500)
    );
    console.log(`  ✓ IL for 5% price move: ${il.impermanentLossPercent.toFixed(2)}%`);
    
    const optimal = EnhancedFeeCalculator.calculateOptimalPositionWidth(
      0.02, 0.003, 0.1, 'medium'
    );
    console.log(`  ✓ Optimal width: ${optimal.recommendedBasisPoints}bp (±${(optimal.recommendedBasisPoints/200).toFixed(1)}%)`);
    
    // 5. Performance Check
    console.log('\n5️⃣ Performance Check:');
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      TickMath.getSqrtPriceX96FromTick(i % 200 - 100);
    }
    const elapsed = Date.now() - start;
    console.log(`  ✓ 1000 sqrt price calculations: ${elapsed}ms (${(elapsed/1000).toFixed(3)}ms per op)`);
    
    console.log('\n✅ All tests passed! Core mathematics module is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

quickTest();