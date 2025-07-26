/**
 * Contract factory for creating Uniswap v3 contract instances
 * Optimized for Cloudflare Workers environment
 */

import { ethers } from 'ethers';
import { POOL_ABI, NPM_ABI, ERC20_ABI, ARBITRUM_ADDRESSES, ARBITRUM_SEPOLIA_ADDRESSES } from './abis';
import { ContractError, ContractErrorCode, RPCOptions, Slot0, Position } from './types';

// Default RPC options for Cloudflare Workers
const DEFAULT_RPC_OPTIONS: Required<RPCOptions> = {
  timeout: 10000, // 10 seconds (well within 30s worker limit)
  maxRetries: 3,
  retryDelay: 1000
};

export class ContractFactory {
  private provider: ethers.JsonRpcProvider;
  private options: Required<RPCOptions>;
  private isTestnet: boolean;

  constructor(rpcUrl: string, options?: RPCOptions) {
    // Cloudflare Workers have native fetch support
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.options = { ...DEFAULT_RPC_OPTIONS, ...options };
    this.isTestnet = rpcUrl.includes('sepolia');
  }

  /**
   * Get addresses based on network
   */
  private get addresses() {
    return this.isTestnet ? ARBITRUM_SEPOLIA_ADDRESSES : ARBITRUM_ADDRESSES;
  }

  /**
   * Create a Uniswap v3 pool contract instance
   */
  getPool(address: string): ethers.Contract {
    return new ethers.Contract(address, POOL_ABI, this.provider);
  }

  /**
   * Create a NonfungiblePositionManager contract instance
   */
  getNPM(): ethers.Contract {
    const address = this.addresses.NPM;
    return new ethers.Contract(address, NPM_ABI, this.provider);
  }

  /**
   * Create an ERC20 token contract instance
   */
  getToken(address: string): ethers.Contract {
    return new ethers.Contract(address, ERC20_ABI, this.provider);
  }

  /**
   * Execute a contract call with timeout and retry logic
   */
  async callWithRetry<T>(
    contractCall: () => Promise<T>,
    options?: Partial<RPCOptions>
  ): Promise<T> {
    const opts = { ...this.options, ...options };
    let lastError: unknown;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new ContractError(
              `RPC call timed out after ${opts.timeout}ms`,
              ContractErrorCode.RPC_TIMEOUT
            ));
          }, opts.timeout);
        });

        // Race between the contract call and timeout
        const result = await Promise.race([
          contractCall(),
          timeoutPromise
        ]);

        return result;
      } catch (error) {
        lastError = error;

        // Check if it's a rate limit error
        if (error instanceof Error) {
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            throw new ContractError(
              'RPC rate limit exceeded',
              ContractErrorCode.RPC_RATE_LIMIT,
              error
            );
          }
        }

        // Don't retry on timeout for the last attempt
        if (attempt === opts.maxRetries) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, opts.retryDelay * attempt));
      }
    }

    // All retries failed
    if (lastError instanceof ContractError) {
      throw lastError;
    }

    throw new ContractError(
      'Contract call failed after all retries',
      ContractErrorCode.NETWORK_ERROR,
      lastError
    );
  }

  /**
   * Batch multiple contract calls for efficiency
   */
  async batchCalls<T extends readonly unknown[]>(
    calls: readonly (() => Promise<unknown>)[]
  ): Promise<T> {
    const promises = calls.map(call => this.callWithRetry(call));
    return Promise.all(promises) as Promise<T>;
  }

  /**
   * Get pool slot0 data with proper typing
   */
  async getPoolSlot0(poolAddress: string): Promise<Slot0> {
    const pool = this.getPool(poolAddress);
    const result = await this.callWithRetry(() => pool.slot0());
    
    return {
      sqrtPriceX96: result.sqrtPriceX96,
      tick: Number(result.tick),
      observationIndex: Number(result.observationIndex),
      observationCardinality: Number(result.observationCardinality),
      observationCardinalityNext: Number(result.observationCardinalityNext),
      feeProtocol: Number(result.feeProtocol),
      unlocked: result.unlocked
    };
  }

  /**
   * Get position data with proper typing
   */
  async getPosition(tokenId: number): Promise<Position> {
    const npm = this.getNPM();
    const result = await this.callWithRetry(() => npm.positions(tokenId));
    
    return {
      nonce: result.nonce,
      operator: result.operator,
      token0: result.token0,
      token1: result.token1,
      fee: Number(result.fee),
      tickLower: Number(result.tickLower),
      tickUpper: Number(result.tickUpper),
      liquidity: result.liquidity,
      feeGrowthInside0LastX128: result.feeGrowthInside0LastX128,
      feeGrowthInside1LastX128: result.feeGrowthInside1LastX128,
      tokensOwed0: result.tokensOwed0,
      tokensOwed1: result.tokensOwed1
    };
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return this.callWithRetry(() => this.provider.getBlockNumber());
  }

  /**
   * Clean up provider connections
   */
  destroy(): void {
    this.provider.destroy();
  }
}