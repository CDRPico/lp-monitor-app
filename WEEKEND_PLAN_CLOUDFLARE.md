# Uniswap v3 LP Bot - Weekend MVP (Cloudflare Edition)

## Project Overview
Build a Uniswap v3 liquidity monitoring bot using Cloudflare Workers that:
- Checks position status every 5 minutes via Cron Triggers
- Stores state in KV Namespace and historical data in R2
- Sends Telegram notifications for rebalancing decisions
- Provides transaction data for manual execution or Defender proposals

## Why Cloudflare Workers?
- **Cost**: Likely free tier or <$5/month
- **Simplicity**: Single platform, easy deployment
- **Reliability**: Global edge network
- **Perfect Fit**: Monitoring doesn't need long execution times

## Architecture
```
Cloudflare Worker (Cron) → Check Position → Evaluate Strategy → Store in KV/R2 → Telegram Alert
```

## Weekend Scope - Revised for Cloudflare

### Core Features
1. **Position Monitoring Worker**
   - Cron trigger every 5 minutes
   - Read pool and position state from Arbitrum
   - Store current state in KV Namespace

2. **Strategy Evaluation**
   - Check if position is out of range
   - Calculate uncollected fees
   - Apply economic triggers (fees > gas)

3. **State Management**
   - KV for current state and pending decisions
   - R2 for historical snapshots
   - TTL-based cleanup

4. **Telegram Notifications**
   - Alert when rebalancing is profitable
   - Provide transaction details
   - Interactive commands (/approve, /ignore)

5. **Transaction Building**
   - Generate calldata for manual execution
   - Optional: Create Defender proposals

## Day 1: Core Infrastructure & Logic

### Morning (4 hours)

**Task 1: Cloudflare Project Setup (1 hour)**
```bash
# Initialize project
npm create cloudflare@latest uniswap-lp-bot
cd uniswap-lp-bot

# Install dependencies
npm install ethers@6 @uniswap/v3-sdk @uniswap/sdk-core

# Configure wrangler.toml
name = "uniswap-lp-bot"
main = "src/index.ts"
compatibility_date = "2024-01-15"

[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes

kv_namespaces = [
  { binding = "LP_BOT_KV", id = "xxx", preview_id = "yyy" }
]

r2_buckets = [
  { binding = "lp_bot_historical", bucket_name = "lp-bot-historical" }
]
```

**Task 2: Contract Interfaces (1 hour)**
```typescript
// src/contracts/interfaces.ts
export const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)'
];

export const NPM_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) returns (uint256 amount0, uint256 amount1)',
  'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)',
  'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
];
```

**Task 3: Core Math Functions (2 hours)**
```typescript
// src/utils/math.ts
export class UniswapV3Math {
  static tickToPrice(tick: number): number {
    return Math.pow(1.0001, tick);
  }
  
  static priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }
  
  static calculateBand(currentTick: number, basisPoints: number): {
    tickLower: number;
    tickUpper: number;
  } {
    const halfBand = Math.floor(basisPoints / 2);
    return {
      tickLower: currentTick - halfBand,
      tickUpper: currentTick + halfBand
    };
  }
  
  static getSqrtPriceX96FromTick(tick: number): bigint {
    // Implementation
  }
}
```

### Afternoon (4-6 hours)

**Task 4: Pool Monitoring Service (2 hours)**
```typescript
// src/monitors/pool.ts
import { ethers } from 'ethers';

export class PoolMonitor {
  private provider: ethers.JsonRpcProvider;
  private poolContract: ethers.Contract;
  private npmContract: ethers.Contract;
  
  constructor(rpcUrl: string, poolAddress: string, npmAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
    this.npmContract = new ethers.Contract(npmAddress, NPM_ABI, this.provider);
  }
  
  async getPoolState(): Promise<PoolState> {
    const [slot0, liquidity, feeGrowth0, feeGrowth1] = await Promise.all([
      this.poolContract.slot0(),
      this.poolContract.liquidity(),
      this.poolContract.feeGrowthGlobal0X128(),
      this.poolContract.feeGrowthGlobal1X128()
    ]);
    
    return {
      sqrtPriceX96: slot0.sqrtPriceX96,
      tick: slot0.tick,
      liquidity,
      feeGrowthGlobal0X128: feeGrowth0,
      feeGrowthGlobal1X128: feeGrowth1,
      timestamp: Date.now()
    };
  }
  
  async getPositionState(tokenId: string): Promise<PositionState> {
    const position = await this.npmContract.positions(tokenId);
    const currentTick = (await this.poolContract.slot0()).tick;
    
    return {
      tokenId,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      liquidity: position.liquidity,
      tokensOwed0: position.tokensOwed0,
      tokensOwed1: position.tokensOwed1,
      isInRange: currentTick >= position.tickLower && currentTick < position.tickUpper,
      feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
      feeGrowthInside1LastX128: position.feeGrowthInside1LastX128
    };
  }
}
```

