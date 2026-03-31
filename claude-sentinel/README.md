# Claude Sentinel

Prompt injection detection engine and API proxy for Anthropic Claude.

## What it does

1. **Scans** all user messages for injection patterns (regex + semantic rules)
2. **Scores** each message 0–100 based on triggered rules
3. **Blocks** requests scoring ≥70 (configurable)
4. **Alerts** via Telegram for scores ≥40
5. **Forwards** clean requests to the Anthropic API

## Architecture

```
Your App → POST /api/sentinel → Sentinel Scanner → Anthropic API
                                    ↓ (if score ≥ 40)
                                 Telegram Alert
                                    ↓ (if score ≥ 70)
                                 403 Blocked
```

## Files

| File | Purpose |
|------|---------|
| `sentinel.py` | Core detection engine (standalone) |
| `ava_pipeline.py` | LangGraph 7-node voice pipeline (Ava receptionist) |
| `test_ava_pipeline.py` | Test suite (7 suites, runs without external APIs) |
| `api/sentinel.py` | Vercel serverless proxy |
| `netlify/functions/sentinel.py` | Netlify alternative |
| `dashboard.html` | Monitoring UI |
| `vercel.json` | Vercel deployment config |

## Quick Start

```bash
# Install
pip install -r requirements.txt

# Test
python test_ava_pipeline.py

# Run locally
python sentinel.py "test message to scan"

# Deploy
vercel --prod
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for proxied requests |
| `SENTINEL_API_KEY` | Yes | — | Shared secret for authenticating to the proxy |
| `SENTINEL_TELEGRAM_TOKEN` | For alerts | — | Telegram bot token (from BotFather) |
| `SENTINEL_TELEGRAM_CHAT_ID` | For alerts | — | Telegram chat ID for alerts |
| `SENTINEL_BLOCK_THRESHOLD` | No | 70 | Score threshold to block requests |
| `SENTINEL_ALERT_THRESHOLD` | No | 40 | Score threshold to send alerts |

## Usage

Replace your Anthropic API calls with the Sentinel proxy:

```typescript
// Before
const response = await fetch('https://api.anthropic.com/v1/messages', {
  headers: { 'x-api-key': ANTHROPIC_API_KEY },
  body: JSON.stringify({ model: 'claude-sonnet-4-20250514', messages })
});

// After
const response = await fetch('https://claude-sentinel.vercel.app/api/sentinel', {
  headers: { 'Authorization': `Bearer ${SENTINEL_API_KEY}` },
  body: JSON.stringify({ model: 'claude-sonnet-4-20250514', messages })
});
```

## Detection Rules

14 pattern-based rules covering:
- System prompt override attempts
- Role hijacking (DAN mode, jailbreak)
- System tag injection (`[SYSTEM]`, `<|im_start|>`)
- Authority claims ("I'm the admin")
- Data exfiltration ("reveal your system prompt")
- Output leak detection (scans Ava's responses too)
- Voice-specific injection (Ava pipeline)
- Unicode smuggling, encoded payloads, language switching

## License

Private — StrydeOS / Driiva internal use.
