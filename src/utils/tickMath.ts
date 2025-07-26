/**
 * Core mathematical functions for Uniswap v3 tick conversions
 * Based on Uniswap v3 TickMath library
 */

export class TickMath {
  static readonly Q96 = 2n ** 96n;
  static readonly Q128 = 2n ** 128n;
  
  // Bounds for valid ticks
  static readonly MIN_TICK = -887272;
  static readonly MAX_TICK = 887272;
  
  // Cache for expensive calculations
  private static readonly SQRT_PRICE_CACHE = new Map<number, bigint>();
  
  /**
   * Converts a tick to a price (token1/token0)
   * Price = 1.0001^tick
   */
  static tickToPrice(tick: number): number {
    if (tick < this.MIN_TICK || tick > this.MAX_TICK) {
      throw new Error(`Tick ${tick} is out of bounds`);
    }
    return Math.pow(1.0001, tick);
  }
  
  /**
   * Converts a price to the nearest tick
   * Tick = floor(log(price) / log(1.0001))
   */
  static priceToTick(price: number): number {
    if (price <= 0) {
      throw new Error('Price must be positive');
    }
    const tick = Math.floor(Math.log(price) / Math.log(1.0001));
    if (tick < this.MIN_TICK || tick > this.MAX_TICK) {
      throw new Error(`Calculated tick ${tick} is out of bounds`);
    }
    return tick;
  }
  
  /**
   * Gets sqrtPriceX96 from tick
   * Implementation based on Uniswap v3 math
   * Uses bitwise operations for efficiency
   */
  static getSqrtPriceX96FromTick(tick: number): bigint {
    // Check cache first
    if (this.SQRT_PRICE_CACHE.has(tick)) {
      return this.SQRT_PRICE_CACHE.get(tick)!;
    }
    
    if (tick < this.MIN_TICK || tick > this.MAX_TICK) {
      throw new Error(`Tick ${tick} is out of bounds`);
    }
    
    const absTick = tick < 0 ? -tick : tick;
    let ratio = absTick & 0x1 !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;
    
    // Bitwise operations to calculate ratio efficiently
    if (absTick & 0x2 !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
    if (absTick & 0x4 !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
    if (absTick & 0x8 !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
    if (absTick & 0x10 !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
    if (absTick & 0x20 !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
    if (absTick & 0x40 !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
    if (absTick & 0x80 !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
    if (absTick & 0x100 !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
    if (absTick & 0x200 !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
    if (absTick & 0x400 !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
    if (absTick & 0x800 !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
    if (absTick & 0x1000 !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
    if (absTick & 0x2000 !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
    if (absTick & 0x4000 !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
    if (absTick & 0x8000 !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
    if (absTick & 0x10000 !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
    if (absTick & 0x20000 !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
    if (absTick & 0x40000 !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
    if (absTick & 0x80000 !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;
    
    // If tick is negative, take reciprocal  
    if (tick < 0) ratio = (2n ** 256n - 1n) / ratio;
    
    // Shift to get sqrtPriceX96
    // The magic number calculations give us the value shifted by 128, so we need to shift right by 32
    // to get the sqrtPriceX96 (which is shifted by 96)
    const sqrtPriceX96 = ratio >> 32n;
    
    // Cache the result for future use
    this.SQRT_PRICE_CACHE.set(tick, sqrtPriceX96);
    
    return sqrtPriceX96;
  }
  
  /**
   * Gets tick from sqrtPriceX96
   * Inverse of getSqrtPriceX96FromTick
   * Note: This is a simplified implementation for the MVP
   */
  static getTickFromSqrtPriceX96(sqrtPriceX96: bigint): number {
    // Calculate the actual bounds based on our implementation
    const minSqrtPrice = this.getSqrtPriceX96FromTick(this.MIN_TICK);
    const maxSqrtPrice = this.getSqrtPriceX96FromTick(this.MAX_TICK);
    
    // Ensure sqrtPriceX96 is in valid range
    if (sqrtPriceX96 < minSqrtPrice || sqrtPriceX96 > maxSqrtPrice) {
      throw new Error('sqrtPriceX96 out of bounds');
    }
    
    // For exact Q96, return 0
    if (sqrtPriceX96 === this.Q96) return 0;
    
    // Binary search for the tick
    let tickLow = this.MIN_TICK;
    let tickHigh = this.MAX_TICK;
    
    while (tickLow < tickHigh) {
      const tickMid = Math.floor((tickLow + tickHigh) / 2);
      const sqrtPriceMid = this.getSqrtPriceX96FromTick(tickMid);
      
      if (sqrtPriceMid <= sqrtPriceX96) {
        tickLow = tickMid + 1;
      } else {
        tickHigh = tickMid;
      }
    }
    
    return tickLow - 1;
  }
  
  /**
   * Calculates the amount of token0 for a given amount of liquidity and price range
   */
  static getAmount0ForLiquidity(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint
  ): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }
    
    // amount0 = liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower)) * 2^96
    const numerator1 = liquidity * this.Q96; // liquidity * 2^96
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;
    const denominator = sqrtRatioBX96 * sqrtRatioAX96;
    
    return (numerator1 * numerator2) / denominator;
  }
  
  /**
   * Calculates the amount of token1 for a given amount of liquidity and price range
   */
  static getAmount1ForLiquidity(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint
  ): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }
    
    return liquidity * (sqrtRatioBX96 - sqrtRatioAX96) / this.Q96;
  }
}