**Task 5: Strategy Engine (2 hours)**
```typescript
// src/strategies/rebalance.ts
export class RebalanceStrategy {
  constructor(private config: StrategyConfig) {}
  
  async evaluate(
    poolState: PoolState,
    positionState: PositionState,
    previousDecisions: RebalanceDecision[]
  ): Promise<RebalanceDecision> {
    const isOutOfRange = !positionState.isInRange;
    const hoursSinceLastRebalance = this.getHoursSinceLastRebalance(previousDecisions);
    const timeCapExceeded = hoursSinceLastRebalance > this.config.timeCapHours;
    
    // Calculate uncollected fees
    const fees = this.calculateUncollectedFees(poolState, positionState);
    const estimatedGasCost = this.config.estimatedGasCostUsd;
    const feeMultiple = fees.totalUsd / estimatedGasCost;
    
    const shouldRebalance = 
      isOutOfRange || 
      timeCapExceeded || 
      feeMultiple >= this.config.feeGasMultiple;
    
    const newRange = shouldRebalance 
      ? UniswapV3Math.calculateBand(poolState.tick, this.config.bandBasisPoints)
      : null;
    
    return {
      shouldRebalance,
      reason: this.getRebalanceReason(isOutOfRange, timeCapExceeded, feeMultiple),
      positionId: positionState.tokenId,
      isInRange: positionState.isInRange,
      uncollectedFees: fees,
      estimatedGasCost,
      profitMultiple: feeMultiple,
      newRange,
      timestamp: Date.now()
    };
  }
}
```

**Task 6: Main Worker (1 hour)**
```typescript
// src/index.ts
export interface Env {
  LP_BOT_KV: KVNamespace;
  lp_bot_historical: R2Bucket;
  ARBITRUM_RPC: string;
  POOL_ADDRESS: string;
  NPM_ADDRESS: string;
  POSITION_TOKEN_ID: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('Running LP bot monitor...');
    
    try {
      // Initialize services
      const monitor = new PoolMonitor(env.ARBITRUM_RPC, env.POOL_ADDRESS, env.NPM_ADDRESS);
      const strategy = new RebalanceStrategy({
        bandBasisPoints: 10, // ±5 bps
        timeCapHours: 24,
        feeGasMultiple: 3,
        estimatedGasCostUsd: 2
      });
      
      // Get current state
      const [poolState, positionState] = await Promise.all([
        monitor.getPoolState(),
        monitor.getPositionState(env.POSITION_TOKEN_ID)
      ]);
      
      // Get previous decisions
      const previousDecisions = await this.getRecentDecisions(env.LP_BOT_KV);
      
      // Evaluate strategy
      const decision = await strategy.evaluate(poolState, positionState, previousDecisions);
      
      // Store current state
      await env.LP_BOT_KV.put('current:pool:state', JSON.stringify(poolState));
      await env.LP_BOT_KV.put('current:position:state', JSON.stringify(positionState));
      
      // If rebalance needed, notify
      if (decision.shouldRebalance) {
        await this.sendTelegramAlert(env, decision);
        await env.LP_BOT_KV.put(
          `decisions:pending:${Date.now()}`,
          JSON.stringify(decision),
          { expirationTtl: 86400 }
        );
      }
      
      // Store historical snapshot
      await this.storeSnapshot(env.lp_bot_historical, { poolState, positionState, decision });
      
    } catch (error) {
      console.error('Monitor error:', error);
      await this.sendErrorAlert(env, error as Error);
    }
  }
};
```

## Day 2: Notifications & Transaction Building

### Morning (4 hours)

**Task 7: Telegram Integration (2 hours)**
```typescript
// src/notifications/telegram.ts
export class TelegramNotifier {
  constructor(private botToken: string, private chatId: string) {}
  
  async sendRebalanceAlert(decision: RebalanceDecision): Promise<void> {
    const message = this.formatRebalanceMessage(decision);
    
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Approve', callback_data: 'approve_rebalance' },
            { text: '❌ Ignore', callback_data: 'ignore_rebalance' },
            { text: '📋 Details', callback_data: 'show_details' }
          ]]
        }
      })
    });
  }
}
```

