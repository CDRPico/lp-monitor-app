# Post-MVP Follow-up Items

This document contains all features and improvements from the original specification that are NOT included in the weekend MVP. These are organized by priority and timeline.

## Week 1: Core Enhancements (Days 3-7)

### 1. Active Liquidity Estimation
**From Spec:** Section 4.3 - Use TickLens to estimate active liquidity
- [ ] Integrate TickLens contract (0xbfd8137f7d1516D3ea5cA83523914859ec47F573)
- [ ] Implement populated tick fetching around current price
- [ ] Calculate accurate position share of active liquidity
- [ ] Improve fee estimation accuracy using L_active

### 2. Advanced Fee Tracking
**From Spec:** Section 4.3 - feeGrowthInside tracking
- [ ] Implement feeGrowthInside{0,1}X128 differential tracking
- [ ] Calculate exact uncollected fees using on-chain formula
- [ ] Add historical fee accumulation tracking
- [ ] Create fee APY calculations

### 3. Mainnet Fork Testing
**From Spec:** Section 8.2 - Local mainnet fork validation
- [ ] Set up Hardhat/Foundry fork of Arbitrum One
- [ ] Replay historical pool activity
- [ ] Validate economic triggers with real volume data
- [ ] Calibrate gas model with actual transaction costs

## Week 2: Security & Automation (Days 8-14)

### 4. Safe Multisig Integration
**From Spec:** Section 6 & 9.1 - Safe-based execution
- [ ] Deploy Safe wallet on Arbitrum
- [ ] Implement Safe Transaction Service integration
- [ ] Create transaction proposal system
- [ ] Add approval workflow with UI links
- [ ] Store LP NFT in Safe

### 5. Depeg Sentinel
**From Spec:** Section 5.3 - Critical safety feature
- [ ] Integrate Chainlink price feeds for USDC/USDT
- [ ] Implement 1% depeg threshold detection
- [ ] Add 10-minute sustained check
- [ ] Create emergency exit transactions
- [ ] Alternative: 5x band widening logic

### 6. Advanced Triggers
**From Spec:** Section 4.2 & 5.3
- [ ] Volume-weighted band width calculation (7-day)
- [ ] Dynamic band adjustment [±5, ±10] bps
- [ ] Volatility-based trigger adjustments
- [ ] MEV protection considerations

## Week 3: Production Features (Days 15-21)

### 7. Automated Execution Options
**From Spec:** Section 6 - Relayer integration
- [ ] OpenZeppelin Defender setup
  - [ ] Create Defender Relayer
  - [ ] KMS key management
  - [ ] Webhook endpoints
  - [ ] Spending limits
- [ ] Alternative: Gelato Network integration
  - [ ] Gelato resolver contracts
  - [ ] Task creation
  - [ ] Fee payment setup

### 8. Comprehensive Monitoring
**From Spec:** Section 10 - KPIs and telemetry
- [ ] Implement metrics collection:
  - [ ] Net APY and gross fee APY
  - [ ] Gas/fees ratio tracking
  - [ ] Time in range percentage
  - [ ] Rebalances per week
  - [ ] CVaR(5%) of daily PnL
  - [ ] Max drawdown tracking
- [ ] Create Grafana dashboard
- [ ] Set up alerts for KPI breaches

### 9. Advanced Risk Management
**From Spec:** Section 4.5 & 9.4
- [ ] LVR (Loss-Versus-Rebalancing) modeling
- [ ] Swap-level granular analysis
- [ ] 12% drawdown kill switch
- [ ] Position sizing optimization
- [ ] Correlation analysis with other pools

## Week 4+: Advanced Features

### 10. Position Management Enhancements
**From Spec:** Section 5.4 - Execution improvements
- [ ] Implement swap routing for rebalancing
- [ ] Token inventory management
- [ ] Slippage protection
- [ ] Multi-position support
- [ ] Position NFT transfer management

### 11. External Integrations
**From Spec:** Section 7 - Alternative platforms
- [ ] Push Protocol integration
  - [ ] Subscribe to Uniswap V3 LP channel
  - [ ] Custom notification channels
- [ ] Revert Finance integration (benchmark)
  - [ ] Compare auto-range strategies
  - [ ] Performance benchmarking
- [ ] Aperture Finance comparison

### 12. Security Hardening
**From Spec:** Section 9.2 & 9.3
- [ ] Implement Permit2 for approvals
- [ ] Regular approval audits with revoke.cash
- [ ] HTTPS webhook authentication
- [ ] Rate limiting and DDoS protection
- [ ] Secure configuration management

## Production Deployment Checklist

### Pre-Production Requirements
**From Spec:** Section 15 - Go/No-Go criteria
- [ ] 14-day paper trading completed
- [ ] Gas/fees ratio ≤ 20% verified
- [ ] P(Net APY ≥ 10%) ≥ 0.6 confirmed
- [ ] CVaR(5%) of daily PnL ≥ 0
- [ ] Depeg sentinel tested and proven

### Infrastructure Setup
- [ ] Production RPC endpoints (consider paid services)
- [ ] Monitoring and alerting infrastructure
- [ ] Backup and recovery procedures
- [ ] Incident response plan
- [ ] Key management procedures

### Operational Procedures
- [ ] Daily monitoring checklist
- [ ] Weekly performance reviews
- [ ] Monthly strategy adjustments
- [ ] Quarterly security audits

## Research & Development Topics

### 1. Machine Learning Enhancements
- [ ] Optimal band width prediction using historical data
- [ ] Volume forecasting for fee estimation
- [ ] Volatility regime detection
- [ ] Dynamic k-factor optimization

### 2. Cross-Protocol Strategies
- [ ] Hedge IL with options protocols
- [ ] Yield aggregation across multiple pools
- [ ] Cross-chain liquidity provision
- [ ] Integration with lending protocols

### 3. Advanced Math Models
- [ ] Optimal rebalancing theory implementation
- [ ] Multi-dimensional optimization
- [ ] Transaction cost analysis
- [ ] Liquidity fragmentation studies

## Documentation Needed

### Technical Documentation
- [ ] Detailed API documentation
- [ ] Smart contract interaction guide
- [ ] Error handling procedures
- [ ] Performance tuning guide

### Operational Documentation
- [ ] Runbook for common scenarios
- [ ] Troubleshooting guide
- [ ] Disaster recovery procedures
- [ ] Scaling guidelines

### Business Documentation
- [ ] Performance reporting templates
- [ ] Risk disclosure documents
- [ ] Audit trail requirements
- [ ] Compliance considerations

## Estimated Timeline for Full Implementation

| Phase | Duration | Features |
|-------|----------|----------|
| MVP | 2 days | Core monitoring and manual execution |
| Phase 1 | 1 week | Active liquidity, mainnet testing |
| Phase 2 | 1 week | Safe integration, depeg protection |
| Phase 3 | 1 week | Automation, monitoring, production prep |
| Phase 4 | 2 weeks | Advanced features, ML, optimization |
| Total | 5-6 weeks | Full production system |

## Budget Considerations

### Development Costs
- Additional 3-4 weeks of development
- Security audit: $20-50k
- Infrastructure: $200-500/month

### Operational Costs
- Gas fees for rebalancing
- RPC endpoint costs
- Monitoring infrastructure
- Safe transaction fees

### Risk Capital
- Start with $1k pilot (as per spec)
- Scale to $10k after meeting KPIs
- Target $100k+ once fully validated