# Claude Sentinel — Cloud Deployment Guide

## Vercel (Recommended)

### 1. Link and deploy

```bash
cd claude-sentinel
vercel link          # Creates project "claude-sentinel"
vercel --prod        # Deploy to production
```

### 2. Set environment variables

```bash
# Required
echo "YOUR_KEY" | vercel env add ANTHROPIC_API_KEY production
echo "YOUR_KEY" | vercel env add SENTINEL_API_KEY production

# Telegram alerts (required for monitoring)
echo "YOUR_TOKEN" | vercel env add SENTINEL_TELEGRAM_TOKEN production
echo "YOUR_CHAT_ID" | vercel env add SENTINEL_TELEGRAM_CHAT_ID production

# Optional tuning
echo "70" | vercel env add SENTINEL_BLOCK_THRESHOLD production
echo "40" | vercel env add SENTINEL_ALERT_THRESHOLD production
```

### 3. Verify

```bash
curl https://claude-sentinel.vercel.app/api/sentinel
# Should return: {"status": "sentinel_active", ...}
```

## Netlify (Alternative)

### 1. Deploy

```bash
netlify deploy --prod --dir=.
```

### 2. Set environment variables in Netlify dashboard

Same variables as Vercel (see above).

### 3. Endpoint

```
POST https://your-site.netlify.app/.netlify/functions/sentinel
```

## Environment Variables Reference

| Variable | Required | Where to get it |
|----------|----------|----------------|
| `ANTHROPIC_API_KEY` | Yes | https://console.anthropic.com/settings/keys |
| `SENTINEL_API_KEY` | Yes | Generate: `python3 -c "import secrets; print(secrets.token_hex(24))"` |
| `SENTINEL_TELEGRAM_TOKEN` | For alerts | Telegram BotFather: `/newbot` command |
| `SENTINEL_TELEGRAM_CHAT_ID` | For alerts | Send a message to your bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` |
| `SENTINEL_BLOCK_THRESHOLD` | No (default 70) | Set in dashboard or CLI |
| `SENTINEL_ALERT_THRESHOLD` | No (default 40) | Set in dashboard or CLI |

## Getting Telegram Credentials

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`, follow prompts to name it (e.g., "Sentinel Alerts")
3. Copy the token — this is `SENTINEL_TELEGRAM_TOKEN`
4. Send any message to your new bot
5. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
6. Find `"chat":{"id": 123456789}` — this is `SENTINEL_TELEGRAM_CHAT_ID`

## Integration Snippets

### Driiva (Express server)

```typescript
// server/lib/sentinelProxy.ts
const SENTINEL_URL = process.env.SENTINEL_URL || 'https://claude-sentinel.vercel.app/api/sentinel';
const SENTINEL_KEY = process.env.SENTINEL_API_KEY;

export async function callClaudeViaSentinel(messages: Array<{role: string; content: string}>, options?: {model?: string; maxTokens?: number}) {
  const response = await fetch(SENTINEL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENTINEL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens || 1024,
      messages,
    }),
  });

  if (response.status === 403) {
    const err = await response.json();
    throw new Error(`Sentinel blocked: ${err.triggered_rules?.join(', ')}`);
  }

  return response.json();
}
```

### Ava ElevenLabs Webhook

```typescript
// In your ElevenLabs webhook handler
const result = await callClaudeViaSentinel([
  { role: 'user', content: transcribedSpeech }
], { maxTokens: 300 });
```

## Monitoring

Open `dashboard.html` in a browser and enter your Sentinel URL + API key when prompted. The dashboard shows live scan results, blocked attempts, and configuration.
