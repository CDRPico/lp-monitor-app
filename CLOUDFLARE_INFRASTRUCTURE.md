# Cloudflare Workers Infrastructure Plan

## Overview
Using Cloudflare Workers with Cron Triggers for a serverless, cost-effective LP monitoring bot.

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Cloudflare Worker   │────▶│ KV Namespace     │────▶│ Telegram Bot    │
│ (Cron Trigger)      │     │ (State Storage)  │     │ (Notifications) │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                           │                         │
         │                           │                         │
         ▼                           ▼                         ▼
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Arbitrum RPC        │     │ R2 Storage       │     │ Manual Execution│
│ (Alchemy/QuickNode) │     │ (Historical Data)│     │ (User Wallet)   │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
```

## Why Cloudflare Workers Work for This Use Case

1. **Cron Triggers**: Support 1-minute minimum intervals (we need 5 minutes)
2. **Execution Time**: 30 seconds CPU time is enough for monitoring checks
3. **KV Storage**: Perfect for current state and recent decisions
4. **R2 Storage**: Ideal for historical data and analytics
5. **Cost**: Extremely cheap - likely under $5/month

## Cloudflare Services Used

### 1. Workers (Cron Triggered)
```typescript
// Main monitoring worker - runs every 5 minutes
export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Monitor pool state
    // Check position
    // Evaluate strategy
    // Send notifications
  }
}
```

### 2. KV Namespace (State Storage)
```typescript
// Key structure
interface KVKeys {
  'current:pool:state': PoolState;
  'current:position:state': PositionState;
  'decisions:pending': RebalanceDecision[];
  'config:strategy': StrategyConfig;
  'metrics:daily': DailyMetrics;
}

// Usage
await env.LP_BOT_KV.put(
  'current:pool:state',
  JSON.stringify(poolState),
  { expirationTtl: 86400 } // 24 hour TTL
);
```

### 3. R2 Storage (Historical Data)
```typescript
// Store historical snapshots for analysis
interface R2Structure {
  '/snapshots/2024/01/15/pool-state-1705332000.json': PoolState;
  '/decisions/2024/01/15/rebalance-1705332000.json': RebalanceDecision;
  '/reports/daily/2024-01-15.json': DailyReport;
}
```

### 4. Durable Objects (Optional - for complex state)
```typescript
// If we need more complex state management
export class PositionManager {
  state: DurableObjectState;
  
  async fetch(request: Request): Promise<Response> {
    // Handle position state updates
    // Manage decision queue
  }
}
```

## Implementation Plan

### 1. Worker Structure
```
cloudflare-lp-bot/
├── src/
│   ├── index.ts           # Main worker entry
│   ├── monitors/
│   │   ├── pool.ts        # Pool state monitoring
│   │   └── position.ts    # Position monitoring
│   ├── strategies/
│   │   ├── rebalance.ts   # Rebalancing logic
│   │   └── triggers.ts    # Trigger conditions
│   ├── notifications/
│   │   └── telegram.ts    # Alert system
│   ├── storage/
│   │   ├── kv.ts         # KV namespace wrapper
│   │   └── r2.ts         # R2 storage wrapper
│   └── utils/
│       ├── contracts.ts   # Contract interfaces
│       └── math.ts        # Uniswap v3 math
├── wrangler.toml          # Cloudflare config
├── package.json
└── tsconfig.json
```

### 2. Wrangler Configuration
```toml
name = "uniswap-lp-bot"
main = "src/index.ts"
compatibility_date = "2024-01-15"

# Cron trigger - every 5 minutes
[triggers]
crons = ["*/5 * * * *"]

# KV Namespaces
kv_namespaces = [
  { binding = "LP_BOT_KV", id = "your-kv-namespace-id" }
]

# R2 Buckets
r2_buckets = [
  { binding = "lp_bot_historical", bucket_name = "lp-bot-historical" }
]

# Environment variables
[vars]
ARBITRUM_RPC = "https://arb-mainnet.g.alchemy.com/v2/your-key"
POSITION_TOKEN_ID = "12345"
TELEGRAM_BOT_TOKEN = "your-bot-token"
TELEGRAM_CHAT_ID = "your-chat-id"

# Secrets (use wrangler secret)
# DEFENDER_API_KEY
# DEFENDER_API_SECRET
```

### 3. Core Monitoring Logic
```typescript
// src/index.ts
export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    try {
      // 1. Fetch current pool state
      const poolMonitor = new PoolMonitor(env.ARBITRUM_RPC);
      const poolState = await poolMonitor.getCurrentState();
      
      // 2. Fetch position state
      const positionMonitor = new PositionMonitor(env.ARBITRUM_RPC);
      const positionState = await positionMonitor.getPositionState(
        env.POSITION_TOKEN_ID
      );
      
      // 3. Store current state
      await env.LP_BOT_KV.put(
        'current:pool:state',
        JSON.stringify(poolState)
      );
      
      // 4. Evaluate strategy
      const strategy = new RebalanceStrategy();
      const decision = await strategy.evaluate(poolState, positionState);
      
      // 5. If action needed, notify user
      if (decision.shouldRebalance) {
        const telegram = new TelegramNotifier(env);
        await telegram.sendRebalanceAlert(decision);
        
        // Store pending decision
        await env.LP_BOT_KV.put(
          `decisions:pending:${Date.now()}`,
          JSON.stringify(decision),
          { expirationTtl: 86400 } // 24 hour TTL
        );
      }
      
      // 6. Store historical snapshot in R2
      const snapshot = {
        timestamp: Date.now(),
        poolState,
        positionState,
        decision
      };
      
      await env.lp_bot_historical.put(
        `snapshots/${new Date().toISOString()}.json`,
        JSON.stringify(snapshot)
      );
      
    } catch (error) {
      console.error('Monitoring error:', error);
      // Send error notification
      const telegram = new TelegramNotifier(env);
      await telegram.sendError(error as Error);
    }
  }
};
```

### 4. State Management Pattern
```typescript
// src/storage/kv.ts
export class StateManager {
  constructor(private kv: KVNamespace) {}
  
