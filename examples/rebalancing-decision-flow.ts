/**
 * Comprehensive example showing how math functions generate rebalancing suggestions
 * This demonstrates the complete decision flow from raw data to actionable advice
 */

import { 
  TickMath, 
  BandCalculator, 
  FeeCalculator,
  EnhancedFeeCalculator,
  PriceOracle,
  createStablecoinOracle
} from '../src/utils';

interface UserPosition {
  tokenId: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  depositedToken0: number;
  depositedToken0Usd: number;
  lastRebalanceTime: number;
}

interface PoolState {
  currentTick: number;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
  volume24h: number;
  feeTier: number;
}

interface RebalancingSuggestion {
  action: 'KEEP' | 'REBALANCE_NOW' | 'MONITOR_CLOSELY' | 'COLLECT_FEES';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  metrics: {
    isInRange: boolean;
    rangeUtilization: number;
    daysOutOfRange: number;
    currentAPR: number;
    projectedAPR: number;
    impermanentLoss: number;
    gasVsFeeRatio: number;
    optimalRange: { tickLower: number; tickUpper: number };
  };
  projectedOutcome: {
    estimatedGasCost: number;
    projectedDailyFees: number;
    breakEvenDays: number;
    aprImprovement: number;
  };
}

class RebalancingAdvisor {
  constructor(
    private priceOracle: PriceOracle,
    private gasPrice: number = 30, // gwei
    private gasUnits: bigint = 300000n // estimated gas for rebalance
  ) {}

  /**
   * Main function that analyzes position and generates suggestion
   */
  async analyzePosition(
    position: UserPosition,
    poolState: PoolState,
    token0Address: string,
    token1Address: string
  ): Promise<RebalancingSuggestion> {
    console.log('\n📊 Analyzing Position...\n');
    
    // Step 1: Calculate current position metrics
    const currentMetrics = await this.calculateCurrentMetrics(
      position, 
      poolState, 
      token0Address, 
      token1Address
    );
    
    // Step 2: Evaluate rebalancing triggers
    const triggers = this.evaluateTriggers(currentMetrics, position, poolState);
    
    // Step 3: Calculate optimal new position
    const optimalPosition = this.calculateOptimalPosition(
      poolState, 
      currentMetrics.volatility
    );
    
    // Step 4: Project outcomes if rebalanced
    const projection = await this.projectRebalanceOutcome(
      position,
      optimalPosition,
      poolState,
      currentMetrics
    );
    
    // Step 5: Generate final recommendation
    const suggestion = this.generateSuggestion(
      currentMetrics,
      triggers,
      projection,
      optimalPosition
    );
    
    this.printAnalysis(currentMetrics, triggers, projection, suggestion);
    
    return suggestion;
  }

