/**
 * TypeScript interfaces for Uniswap v3 contract return types
 */

// Pool slot0 return type
export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

// Position data from NonfungiblePositionManager
export interface Position {
  nonce: bigint;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

// Pool state for monitoring
export interface PoolState {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  slot0: Slot0;
  liquidity: bigint;
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
}

// Position state for monitoring
export interface PositionState {
  tokenId: number;
  position: Position;
  pool: PoolState;
  inRange: boolean;
  feesEarned0: bigint;
  feesEarned1: bigint;
}

// RPC call options
export interface RPCOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Error types
export enum ContractErrorCode {
  RPC_TIMEOUT = 'RPC_TIMEOUT',
  RPC_RATE_LIMIT = 'RPC_RATE_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE'
}

export class ContractError extends Error {
  constructor(
    message: string,
    public code: ContractErrorCode,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ContractError';
  }
}