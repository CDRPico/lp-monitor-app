# Uniswap V3 LP Monitoring Bot

An automated monitoring bot for Uniswap V3 liquidity positions on Arbitrum, built with Cloudflare Workers.

## 🚀 Features

- **Automated Monitoring**: Checks position status every 5 minutes via Cloudflare Cron
- **Smart Rebalancing**: Detects when positions are out of range or rebalancing is profitable
- **Telegram Alerts**: Real-time notifications when action is needed
- **Cost Effective**: Runs on Cloudflare Workers (~$0-5/month)
- **Manual Execution**: Provides transaction data for secure manual execution

## 🏗️ Architecture

```
Cloudflare Worker (Cron) → Monitor Position → Evaluate Strategy → Telegram Alert → Manual Execution
```

## 📋 Prerequisites

- Node.js 18+
- Cloudflare account
- Telegram Bot Token
- Arbitrum RPC endpoint (Alchemy/Infura)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/uniswap-lp-bot.git
cd uniswap-lp-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials
```

4. Update `wrangler.toml` with your KV namespace and R2 bucket IDs

## 🔧 Configuration

### Required Environment Variables:
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from BotFather
- `TELEGRAM_CHAT_ID`: Your Telegram chat ID
- `ARBITRUM_RPC`: Your Arbitrum RPC endpoint
- `POSITION_TOKEN_ID`: Your Uniswap V3 position NFT ID

### Strategy Parameters (in wrangler.toml):
- `BAND_BPS`: Band width in basis points (default: 10)
- `TIME_CAP_HOURS`: Maximum hours before forced rebalance (default: 24)
- `FEE_GAS_MULTIPLE`: Minimum fee/gas ratio to trigger rebalance (default: 3)

## 🚀 Development

Run locally:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## 📦 Deployment

1. Create Cloudflare resources:
```bash
wrangler kv:namespace create "LP_BOT_KV"
wrangler r2 bucket create lp-bot-historical
```

2. Set secrets:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```

3. Deploy:
```bash
npm run deploy
```

## 📊 Monitoring

- Check logs: `npm run tail`
- Test manually: Visit `https://your-worker.workers.dev/test`

## 🔐 Security

- No private keys stored in cloud
- Manual transaction execution
- All sensitive data in encrypted secrets

## 📚 Documentation

- [Telegram Setup Guide](docs/TELEGRAM_SETUP.md)
- [Transaction Execution Options](docs/TRANSACTION_EXECUTION.md)
- [Arbitrum Automation Options](docs/ARBITRUM_AUTOMATION_OPTIONS.md)

## 🛣️ Roadmap

- [x] Task 1: Project Foundation & Cloudflare Setup
- [ ] Task 2: Contract Integration
- [ ] Task 3: Core Mathematics
- [ ] Task 4: Pool Monitoring
- [ ] Task 5: Strategy Engine
- [ ] Task 6: Transaction Builder
- [ ] Task 7: Testing Infrastructure
- [ ] Task 8: Alert System
- [ ] Task 9: Worker & Runtime
- [ ] Task 10: Documentation

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.