**Task 8: Transaction Builder (2 hours)**
```typescript
// src/transactions/builder.ts
export class TransactionBuilder {
  buildRebalanceTransactions(
    position: PositionState,
    newRange: { tickLower: number; tickUpper: number },
    npmAddress: string
  ): TransactionData[] {
    const transactions = [];
    
    // 1. Decrease liquidity
    if (position.liquidity > 0n) {
      transactions.push({
        to: npmAddress,
        data: this.encodeDecreaseLiquidity({
          tokenId: position.tokenId,
          liquidity: position.liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: Math.floor(Date.now() / 1000) + 3600
        })
      });
    }
    
    // 2. Collect fees
    transactions.push({
      to: npmAddress,
      data: this.encodeCollect({
        tokenId: position.tokenId,
        recipient: '0x...', // User address
        amount0Max: ethers.MaxUint128,
        amount1Max: ethers.MaxUint128
      })
    });
    
    // 3. Mint new position
    // (Calculate amounts based on collected tokens)
    
    return transactions;
  }
}
```

### Afternoon (4-6 hours)

**Task 9: Webhook Handler (2 hours)**
```typescript
// src/webhook.ts - Separate worker for handling Telegram callbacks
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    const update = await request.json() as TelegramUpdate;
    
    if (update.callback_query) {
      const { data, from } = update.callback_query;
      
      if (data === 'approve_rebalance') {
        // Get latest pending decision
        const decision = await this.getLatestPendingDecision(env.LP_BOT_KV);
        
        if (decision) {
          // Build transactions
          const builder = new TransactionBuilder();
          const transactions = builder.buildRebalanceTransactions(
            decision.positionState,
            decision.newRange,
            env.NPM_ADDRESS
          );
          
          // Send transaction details
          await this.sendTransactionDetails(env, from.id, transactions);
          
          // Mark decision as processed
          await env.LP_BOT_KV.put(
            `decisions:processed:${decision.timestamp}`,
            JSON.stringify({ ...decision, processedAt: Date.now() })
          );
        }
      }
    }
    
    return new Response('OK');
  }
};
```

**Task 10: Testing & Documentation (2 hours)**
- Set up local testing with Miniflare
- Create testnet deployment script
- Write setup documentation
- Test full flow on Arbitrum Sepolia

## Deployment Steps

### 1. Create Cloudflare Resources
```bash
# Create KV namespace
wrangler kv:namespace create "LP_BOT_KV"
wrangler kv:namespace create "LP_BOT_KV" --preview

# Create R2 bucket
wrangler r2 bucket create lp-bot-historical

# Set secrets
wrangler secret put ARBITRUM_RPC
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put DEFENDER_API_KEY  # Optional
```

### 2. Deploy Workers
```bash
# Deploy main monitoring worker
wrangler deploy

# Deploy webhook handler (separate worker)
cd webhook
wrangler deploy
```

### 3. Configure Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://lp-bot-webhook.your-subdomain.workers.dev/telegram"}'
```

## Cost Analysis

**Monthly Usage (Every 5 minutes = 8,640 requests/month)**
- Worker Requests: Free (under 100k/day)
- Worker CPU: Free (under 10ms/invocation)
- KV Reads: Free (under 100k/day)
- KV Writes: Free (under 1k/day)
- R2 Storage: Free (under 10GB)

**Total: $0-5/month**

## Key Advantages

1. **Simplicity**: One platform, easy deployment
2. **Cost**: Essentially free for this use case
3. **Reliability**: Cloudflare's global network
4. **Speed**: Deploy in minutes with `wrangler`
5. **Scalability**: Can handle growth without changes

## MVP Deliverables

1. **Working Monitoring Bot**
   - Checks position every 5 minutes
   - Stores state in KV/R2
   - Evaluates rebalancing triggers

2. **Telegram Notifications**
   - Alerts when action needed
   - Interactive buttons
   - Transaction details on request

3. **Transaction Generation**
   - Valid calldata for manual execution
   - Optional Defender integration

4. **Documentation**
   - Setup guide
   - Configuration options
   - Testing instructions

This Cloudflare-based approach is simpler, cheaper, and perfect for the monitoring use case!