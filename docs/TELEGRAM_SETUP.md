# Telegram Bot Setup Guide

## Creating Your Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts:
   - Bot name: `Uniswap LP Monitor` (or your choice)
   - Username: `your_lp_monitor_bot` (must end with 'bot')

## Getting Your Chat ID

1. Start a conversation with your new bot
2. Send any message (e.g., "Hello")
3. Open in browser: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for:
   ```json
   {
     "message": {
       "chat": {
         "id": 123456789  // This is your CHAT_ID
       }
     }
   }
   ```

## Bot Commands to Set Up

Send these commands to BotFather:
1. `/setcommands`
2. Select your bot
3. Send:
   ```
   status - Check bot status
   position - View current position details
   approve - Approve pending rebalance
   ignore - Ignore rebalance recommendation
   help - Show available commands
   ```

## Testing Your Bot

```bash
# Test sending a message
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "<YOUR_CHAT_ID>",
    "text": "Bot is connected!",
    "parse_mode": "Markdown"
  }'
```

## Security Notes

- Never commit your bot token to git
- Keep your chat ID private
- Consider using a private channel instead of direct messages for production