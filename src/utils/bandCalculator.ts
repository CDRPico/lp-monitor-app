/**
 * Logic for calculating position ranges based on basis points
 * Handles tick spacing alignment and range validation
 */

export class BandCalculator {
  /**
   * Calculates upper and lower ticks for a position
   * @param currentTick - Current pool tick
   * @param basisPoints - Total band width in basis points (1 bp = 1 tick)
   * @param tickSpacing - Pool's tick spacing (1, 10, 60, or 200)
   * @returns Object with tickLower and tickUpper
   */
  static calculateBand(
    currentTick: number,
    basisPoints: number,
    tickSpacing: number = 1
  ): { tickLower: number; tickUpper: number } {
    // Validate inputs
    if (basisPoints <= 0) {
      throw new Error('Basis points must be positive');
    }
    
    const validTickSpacings = [1, 10, 60, 200];
    if (!validTickSpacings.includes(tickSpacing)) {
      throw new Error(`Invalid tick spacing: ${tickSpacing}. Must be one of: ${validTickSpacings.join(', ')}`);
    }
    
    const halfBand = Math.floor(basisPoints / 2);
    
    // Calculate raw bounds
    const rawLower = currentTick - halfBand;
    const rawUpper = currentTick + halfBand;
    
    // Align to tick spacing
    // Lower tick: round down to nearest multiple of tickSpacing
    // Upper tick: round up to nearest multiple of tickSpacing
    const tickLower = Math.floor(rawLower / tickSpacing) * tickSpacing;
    const tickUpper = Math.ceil(rawUpper / tickSpacing) * tickSpacing;
    
    // Ensure we have a valid range
    if (tickLower >= tickUpper) {
      throw new Error('Invalid range: tickLower must be less than tickUpper');
    }
    
    return { tickLower, tickUpper };
  }
  
  /**
   * Checks if current tick is within a position's range
   * Note: Upper tick is exclusive, lower tick is inclusive
   */
  static isInRange(
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): boolean {
    return currentTick >= tickLower && currentTick < tickUpper;
  }
  
  /**
   * Calculates how far out of range a position is (in ticks)
   * Returns 0 if in range, positive number if out of range
   */
  static getOutOfRangeDistance(
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): number {
    if (currentTick < tickLower) {
      return tickLower - currentTick;
    } else if (currentTick >= tickUpper) {
      return currentTick - tickUpper + 1;
    }
    return 0; // In range
  }
  
  /**
   * Calculates the percentage of how far through the range the current tick is
   * 0% = at tickLower, 100% = at tickUpper
   * Returns null if out of range
   */
  static getRangePosition(
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): number | null {
    if (!this.isInRange(currentTick, tickLower, tickUpper)) {
      return null;
    }
    
    const rangeSize = tickUpper - tickLower;
    const position = currentTick - tickLower;
    return (position / rangeSize) * 100;
  }
  
  /**
   * Converts tick spacing to fee tier
   * Standard Uniswap v3 mappings
   */
  static tickSpacingToFeeTier(tickSpacing: number): number {
    const mapping: { [key: number]: number } = {
      1: 100,      // 0.01%
      10: 500,     // 0.05%
      60: 3000,    // 0.30%
      200: 10000   // 1.00%
    };
    
    const feeTier = mapping[tickSpacing];
    if (feeTier === undefined) {
      throw new Error(`Unknown tick spacing: ${tickSpacing}`);
    }
    
    return feeTier;
  }
  
  /**
   * Converts fee tier to tick spacing
   * Inverse of tickSpacingToFeeTier
   */
  static feeTierToTickSpacing(feeTier: number): number {
    const mapping: { [key: number]: number } = {
      100: 1,      // 0.01%
      500: 10,     // 0.05%
      3000: 60,    // 0.30%
      10000: 200   // 1.00%
    };
    
    const tickSpacing = mapping[feeTier];
    if (tickSpacing === undefined) {
      throw new Error(`Unknown fee tier: ${feeTier}`);
    }
    
    return tickSpacing;
  }
  
  /**
   * Calculates optimal band width based on volatility and fee tier
   * This is a simplified heuristic - production implementations should use
   * historical data and more sophisticated models
   */
  static calculateOptimalBandWidth(
    volatility: number,  // Daily volatility as decimal (e.g., 0.02 for 2%)
    feeTier: number,     // Fee tier in basis points
    targetAPR: number = 0.20  // Target annual return as decimal
  ): number {
    // Higher volatility = wider bands needed
    // Higher fees = can use tighter bands
    // This is a simplified model for MVP
    
    const baseBand = 200; // Base band width in ticks
    const volatilityMultiplier = 1 + (volatility * 10); // Scale with volatility
    const feeAdjustment = Math.sqrt(3000 / feeTier); // Normalize to 0.3% fee tier
    
    return Math.round(baseBand * volatilityMultiplier * feeAdjustment);
  }
  
  /**
   * Validates that a tick is properly aligned to tick spacing
   */
  static isAlignedToSpacing(tick: number, tickSpacing: number): boolean {
    return tick % tickSpacing === 0;
  }
  
  /**
   * Aligns a tick to the nearest valid tick given the spacing
   * @param tick - The tick to align
   * @param tickSpacing - The tick spacing to align to
   * @param roundUp - Whether to round up (true) or down (false)
   */
  static alignToSpacing(
    tick: number,
    tickSpacing: number,
    roundUp: boolean = false
  ): number {
    if (roundUp) {
      return Math.ceil(tick / tickSpacing) * tickSpacing;
    } else {
      return Math.floor(tick / tickSpacing) * tickSpacing;
    }
  }
}