  async getCurrentPoolState(): Promise<PoolState | null> {
    const data = await this.kv.get('current:pool:state', 'json');
    return data as PoolState | null;
  }
  
  async getRecentDecisions(hours: number): Promise<RebalanceDecision[]> {
    const keys = await this.kv.list({ prefix: 'decisions:pending:' });
    const decisions: RebalanceDecision[] = [];
    
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    for (const key of keys.keys) {
      const timestamp = parseInt(key.name.split(':').pop()!);
      if (timestamp > cutoff) {
        const decision = await this.kv.get(key.name, 'json');
        if (decision) decisions.push(decision as RebalanceDecision);
      }
    }
    
    return decisions;
  }
  
  async saveMetrics(metrics: DailyMetrics): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    await this.kv.put(
      `metrics:daily:${date}`,
      JSON.stringify(metrics),
      { expirationTtl: 30 * 86400 } // 30 day retention
    );
  }
}
```

### 5. Notification System
```typescript
// src/notifications/telegram.ts
export class TelegramNotifier {
  private botToken: string;
  private chatId: string;
  
  constructor(env: Env) {
    this.botToken = env.TELEGRAM_BOT_TOKEN;
    this.chatId = env.TELEGRAM_CHAT_ID;
  }
  
  async sendRebalanceAlert(decision: RebalanceDecision): Promise<void> {
    const message = `
🔄 *Rebalance Recommended*

📊 Position: #${decision.positionId}
📍 Status: ${decision.isInRange ? 'In Range' : 'Out of Range'}
💰 Uncollected Fees: $${decision.uncollectedFees.toFixed(2)}
⛽ Est. Gas Cost: $${decision.estimatedGasCost.toFixed(2)}
📈 Profit Multiple: ${decision.profitMultiple.toFixed(1)}x

📐 New Range: $${decision.newRange.priceLower.toFixed(4)} - $${decision.newRange.priceUpper.toFixed(4)}

Respond with:
/approve - Execute rebalance
/ignore - Skip this recommendation
/details - View transaction details
    `;
    
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  }
}
```

### 6. Manual Execution Flow
```typescript
// Separate worker for handling user responses
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Telegram webhook endpoint
    if (url.pathname === '/telegram-webhook') {
      const update = await request.json() as TelegramUpdate;
      
      if (update.message?.text?.startsWith('/approve')) {
        // Get pending decision from KV
        const decisions = await new StateManager(env.LP_BOT_KV)
          .getRecentDecisions(1);
        
        if (decisions.length > 0) {
          // Option 1: Return transaction data for manual execution
          const txData = await buildRebalanceTransaction(decisions[0]);
          await sendTelegramMessage(env, `
📋 *Transaction Data*
\`\`\`
To: ${txData.to}
Data: ${txData.data}
Gas Limit: ${txData.gasLimit}
\`\`\`
          `);
          
          // Option 2: Create Defender proposal
          if (env.DEFENDER_API_KEY) {
            const defender = new DefenderClient(env);
            const proposal = await defender.createProposal(txData);
            await sendTelegramMessage(env, 
              `✅ Defender proposal created: ${proposal.url}`
            );
          }
        }
      }
    }
    
    return new Response('OK');
  }
};
```

## Cost Analysis

### Cloudflare Workers Pricing
- **Requests**: 10M free, then $0.50/million
- **CPU Time**: 30M CPU-ms free daily
- **KV Operations**: 100k reads free, 1k writes free daily
- **R2 Storage**: 10GB free, then $0.015/GB

### Monthly Cost Estimate
```
Monitoring runs: 8,640/month (every 5 min)
KV reads: ~26,000/month
KV writes: ~9,000/month
R2 storage: <1GB

Total: ~$5/month (mostly covered by free tier)
```

## Advantages of Cloudflare Approach

1. **Simplicity**: Single platform, no AWS complexity
2. **Cost**: Likely free or <$5/month
3. **Global**: Runs at edge locations worldwide
4. **Fast Deployment**: `wrangler deploy` and done
5. **Built-in Analytics**: Worker analytics included

## Limitations to Consider

1. **No Direct Transaction Execution**: Still need Defender or manual signing
2. **30-Second Limit**: Fine for monitoring, not for complex operations
3. **No WebSockets**: Can't maintain persistent connections
4. **Storage Limits**: KV has 25MB value size limit

## Migration Path

If you outgrow Cloudflare Workers:
1. Export historical data from R2 to S3
2. Move state from KV to DynamoDB
3. Deploy monitoring logic to Lambda
4. Keep Telegram bot on Workers (it works well there)

This architecture gives you a production-ready monitoring system for minimal cost while keeping the door open for future scaling.