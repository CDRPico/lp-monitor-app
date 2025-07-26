# Product Requirement Documents - Cloudflare Edition

## Table of Contents
1. [Project Foundation](#1-project-foundation)
2. [Contract Integration](#2-contract-integration)
3. [Core Mathematics](#3-core-mathematics)
4. [Pool Monitoring](#4-pool-monitoring)
5. [Strategy Engine](#5-strategy-engine)
6. [Transaction Builder](#6-transaction-builder)
7. [Testing Infrastructure](#7-testing-infrastructure)
8. [Alert System](#8-alert-system)
9. [Worker & Runtime](#9-worker--runtime)
10. [Documentation](#10-documentation)

---

## 1. Project Foundation & Cloudflare Setup

### Owner: Both Developers (1.5 hours)
### Dependencies: None

### Objectives
- Initialize a Cloudflare Workers project
- Set up local development with Miniflare
- Configure KV Namespace and R2 bucket
- Install core dependencies

### Deliverables
1. **Package.json** with scripts:
   - `npm run dev` - Run with wrangler dev
   - `npm run build` - Build for deployment
   - `npm run deploy` - Deploy to Cloudflare
   - `npm run test` - Run tests with Miniflare
   - `npm run tail` - Tail worker logs

2. **Wrangler Configuration** (`wrangler.toml`):
   ```toml
   name = "uniswap-lp-bot"
   main = "src/index.ts"
   compatibility_date = "2024-01-15"
   
   [triggers]
   crons = ["*/5 * * * *"]
   
   kv_namespaces = [
     { binding = "LP_BOT_KV", id = "xxx" }
   ]
   
   r2_buckets = [
     { binding = "lp_bot_historical", bucket_name = "lp-bot-historical" }
   ]
   
   [vars]
   ARBITRUM_RPC = "https://arb-mainnet.g.alchemy.com/v2/xxx"
   POOL_ADDRESS = "0x..."
   NPM_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
   ```

3. **Project Structure**:
   ```
   uniswap-lp-bot/
   ├── src/
   │   ├── index.ts          # Main worker entry
   │   ├── monitors/         # Pool & position monitoring
   │   ├── strategies/       # Rebalancing logic
   │   ├── storage/          # KV & R2 interfaces
   │   ├── notifications/    # Telegram integration
   │   ├── transactions/     # Transaction building
   │   └── utils/           # Math & helpers
   ├── test/
   ├── wrangler.toml
   ├── package.json
   └── tsconfig.json
   ```

4. **Dependencies**:
   - @cloudflare/workers-types
   - wrangler@^3.0.0
   - miniflare@^3.0.0 (dev)
   - ethers@^6.0.0
   - vitest@^1.0.0 (dev)
   - esbuild@^0.19.0

### Environment Setup
```bash
# Create KV namespace
wrangler kv:namespace create "LP_BOT_KV"
wrangler kv:namespace create "LP_BOT_KV" --preview

# Create R2 bucket
wrangler r2 bucket create lp-bot-historical

# Set secrets
wrangler secret put TELEGRAM_BOT_TOKEN
```

### Acceptance Criteria
- [ ] Worker runs locally with `wrangler dev`
- [ ] Can access KV and R2 bindings
- [ ] TypeScript compilation works
- [ ] Miniflare tests can run

---

## 2. Contract Integration

### Owner: Developer A (2 hours)
### Dependencies: Project Foundation

### Objectives
- Create minimal ABIs for Uniswap contracts
- Set up ethers.js providers for Cloudflare
- Type-safe contract interfaces
- Handle RPC rate limits

### Deliverables

1. **Contract ABIs** (`src/contracts/abis.ts`):
   ```typescript
   export const POOL_ABI = [
     'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
     'function liquidity() view returns (uint128)',
     'function feeGrowthGlobal0X128() view returns (uint256)',
     'function feeGrowthGlobal1X128() view returns (uint256)'
   ];
   
   export const NPM_ABI = [
     'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
   ];
   ```

2. **Contract Factory** (`src/contracts/factory.ts`):
   ```typescript
   import { ethers } from 'ethers';
   
   export class ContractFactory {
     private provider: ethers.JsonRpcProvider;
     
     constructor(rpcUrl: string) {
       // Note: Cloudflare Workers have fetch built-in
       this.provider = new ethers.JsonRpcProvider(rpcUrl);
     }
     
     getPool(address: string): ethers.Contract {
       return new ethers.Contract(address, POOL_ABI, this.provider);
     }
     
     getNPM(address: string): ethers.Contract {
       return new ethers.Contract(address, NPM_ABI, this.provider);
     }
   }
   ```

3. **Type Definitions** (`src/contracts/types.ts`):
   ```typescript
   export interface Slot0 {
     sqrtPriceX96: bigint;
     tick: number;
     observationIndex: number;
     observationCardinality: number;
     observationCardinalityNext: number;
     feeProtocol: number;
     unlocked: boolean;
   }
   
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
   ```

### Cloudflare-Specific Considerations
- Use native fetch (no node-fetch needed)
- Handle 10-second timeout for RPC calls
- Implement request batching if needed
- Cache contract instances in worker scope

### Acceptance Criteria
- [ ] Contracts can be called from worker
- [ ] Types are properly inferred
- [ ] RPC calls complete within timeout
- [ ] Error handling for network issues

---

## 3. Core Mathematics

### Owner: Developer B (2 hours)
### Dependencies: Project Foundation

### Objectives
- Implement Uniswap v3 math functions
- Ensure compatibility with Cloudflare's number handling
- Create efficient tick/price conversions
- Build band calculation logic

### Deliverables

1. **Tick Math** (`src/utils/tickMath.ts`):
   ```typescript
   export class TickMath {
     static readonly Q96 = 2n ** 96n;
     static readonly Q128 = 2n ** 128n;
     
     static tickToPrice(tick: number): number {
       return Math.pow(1.0001, tick);
     }
     
     static priceToTick(price: number): number {
       return Math.floor(Math.log(price) / Math.log(1.0001));
     }
     
     static getSqrtPriceX96FromTick(tick: number): bigint {
       const absTick = tick < 0 ? -tick : tick;
       let ratio = absTick & 0x1 !== 0
         ? 0xfffcb933bd6fad37aa2d162d1a594001n
         : 0x100000000000000000000000000000000n;
       
       // ... implementation
       return tick > 0 ? ratio : (2n ** 256n - 1n) / ratio;
     }
   }
   ```

2. **Band Calculator** (`src/utils/bandCalculator.ts`):
   ```typescript
   export class BandCalculator {
     static calculateBand(
       currentTick: number,
       basisPoints: number,
       tickSpacing: number = 1
     ): { tickLower: number; tickUpper: number } {
       const halfBand = Math.floor(basisPoints / 2);
       
       // Align to tick spacing
       const rawLower = currentTick - halfBand;
       const rawUpper = currentTick + halfBand;
       
       return {
         tickLower: Math.floor(rawLower / tickSpacing) * tickSpacing,
         tickUpper: Math.ceil(rawUpper / tickSpacing) * tickSpacing
       };
     }
     
     static isInRange(
       currentTick: number,
       tickLower: number,
       tickUpper: number
     ): boolean {
       return currentTick >= tickLower && currentTick < tickUpper;
     }
   }
   ```

3. **Fee Calculator** (`src/utils/feeCalculator.ts`):
   ```typescript
   export class FeeCalculator {
     static calculateUncollectedFees(
       position: Position,
       feeGrowthGlobal0: bigint,
       feeGrowthGlobal1: bigint,
       decimals0: number = 6,
       decimals1: number = 6
     ): { token0: number; token1: number; totalUsd: number } {
       // Simple calculation for MVP
       const fees0 = Number(position.tokensOwed0) / (10 ** decimals0);
       const fees1 = Number(position.tokensOwed1) / (10 ** decimals1);
       
       // Assume USDC/USDT = $1 each
       return {
         token0: fees0,
         token1: fees1,
         totalUsd: fees0 + fees1
       };
     }
   }
   ```

### Cloudflare Considerations
- Be mindful of CPU time limits
- Use efficient algorithms
- Avoid complex BigInt operations where possible
- Cache frequently used calculations

### Acceptance Criteria
- [ ] All math functions return correct values
- [ ] BigInt operations work in Workers
- [ ] Calculations complete quickly
- [ ] Band alignment works correctly

---

## 4. Pool Monitoring

### Owner: Developer A (3 hours)
### Dependencies: Contract Integration

### Objectives
- Create efficient pool state monitoring
- Handle RPC calls within Worker limits
- Implement state comparison logic
- Optimize for 30-second execution limit

### Deliverables

1. **Pool Monitor** (`src/monitors/poolMonitor.ts`):
   ```typescript
   export class PoolMonitor {
     constructor(
       private factory: ContractFactory,
       private poolAddress: string,
       private npmAddress: string
     ) {}
     
     async getPoolState(): Promise<PoolState> {
       const pool = this.factory.getPool(this.poolAddress);
       
       // Batch calls for efficiency
       const [slot0, liquidity, feeGrowth0, feeGrowth1] = await Promise.all([
         pool.slot0(),
         pool.liquidity(),
         pool.feeGrowthGlobal0X128(),
         pool.feeGrowthGlobal1X128()
       ]);
       
       const price = TickMath.tickToPrice(slot0.tick);
       
       return {
         sqrtPriceX96: slot0.sqrtPriceX96,
         tick: slot0.tick,
         price,
         liquidity,
         feeGrowthGlobal0X128: feeGrowth0,
         feeGrowthGlobal1X128: feeGrowth1,
         timestamp: Date.now()
       };
     }
     
     async getPositionState(tokenId: string): Promise<PositionState> {
       const npm = this.factory.getNPM(this.npmAddress);
       const position = await npm.positions(tokenId);
       
       // Get current tick for range check
       const pool = this.factory.getPool(this.poolAddress);
       const { tick: currentTick } = await pool.slot0();
       
       return {
         tokenId,
         ...position,
         isInRange: BandCalculator.isInRange(
           currentTick,
           position.tickLower,
           position.tickUpper
         )
       };
     }
   }
   ```

2. **State Types** (`src/monitors/types.ts`):
   ```typescript
   export interface PoolState {
     sqrtPriceX96: bigint;
     tick: number;
     price: number;
     liquidity: bigint;
     feeGrowthGlobal0X128: bigint;
     feeGrowthGlobal1X128: bigint;
     timestamp: number;
   }
   
   export interface PositionState extends Position {
     tokenId: string;
     isInRange: boolean;
   }
   
   export interface MonitoringResult {
     poolState: PoolState;
     positionState: PositionState;
     error?: string;
   }
   ```

3. **State Comparison** (`src/monitors/stateComparison.ts`):
   ```typescript
   export class StateComparison {
     static hasSignificantChange(
       current: PoolState,
       previous: PoolState | null
     ): boolean {
       if (!previous) return true;
       
       // Check if tick changed significantly
       const tickDiff = Math.abs(current.tick - previous.tick);
       if (tickDiff > 10) return true;
       
       // Check if liquidity changed >5%
       const liqChange = Number(current.liquidity - previous.liquidity) / 
                        Number(previous.liquidity);
       if (Math.abs(liqChange) > 0.05) return true;
       
       return false;
     }
   }
   ```

### Worker-Specific Implementation
- Keep RPC calls under 10 seconds
- Use Promise.all for parallel calls
- Handle RPC errors gracefully
- Don't store large objects in memory

### Acceptance Criteria
- [ ] Monitoring completes in <5 seconds
- [ ] Handles RPC failures gracefully
- [ ] State comparison works correctly
- [ ] Memory usage is minimal

---

## 5. Strategy Engine

### Owner: Developer B (3 hours)
### Dependencies: Core Mathematics, Pool Monitoring

### Objectives
- Implement rebalancing decision logic
- Calculate profitability metrics
- Handle all trigger conditions
- Generate clear recommendations

### Deliverables

1. **Strategy Engine** (`src/strategies/rebalanceStrategy.ts`):
   ```typescript
   export interface StrategyConfig {
     bandBasisPoints: number;      // Default: 10 (±5 bps)
     timeCapHours: number;        // Default: 24
     feeGasMultiple: number;      // Default: 3
     estimatedGasCostUsd: number; // Default: 2
   }
   
   export class RebalanceStrategy {
     constructor(private config: StrategyConfig) {}
     
     async evaluate(
       poolState: PoolState,
       positionState: PositionState,
       lastRebalance?: RebalanceDecision
     ): Promise<RebalanceDecision> {
       // Check triggers
       const isOutOfRange = !positionState.isInRange;
       const hoursSinceRebalance = lastRebalance
         ? (Date.now() - lastRebalance.timestamp) / (1000 * 60 * 60)
         : Infinity;
       const timeCapExceeded = hoursSinceRebalance > this.config.timeCapHours;
       
       // Calculate fees
       const fees = FeeCalculator.calculateUncollectedFees(
         positionState,
         poolState.feeGrowthGlobal0X128,
         poolState.feeGrowthGlobal1X128
       );
       
       // Economic check
       const profitMultiple = fees.totalUsd / this.config.estimatedGasCostUsd;
       const economicTrigger = profitMultiple >= this.config.feeGasMultiple;
       
       const shouldRebalance = isOutOfRange || timeCapExceeded || economicTrigger;
       
       // Calculate new range if rebalancing
       const newRange = shouldRebalance
         ? BandCalculator.calculateBand(
             poolState.tick,
             this.config.bandBasisPoints
           )
         : null;
       
       return {
         shouldRebalance,
         reason: this.determineReason(isOutOfRange, timeCapExceeded, economicTrigger),
         urgency: this.calculateUrgency(isOutOfRange, hoursSinceRebalance),
         positionId: positionState.tokenId,
         currentTick: poolState.tick,
         positionRange: {
           tickLower: positionState.tickLower,
           tickUpper: positionState.tickUpper
         },
         newRange,
         fees,
         estimatedGasCostUsd: this.config.estimatedGasCostUsd,
         profitMultiple,
         timestamp: Date.now()
       };
     }
     
     private determineReason(
       outOfRange: boolean,
       timeCap: boolean,
       economic: boolean
     ): string {
       if (outOfRange) return 'OUT_OF_RANGE';
       if (timeCap) return 'TIME_CAP_EXCEEDED';
       if (economic) return 'ECONOMIC_TRIGGER';
       return 'NONE';
     }
     
     private calculateUrgency(
       outOfRange: boolean,
       hoursSince: number
     ): 'HIGH' | 'MEDIUM' | 'LOW' {
       if (outOfRange) return 'HIGH';
       if (hoursSince > 20) return 'MEDIUM';
       return 'LOW';
     }
   }
   ```

2. **Decision Types** (`src/strategies/types.ts`):
   ```typescript
   export interface RebalanceDecision {
     shouldRebalance: boolean;
     reason: string;
     urgency: 'HIGH' | 'MEDIUM' | 'LOW';
     positionId: string;
     currentTick: number;
     positionRange: {
       tickLower: number;
       tickUpper: number;
     };
     newRange: {
       tickLower: number;
       tickUpper: number;
     } | null;
     fees: {
       token0: number;
       token1: number;
       totalUsd: number;
     };
     estimatedGasCostUsd: number;
     profitMultiple: number;
     timestamp: number;
   }
   ```

### Cloudflare Considerations
- Keep calculations simple and fast
- Avoid complex async operations
- Use pure functions where possible
- Cache config values

### Acceptance Criteria
- [ ] All triggers work correctly
- [ ] Fee calculations are accurate
- [ ] Urgency levels make sense
- [ ] Decision data is complete

---

## 6. Transaction Builder

### Owner: Developer A (3 hours)
### Dependencies: Strategy Engine

### Objectives
- Build valid transaction calldata
- Calculate proper amounts and slippage
- Format for easy manual execution
- Optional Defender integration

### Deliverables

1. **Transaction Builder** (`src/transactions/builder.ts`):
   ```typescript
   import { ethers } from 'ethers';
   
   export class TransactionBuilder {
     constructor(private npmAddress: string) {}
     
     buildRebalanceBundle(
       position: PositionState,
       newRange: { tickLower: number; tickUpper: number },
       recipient: string
     ): TransactionBundle {
       const transactions: TransactionData[] = [];
       const iface = new ethers.Interface(NPM_ABI);
       
       // 1. Decrease liquidity to 0
       if (position.liquidity > 0n) {
         transactions.push({
           to: this.npmAddress,
           data: iface.encodeFunctionData('decreaseLiquidity', [{
             tokenId: position.tokenId,
             liquidity: position.liquidity,
             amount0Min: 0,
             amount1Min: 0,
             deadline: Math.floor(Date.now() / 1000) + 3600
           }]),
           value: '0',
           description: 'Remove all liquidity'
         });
       }
       
       // 2. Collect all fees and tokens
       transactions.push({
         to: this.npmAddress,
         data: iface.encodeFunctionData('collect', [{
           tokenId: position.tokenId,
           recipient: recipient,
           amount0Max: ethers.MaxUint128,
           amount1Max: ethers.MaxUint128
         }]),
         value: '0',
         description: 'Collect fees and tokens'
       });
       
       // 3. Mint new position (simplified - assumes amounts)
       // In production, calculate based on collected amounts
       
       return {
         transactions,
         estimatedGasUnits: 500000n,
         estimatedGasCostUsd: 2.0,
         recipient,
         description: `Rebalance position ${position.tokenId} to ticks [${newRange.tickLower}, ${newRange.tickUpper}]`
       };
     }
     
     formatForExecution(bundle: TransactionBundle): string {
       return bundle.transactions.map((tx, i) => `
   Transaction ${i + 1}: ${tx.description}
   To: ${tx.to}
   Data: ${tx.data}
   Value: ${tx.value}
       `).join('\n\n');
     }
   }
   ```

2. **Transaction Types** (`src/transactions/types.ts`):
   ```typescript
   export interface TransactionData {
     to: string;
     data: string;
     value: string;
     description: string;
   }
   
   export interface TransactionBundle {
     transactions: TransactionData[];
     estimatedGasUnits: bigint;
     estimatedGasCostUsd: number;
     recipient: string;
     description: string;
   }
   ```

3. **Defender Integration** (`src/transactions/defender.ts`):
   ```typescript
   export class DefenderClient {
     constructor(
       private apiKey: string,
       private apiSecret: string
     ) {}
     
     async createProposal(
       bundle: TransactionBundle
     ): Promise<{ id: string; url: string }> {
       // Call Defender API to create proposal
       const response = await fetch('https://api.defender.openzeppelin.com/...', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${await this.getToken()}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           contract: bundle.transactions[0].to,
           title: bundle.description,
           description: `Automated rebalance proposal`,
           type: 'batch',
           metadata: {
             transactions: bundle.transactions
           }
         })
       });
       
       const result = await response.json();
       return {
         id: result.proposalId,
         url: `https://defender.openzeppelin.com/#/proposal/${result.proposalId}`
       };
     }
   }
   ```

### Cloudflare Considerations
- Keep transaction data lightweight
- Format for easy copy/paste
- Handle API calls within timeout
- Provide clear instructions

### Acceptance Criteria
- [ ] Valid calldata generation
- [ ] Clear formatting for manual use
- [ ] Defender integration works
- [ ] Gas estimates are reasonable

---

## 7. Testing Infrastructure

### Owner: Developer B (2 hours)
### Dependencies: All core components

### Objectives
- Set up Miniflare for local testing
- Create test fixtures
- Mock external services
- Build integration tests

### Deliverables

1. **Test Configuration** (`vitest.config.ts`):
   ```typescript
   import { defineConfig } from 'vitest/config';
   
   export default defineConfig({
     test: {
       environment: 'miniflare',
       environmentOptions: {
         kvNamespaces: ['LP_BOT_KV'],
         r2Buckets: ['lp_bot_historical'],
         bindings: {
           ARBITRUM_RPC: 'http://localhost:8545'
         }
       }
     }
   });
   ```

2. **Mock Factories** (`test/mocks/index.ts`):
   ```typescript
   export function mockPoolState(overrides?: Partial<PoolState>): PoolState {
     return {
       sqrtPriceX96: 79228162514264337593543950336n,
       tick: 0,
       price: 1.0,
       liquidity: 1000000000000000000n,
       feeGrowthGlobal0X128: 0n,
       feeGrowthGlobal1X128: 0n,
       timestamp: Date.now(),
       ...overrides
     };
   }
   
   export function mockPositionState(overrides?: Partial<PositionState>): PositionState {
     return {
       tokenId: '12345',
       tickLower: -10,
       tickUpper: 10,
       liquidity: 1000000000000000n,
       tokensOwed0: 1000000n, // 1 USDC
       tokensOwed1: 1000000n, // 1 USDT
       isInRange: true,
       ...overrides
     };
   }
   ```

3. **Integration Tests** (`test/integration/worker.test.ts`):
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import worker from '../src/index';
   
   describe('Worker Integration', () => {
     let env: Env;
     
     beforeEach(() => {
       env = getMiniflareBindings();
     });
     
     it('should run scheduled task successfully', async () => {
       // Mock RPC responses
       fetchMock.mockResponse(async (req) => {
         if (req.url.includes('eth_call')) {
           return mockRPCResponse('slot0', mockSlot0Data);
         }
       });
       
       // Run scheduled event
       const ctx = new ExecutionContext();
       await worker.scheduled(
         new ScheduledController(),
         env,
         ctx
       );
       
       // Verify state was saved
       const poolState = await env.LP_BOT_KV.get('current:pool:state', 'json');
       expect(poolState).toBeDefined();
       expect(poolState.tick).toBe(0);
     });
     
     it('should send alert when out of range', async () => {
       // Setup out of range position
       await env.LP_BOT_KV.put(
         'current:position:state',
         JSON.stringify(mockPositionState({ isInRange: false }))
       );
       
       // Mock Telegram API
       const telegramMock = fetchMock.mockResponse('ok');
       
       // Run worker
       await worker.scheduled(controller, env, ctx);
       
       // Verify Telegram was called
       expect(telegramMock).toHaveBeenCalledWith(
         expect.stringContaining('api.telegram.org')
       );
     });
   });
   ```

### Miniflare Specific Setup
- Use wrangler.toml for bindings
- Mock fetch for external APIs
- Test KV and R2 operations
- Verify cron scheduling

### Acceptance Criteria
- [ ] Tests run with Miniflare
- [ ] RPC calls are mocked
- [ ] State operations work
- [ ] Integration flow passes

---

## 8. Alert System

### Owner: Developer A (2 hours)
### Dependencies: Strategy Engine

### Objectives
- Telegram bot integration
- Clear message formatting
- Interactive buttons
- Error notifications

### Deliverables

1. **Telegram Service** (`src/notifications/telegram.ts`):
   ```typescript
   export class TelegramService {
     private readonly apiUrl: string;
     
     constructor(
       private botToken: string,
       private chatId: string
     ) {
       this.apiUrl = `https://api.telegram.org/bot${botToken}`;
     }
     
     async sendRebalanceAlert(
       decision: RebalanceDecision,
       bundle?: TransactionBundle
     ): Promise<void> {
       const message = this.formatRebalanceMessage(decision);
       
       await fetch(`${this.apiUrl}/sendMessage`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           chat_id: this.chatId,
           text: message,
           parse_mode: 'Markdown',
           reply_markup: {
             inline_keyboard: [[
               { text: '✅ Get Tx Data', callback_data: 'get_tx_data' },
               { text: '📊 View Details', callback_data: 'view_details' },
               { text: '❌ Ignore', callback_data: 'ignore' }
             ]]
           }
         })
       });
     }
     
     private formatRebalanceMessage(decision: RebalanceDecision): string {
       const urgencyEmoji = {
         HIGH: '🔴',
         MEDIUM: '🟡',
         LOW: '🟢'
       };
       
       return `
   ${urgencyEmoji[decision.urgency]} *Rebalance Alert*
   
   📍 *Status*: ${decision.reason.replace(/_/g, ' ')}
   💰 *Uncollected Fees*: $${decision.fees.totalUsd.toFixed(2)}
   ⛽ *Gas Cost*: $${decision.estimatedGasCostUsd.toFixed(2)}
   📈 *Profit Multiple*: ${decision.profitMultiple.toFixed(1)}x
   
   📐 *Current Range*: [${decision.positionRange.tickLower}, ${decision.positionRange.tickUpper}]
   🎯 *New Range*: [${decision.newRange?.tickLower}, ${decision.newRange?.tickUpper}]
   
   _Position #${decision.positionId}_
       `;
     }
     
     async sendError(error: Error, context: string): Promise<void> {
       const message = `
   ❌ *Error in LP Bot*
   
   *Context*: ${context}
   *Error*: \`${error.message}\`
   *Time*: ${new Date().toISOString()}
       `;
       
       await fetch(`${this.apiUrl}/sendMessage`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           chat_id: this.chatId,
           text: message,
           parse_mode: 'Markdown'
         })
       });
     }
   }
   ```

2. **Webhook Handler** (`src/notifications/webhook.ts`):
   ```typescript
   // Separate worker for handling callbacks
   export default {
     async fetch(request: Request, env: Env): Promise<Response> {
       if (request.method !== 'POST') {
         return new Response('Method not allowed', { status: 405 });
       }
       
       const update = await request.json() as TelegramUpdate;
       
       if (update.callback_query) {
         await this.handleCallback(update.callback_query, env);
       }
       
       return new Response('OK');
     },
     
     async handleCallback(query: CallbackQuery, env: Env): Promise<void> {
       const { data, from, message } = query;
       
       if (data === 'get_tx_data') {
         // Get latest decision from KV
         const decisions = await this.getRecentDecisions(env.LP_BOT_KV, 1);
         
         if (decisions.length > 0) {
           const builder = new TransactionBuilder(env.NPM_ADDRESS);
           const bundle = builder.buildRebalanceBundle(
             decisions[0].positionState,
             decisions[0].newRange,
             from.id.toString()
           );
           
           const txMessage = `
   📋 *Transaction Data*
   
   \`\`\`
   ${builder.formatForExecution(bundle)}
   \`\`\`
   
   Copy and execute via your wallet or Safe.
           `;
           
           await this.sendMessage(env, from.id, txMessage);
         }
       }
     }
   };
   ```

### Cloudflare Considerations
- Handle Telegram API timeouts
- Keep messages concise
- Use proper error handling
- Set up webhook correctly

### Acceptance Criteria
- [ ] Alerts are sent successfully
- [ ] Formatting is clear
- [ ] Buttons work correctly
- [ ] Errors are reported

---

## 9. Worker & Runtime

### Owner: Developer B (2 hours)
### Dependencies: All components

### Objectives
- Main worker entry point
- Cron scheduling setup
- State management flow
- Error handling

### Deliverables

1. **Main Worker** (`src/index.ts`):
   ```typescript
   import type { Env } from './types';
   
   export default {
     async scheduled(
       controller: ScheduledController,
       env: Env,
       ctx: ExecutionContext
     ): Promise<void> {
       console.log('Starting LP Bot monitoring cycle...');
       
       try {
         // Initialize services
         const contractFactory = new ContractFactory(env.ARBITRUM_RPC);
         const poolMonitor = new PoolMonitor(
           contractFactory,
           env.POOL_ADDRESS,
           env.NPM_ADDRESS
         );
         const strategy = new RebalanceStrategy({
           bandBasisPoints: parseInt(env.BAND_BPS || '10'),
           timeCapHours: parseInt(env.TIME_CAP_HOURS || '24'),
           feeGasMultiple: parseInt(env.FEE_GAS_MULTIPLE || '3'),
           estimatedGasCostUsd: parseFloat(env.GAS_COST_USD || '2')
         });
         const telegram = new TelegramService(
           env.TELEGRAM_BOT_TOKEN,
           env.TELEGRAM_CHAT_ID
         );
         const stateManager = new StateManager(env.LP_BOT_KV);
         const historyManager = new HistoryManager(env.lp_bot_historical);
         
         // Get current state
         const [poolState, positionState] = await Promise.all([
           poolMonitor.getPoolState(),
           poolMonitor.getPositionState(env.POSITION_TOKEN_ID)
         ]);
         
         // Get last rebalance decision
         const lastDecision = await stateManager.getLastRebalanceDecision();
         
         // Evaluate strategy
         const decision = await strategy.evaluate(
           poolState,
           positionState,
           lastDecision
         );
         
         // Save current state
         await Promise.all([
           stateManager.savePoolState(poolState),
           stateManager.savePositionState(positionState)
         ]);
         
         // If rebalance needed, notify and save decision
         if (decision.shouldRebalance) {
           console.log('Rebalance recommended:', decision.reason);
           
           await Promise.all([
             telegram.sendRebalanceAlert(decision),
             stateManager.savePendingDecision(decision)
           ]);
         }
         
         // Save historical snapshot
         ctx.waitUntil(
           historyManager.saveSnapshot({
             poolState,
             positionState,
             decision,
             timestamp: Date.now()
           })
         );
         
         console.log('Monitoring cycle completed successfully');
         
       } catch (error) {
         console.error('Worker error:', error);
         
         // Try to send error notification
         try {
           const telegram = new TelegramService(
             env.TELEGRAM_BOT_TOKEN,
             env.TELEGRAM_CHAT_ID
           );
           await telegram.sendError(error as Error, 'Scheduled monitoring');
         } catch (notifyError) {
           console.error('Failed to send error notification:', notifyError);
         }
         
         // Re-throw to mark execution as failed
         throw error;
       }
     }
   };
   ```

2. **Environment Types** (`src/types.ts`):
   ```typescript
   export interface Env {
     // KV Namespaces
     LP_BOT_KV: KVNamespace;
     
     // R2 Buckets
     lp_bot_historical: R2Bucket;
     
     // Configuration
     ARBITRUM_RPC: string;
     POOL_ADDRESS: string;
     NPM_ADDRESS: string;
     POSITION_TOKEN_ID: string;
     
     // Strategy Parameters
     BAND_BPS?: string;
     TIME_CAP_HOURS?: string;
     FEE_GAS_MULTIPLE?: string;
     GAS_COST_USD?: string;
     
     // Notifications
     TELEGRAM_BOT_TOKEN: string;
     TELEGRAM_CHAT_ID: string;
     
     // Future automation (Gelato, etc)
     // AUTOMATION_KEY?: string;
   }
   ```

3. **State Management** (`src/storage/stateManager.ts`):
   ```typescript
   export class StateManager {
     constructor(private kv: KVNamespace) {}
     
     async savePoolState(state: PoolState): Promise<void> {
       await this.kv.put(
         'current:pool:state',
         JSON.stringify(state),
         { expirationTtl: 86400 } // 24 hour TTL
       );
     }
     
     async getPoolState(): Promise<PoolState | null> {
       return this.kv.get('current:pool:state', 'json');
     }
     
     async savePendingDecision(decision: RebalanceDecision): Promise<void> {
       await this.kv.put(
         `decisions:pending:${decision.timestamp}`,
         JSON.stringify(decision),
         { expirationTtl: 86400 }
       );
     }
     
     async getRecentDecisions(hours: number): Promise<RebalanceDecision[]> {
       const list = await this.kv.list({ prefix: 'decisions:pending:' });
       const cutoff = Date.now() - (hours * 60 * 60 * 1000);
       
       const decisions: RebalanceDecision[] = [];
       for (const key of list.keys) {
         const timestamp = parseInt(key.name.split(':').pop()!);
         if (timestamp > cutoff) {
           const decision = await this.kv.get(key.name, 'json');
           if (decision) decisions.push(decision as RebalanceDecision);
         }
       }
       
       return decisions.sort((a, b) => b.timestamp - a.timestamp);
     }
   }
   ```

### Cloudflare Runtime Considerations
- Use ctx.waitUntil() for non-critical ops
- Handle all errors gracefully
- Log for debugging
- Keep execution under 30 seconds

### Acceptance Criteria
- [ ] Worker runs on schedule
- [ ] State is persisted correctly
- [ ] Errors are handled
- [ ] Notifications are sent

---

## 10. Documentation

### Owner: Both Developers (Ongoing)
### Dependencies: All components complete

### Objectives
- Comprehensive setup guide
- API documentation
- Troubleshooting guide
- Architecture overview

### Deliverables

1. **README.md**:
   ```markdown
   # Uniswap v3 LP Bot (Cloudflare Edition)
   
   Automated liquidity monitoring for Uniswap v3 using Cloudflare Workers.
   
   ## Features
   - ⏰ Monitors position every 5 minutes
   - 📊 Detects out-of-range positions
   - 💰 Calculates profitability of rebalancing
   - 📱 Sends Telegram alerts
   - 🔧 Generates transaction data
   
   ## Quick Start
   
   1. Clone and install:
   \`\`\`bash
   git clone <repo>
   cd uniswap-lp-bot
   npm install
   \`\`\`
   
   2. Configure wrangler.toml:
   \`\`\`toml
   [vars]
   ARBITRUM_RPC = "your-rpc-url"
   POSITION_TOKEN_ID = "your-position-id"
   \`\`\`
   
   3. Set secrets:
   \`\`\`bash
   wrangler secret put TELEGRAM_BOT_TOKEN
   \`\`\`
   
   4. Deploy:
   \`\`\`bash
   wrangler deploy
   \`\`\`
   ```

2. **Setup Guide** (`docs/SETUP.md`):
   - Creating Telegram bot
   - Getting RPC endpoint
   - Finding position ID
   - Configuring parameters

3. **Architecture** (`docs/ARCHITECTURE.md`):
   - System overview diagram
   - Component descriptions
   - Data flow
   - Storage schema

4. **Troubleshooting** (`docs/TROUBLESHOOTING.md`):
   - Common errors
   - RPC issues
   - Telegram problems
   - Performance tips

### Documentation Standards
- Include code examples
- Explain all parameters
- Provide troubleshooting steps
- Keep updated with changes

### Acceptance Criteria
- [ ] New user can deploy in 30 min
- [ ] All features documented
- [ ] Architecture is clear
- [ ] Common issues covered