  private async calculateCurrentMetrics(
    position: UserPosition,
    poolState: PoolState,
    token0Address: string,
    token1Address: string
  ) {
    const calculator = new EnhancedFeeCalculator(this.priceOracle);
    
    // Check if position is in range
    const isInRange = BandCalculator.isInRange(
      poolState.currentTick,
      position.tickLower,
      position.tickUpper
    );
    
    // Calculate range utilization (how centered we are)
    const rangeUtilization = BandCalculator.getRangePosition(
      poolState.currentTick,
      position.tickLower,
      position.tickUpper
    ) || 0;
    
    // Calculate time out of range
    const hoursOutOfRange = isInRange ? 0 : 
      (Date.now() - position.lastRebalanceTime) / (1000 * 60 * 60);
    const daysOutOfRange = hoursOutOfRange / 24;
    
    // Calculate uncollected fees
    const fees = await calculator.calculateUncollectedFees(
      position,
      {
        token0: token0Address,
        token1: token1Address,
        decimals0: 6,
        decimals1: 6,
        feeGrowthGlobal0X128: poolState.feeGrowthGlobal0X128,
        feeGrowthGlobal1X128: poolState.feeGrowthGlobal1X128,
        currentTick: poolState.currentTick,
        sqrtPriceX96: poolState.sqrtPriceX96
      }
    );
    
    // Estimate daily fee rate
    const hoursSinceLastRebalance = (Date.now() - position.lastRebalanceTime) / (1000 * 60 * 60);
    const dailyFeeRate = FeeCalculator.estimateDailyFeeRate(
      fees.totalUsd,
      hoursSinceLastRebalance
    );
    
    // Calculate current APR
    const currentAPR = FeeCalculator.calculateFeeAPR(
      dailyFeeRate,
      position.depositedToken0Usd
    );
    
    // Calculate IL since deposit
    const depositTick = TickMath.priceToTick(1); // Assuming deposited at 1:1
    const depositSqrtPrice = TickMath.getSqrtPriceX96FromTick(depositTick);
    
    const il = EnhancedFeeCalculator.calculateConcentratedImpermanentLoss(
      position,
      depositSqrtPrice,
      poolState.sqrtPriceX96
    );
    
    // Estimate volatility from 24h volume
    const volatility = Math.sqrt(poolState.volume24h / Number(poolState.liquidity)) * 0.01;
    
    // Calculate gas cost
    const ethPrice = await this.priceOracle.getTokenPrice('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
    const gasCostUsd = Number(this.gasUnits) * this.gasPrice * 1e-9 * ethPrice;
    
    return {
      isInRange,
      rangeUtilization,
      daysOutOfRange,
      currentAPR,
      dailyFeeRate,
      totalFeesUsd: fees.totalUsd,
      impermanentLoss: il.impermanentLossPercent,
      volatility,
      gasCostUsd,
      currentPrice: TickMath.tickToPrice(poolState.currentTick)
    };
  }

  private evaluateTriggers(metrics: any, position: UserPosition, poolState: PoolState) {
    const triggers = {
      outOfRange: !metrics.isInRange,
      timeCap: metrics.daysOutOfRange > 1, // 24 hour cap
      highGasRatio: metrics.gasCostUsd / metrics.dailyFeeRate > 3,
      extremeRangePosition: metrics.rangeUtilization < 10 || metrics.rangeUtilization > 90,
      highIL: Math.abs(metrics.impermanentLoss) > 5,
      lowAPR: metrics.currentAPR < 10, // Less than 10% APR
      significantPriceMove: false
    };
    
    // Check for significant price move
    const priceAtDeposit = 1; // Assumed
    const currentPrice = metrics.currentPrice;
    const priceChange = Math.abs((currentPrice - priceAtDeposit) / priceAtDeposit);
    triggers.significantPriceMove = priceChange > 0.1; // 10% move
    
    return triggers;
  }

  private calculateOptimalPosition(poolState: PoolState, volatility: number) {
    // Use our optimizer to find best position width
    const optimal = EnhancedFeeCalculator.calculateOptimalPositionWidth(
      volatility,
      FeeCalculator.feeTierToDecimal(poolState.feeTier),
      0.1, // Assume 10% of liquidity is similarly positioned
      'medium'
    );
    
    // Calculate actual tick bounds
    const tickSpacing = BandCalculator.feeTierToTickSpacing(poolState.feeTier);
    const band = BandCalculator.calculateBand(
      poolState.currentTick,
      optimal.recommendedBasisPoints,
      tickSpacing
    );
    
    return {
      ...band,
      expectedAPR: optimal.expectedDailyReturn * 365,
      maxIL: optimal.maxExpectedIL
    };
  }

  private async projectRebalanceOutcome(
    currentPosition: UserPosition,
    optimalPosition: any,
    poolState: PoolState,
    currentMetrics: any
  ) {
    // Estimate fees from new position
    // Assume similar volume but better concentration
    const concentrationBonus = (currentPosition.tickUpper - currentPosition.tickLower) / 
                             (optimalPosition.tickUpper - optimalPosition.tickLower);
    
    const projectedDailyFees = currentMetrics.dailyFeeRate * Math.sqrt(concentrationBonus);
    const projectedAPR = (projectedDailyFees * 365 / currentPosition.depositedToken0Usd) * 100;
    
    // Calculate break-even
    const breakEvenDays = currentMetrics.gasCostUsd / projectedDailyFees;
    const aprImprovement = projectedAPR - currentMetrics.currentAPR;
    
    return {
      estimatedGasCost: currentMetrics.gasCostUsd,
      projectedDailyFees,
      projectedAPR,
      breakEvenDays,
      aprImprovement
    };
  }

  private generateSuggestion(
    metrics: any,
    triggers: any,
    projection: any,
    optimalPosition: any
  ): RebalancingSuggestion {
    let action: RebalancingSuggestion['action'] = 'KEEP';
    let urgency: RebalancingSuggestion['urgency'] = 'low';
    const reasons: string[] = [];
    
    // Decision logic
    if (triggers.outOfRange) {
      if (triggers.timeCap || projection.breakEvenDays < 3) {
        action = 'REBALANCE_NOW';
        urgency = triggers.timeCap ? 'critical' : 'high';
        reasons.push(`Position out of range for ${metrics.daysOutOfRange.toFixed(1)} days`);
        if (triggers.timeCap) reasons.push('Exceeded 24-hour out-of-range limit');
        if (projection.breakEvenDays < 3) reasons.push(`Gas cost recoverable in ${projection.breakEvenDays.toFixed(1)} days`);
      } else {
        action = 'MONITOR_CLOSELY';
        urgency = 'medium';
        reasons.push('Position out of range but gas costs are high relative to fees');
        reasons.push(`Would take ${projection.breakEvenDays.toFixed(1)} days to recover gas costs`);
      }
    } else if (triggers.extremeRangePosition) {
      action = 'MONITOR_CLOSELY';
      urgency = 'medium';
      reasons.push(`Price at ${metrics.rangeUtilization.toFixed(0)}% of range - close to boundary`);
    } else if (triggers.highIL && projection.aprImprovement > 5) {
      action = 'REBALANCE_NOW';
      urgency = 'medium';
      reasons.push(`High impermanent loss: ${metrics.impermanentLoss.toFixed(2)}%`);
      reasons.push(`Rebalancing would improve APR by ${projection.aprImprovement.toFixed(1)}%`);
    } else if (metrics.totalFeesUsd > metrics.gasCostUsd * 2) {
      action = 'COLLECT_FEES';
      urgency = 'low';
      reasons.push(`${metrics.totalFeesUsd.toFixed(2)} USD in uncollected fees`);
    } else {
      reasons.push('Position is performing well');
      reasons.push(`Current APR: ${metrics.currentAPR.toFixed(1)}%`);
    }
    
    return {
      action,
      urgency,
      reasons,
      metrics: {
        isInRange: metrics.isInRange,
        rangeUtilization: metrics.rangeUtilization,
        daysOutOfRange: metrics.daysOutOfRange,
        currentAPR: metrics.currentAPR,
        projectedAPR: projection.projectedAPR,
        impermanentLoss: metrics.impermanentLoss,
        gasVsFeeRatio: metrics.gasCostUsd / metrics.dailyFeeRate,
        optimalRange: optimalPosition
      },
      projectedOutcome: projection
    };
  }

  private printAnalysis(metrics: any, triggers: any, projection: any, suggestion: RebalancingSuggestion) {
    console.log('📈 Current Position Status:');
    console.log(`  • In Range: ${metrics.isInRange ? '✅ Yes' : '❌ No'}`);
    console.log(`  • Range Utilization: ${metrics.rangeUtilization.toFixed(0)}%`);
    console.log(`  • Current APR: ${metrics.currentAPR.toFixed(1)}%`);
    console.log(`  • Uncollected Fees: $${metrics.totalFeesUsd.toFixed(2)}`);
    console.log(`  • Impermanent Loss: ${metrics.impermanentLoss.toFixed(2)}%`);
    
    console.log('\n🎯 Triggers Evaluated:');
    Object.entries(triggers).forEach(([key, value]) => {
      console.log(`  • ${key}: ${value ? '⚠️  Triggered' : '✅ OK'}`);
    });
    
    console.log('\n💡 Rebalancing Projection:');
    console.log(`  • Gas Cost: $${projection.estimatedGasCost.toFixed(2)}`);
    console.log(`  • Projected Daily Fees: $${projection.projectedDailyFees.toFixed(2)}`);
    console.log(`  • Break-even: ${projection.breakEvenDays.toFixed(1)} days`);
    console.log(`  • APR Improvement: ${projection.aprImprovement > 0 ? '+' : ''}${projection.aprImprovement.toFixed(1)}%`);
    
    console.log(`\n🎬 Action: ${suggestion.action} (${suggestion.urgency} urgency)`);
    console.log('📝 Reasons:');
    suggestion.reasons.forEach(reason => console.log(`  • ${reason}`));
  }
}

// Example usage
async function demonstrateRebalancingDecisions() {
  const oracle = new PriceOracle({
    staticPrices: {
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1.0, // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 1.0, // USDT
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 2500 // ETH
    }
  });
  
  const advisor = new RebalancingAdvisor(oracle);
  
  // Scenario 1: Position out of range for 12 hours
  console.log('=== Scenario 1: Out of Range Position ===');
  const outOfRangePosition: UserPosition = {
    tokenId: 12345,
    tickLower: -1000,
    tickUpper: 1000,
    liquidity: 1000000000n,
    tokensOwed0: 5000000n, // 5 USDC
    tokensOwed1: 5000000n, // 5 USDT
    depositedToken0: 10000,
    depositedToken0Usd: 10000,
    lastRebalanceTime: Date.now() - (12 * 60 * 60 * 1000) // 12 hours ago
  };
  
  const currentPool: PoolState = {
    currentTick: 2000, // Well out of range
    sqrtPriceX96: TickMath.getSqrtPriceX96FromTick(2000),
    liquidity: 10000000000n,
    feeGrowthGlobal0X128: 1000000n,
    feeGrowthGlobal1X128: 1000000n,
    volume24h: 1000000,
    feeTier: 3000 // 0.3%
  };
  
  await advisor.analyzePosition(
    outOfRangePosition,
    currentPool,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  );
  
  // Scenario 2: In range but near boundary
  console.log('\n\n=== Scenario 2: Near Range Boundary ===');
  const nearBoundaryPosition: UserPosition = {
    ...outOfRangePosition,
    lastRebalanceTime: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
  };
  
  const nearBoundaryPool: PoolState = {
    ...currentPool,
    currentTick: 900, // Near upper boundary
    sqrtPriceX96: TickMath.getSqrtPriceX96FromTick(900)
  };
  
  await advisor.analyzePosition(
    nearBoundaryPosition,
    nearBoundaryPool,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  );
  
  // Scenario 3: Perfectly centered position
  console.log('\n\n=== Scenario 3: Well-Positioned ===');
  const centeredPosition: UserPosition = {
    ...outOfRangePosition,
    tickLower: -500,
    tickUpper: 500,
    tokensOwed0: 20000000n, // 20 USDC in fees
    tokensOwed1: 20000000n, // 20 USDT in fees
    lastRebalanceTime: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days ago
  };
  
  const centeredPool: PoolState = {
    ...currentPool,
    currentTick: 0, // Perfectly centered
    sqrtPriceX96: TickMath.Q96
  };
  
  await advisor.analyzePosition(
    centeredPosition,
    centeredPool,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  );
}

// Run demonstration
demonstrateRebalancingDecisions().catch(console.error);