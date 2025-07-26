/**
 * Price oracle interface for fetching token prices
 * Supports multiple price sources for reliability
 */

export interface TokenPrice {
  token: string;
  priceUsd: number;
  timestamp: number;
  source: 'chainlink' | 'uniswap-twap' | 'coingecko' | 'static';
}

export interface PriceOracleConfig {
  chainlinkFeeds?: { [token: string]: string };  // token -> price feed address
  uniswapPools?: { [token: string]: string };    // token -> pool address for TWAP
  staticPrices?: { [token: string]: number };    // fallback static prices
  cacheTimeMs?: number;                          // how long to cache prices
}

export class PriceOracle {
  private priceCache = new Map<string, TokenPrice>();
  private config: PriceOracleConfig;
  
  constructor(config: PriceOracleConfig) {
    this.config = {
      cacheTimeMs: 60000, // 1 minute default
      ...config
    };
  }
  
  /**
   * Get current price for a token in USD
   * Tries multiple sources in order of reliability
   */
  async getTokenPrice(tokenAddress: string): Promise<number> {
    // Check cache first
    const cached = this.priceCache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeMs!) {
      return cached.priceUsd;
    }
    
    // Try Chainlink first (most reliable for supported tokens)
    if (this.config.chainlinkFeeds?.[tokenAddress]) {
      try {
        const price = await this.fetchChainlinkPrice(tokenAddress);
        this.cachePrice(tokenAddress, price, 'chainlink');
        return price;
      } catch (e) {
        console.warn(`Chainlink price fetch failed for ${tokenAddress}:`, e);
      }
    }
    
    // Try Uniswap TWAP (good for any token with liquidity)
    if (this.config.uniswapPools?.[tokenAddress]) {
      try {
        const price = await this.fetchUniswapTWAP(tokenAddress);
        this.cachePrice(tokenAddress, price, 'uniswap-twap');
        return price;
      } catch (e) {
        console.warn(`Uniswap TWAP fetch failed for ${tokenAddress}:`, e);
      }
    }
    
    // Fall back to static prices
    if (this.config.staticPrices?.[tokenAddress]) {
      const price = this.config.staticPrices[tokenAddress];
      this.cachePrice(tokenAddress, price, 'static');
      return price;
    }
    
    throw new Error(`No price available for token ${tokenAddress}`);
  }
  
  /**
   * Get relative price between two tokens (token1/token0)
   * This is what we need for tick/price calculations
   */
  async getRelativePrice(token0: string, token1: string): Promise<number> {
    const [price0, price1] = await Promise.all([
      this.getTokenPrice(token0),
      this.getTokenPrice(token1)
    ]);
    
    return price1 / price0;
  }
  
  /**
   * Batch fetch prices for multiple tokens
   */
  async getTokenPrices(tokens: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    // Fetch all prices in parallel
    const results = await Promise.all(
      tokens.map(async token => {
        try {
          const price = await this.getTokenPrice(token);
          return { token, price };
        } catch (e) {
          console.error(`Failed to fetch price for ${token}:`, e);
          return { token, price: 0 };
        }
      })
    );
    
    results.forEach(({ token, price }) => {
      if (price > 0) prices.set(token, price);
    });
    
    return prices;
  }
  
  private cachePrice(token: string, priceUsd: number, source: TokenPrice['source']) {
    this.priceCache.set(token, {
      token,
      priceUsd,
      timestamp: Date.now(),
      source
    });
  }
  
  /**
   * Placeholder for Chainlink integration
   * In production, this would call Chainlink price feeds
   */
  private async fetchChainlinkPrice(tokenAddress: string): Promise<number> {
    // This would be implemented with actual Chainlink calls
    // For now, throw to trigger fallback
    throw new Error('Chainlink integration not implemented');
  }
  
  /**
   * Placeholder for Uniswap TWAP calculation
   * In production, this would calculate TWAP from pool observations
   */
  private async fetchUniswapTWAP(tokenAddress: string): Promise<number> {
    // This would be implemented with actual Uniswap pool queries
    // For now, throw to trigger fallback
    throw new Error('Uniswap TWAP not implemented');
  }
  
  /**
   * Clear the price cache
   */
  clearCache() {
    this.priceCache.clear();
  }
}

/**
 * Create a price oracle for common stablecoins
 * Useful for testing and as a fallback
 */
export function createStablecoinOracle(): PriceOracle {
  return new PriceOracle({
    staticPrices: {
      // Common stablecoins
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1.0, // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 1.0, // USDT
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': 1.0, // DAI
      '0x4Fabb145d64652a948d72533023f6E7A623C7C53': 1.0, // BUSD
      // Arbitrum stablecoins
      '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': 1.0, // USDC.e
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': 1.0, // USDC native
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': 1.0, // USDT
    },
    cacheTimeMs: 300000 // 5 minutes for stablecoins
  });
}