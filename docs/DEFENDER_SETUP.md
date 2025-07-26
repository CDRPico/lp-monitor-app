# OpenZeppelin Defender Setup Guide

## Account Creation

1. Visit [defender.openzeppelin.com](https://defender.openzeppelin.com)
2. Sign up for a free account
3. Select the **Free tier** (includes):
   - Up to 5 contracts
   - 120 autotasks executions/month
   - Basic monitoring

## API Key Setup

1. Navigate to **Settings** → **API Keys**
2. Click **Create API Key**
3. Configure permissions:
   - ✅ `manage-proposals` - For creating admin proposals
   - ✅ `read-proposals` - For checking proposal status
   - ⬜ `manage-relayers` - Not needed for MVP
4. **Save both keys immediately** (they won't be shown again):
   - API Key: `defender-api-key-xxxxx`
   - Secret Key: `defender-secret-key-xxxxx`

## Configure for Arbitrum

1. Go to **Admin** → **Contracts**
2. Click **Add Contract**
3. Add your position manager contract:
   - Network: `Arbitrum One`
   - Address: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` (NPM)
   - Name: `Uniswap V3 Positions NFT`

## Testing API Access

```bash
# Test your API credentials
curl -X GET "https://api.defender.openzeppelin.com/auth/api-token" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -H "X-Api-Secret: YOUR_SECRET_KEY"

# Should return a JWT token
```

## Integration Notes

- Defender is optional for MVP (manual execution works)
- Useful for creating Safe/Gnosis proposals
- Can automate execution in future versions
- Free tier is sufficient for monitoring single position