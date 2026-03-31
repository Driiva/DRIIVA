"""
Claude Sentinel — Netlify Functions Alternative
Same logic as api/sentinel.py but using Netlify's event handler format.

Deploy: netlify deploy --prod
"""

import os
import json
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sentinel import scan_input, send_telegram_alert, ScanResult, ThreatLevel, BLOCK_THRESHOLD, ALERT_THRESHOLD

try:
    import httpx
except ImportError:
    httpx = None

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
SENTINEL_API_KEY = os.getenv("SENTINEL_API_KEY", "")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


def handler(event, context):
    """Netlify serverless function handler."""
    method = event.get("httpMethod", "GET")

    if method == "GET":
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "status": "sentinel_active",
                "version": "1.0.0",
                "block_threshold": BLOCK_THRESHOLD,
                "alert_threshold": ALERT_THRESHOLD,
            }),
        }

    if method != "POST":
        return {"statusCode": 405, "body": json.dumps({"error": "method_not_allowed"})}

    # Auth check
    headers = event.get("headers", {})
    auth = headers.get("authorization", headers.get("Authorization", ""))
    if not SENTINEL_API_KEY or auth != f"Bearer {SENTINEL_API_KEY}":
        return {"statusCode": 401, "body": json.dumps({"error": "unauthorized"})}

    # Parse body
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "invalid_json"})}

    # Scan messages
    messages = body.get("messages", [])
    sentinel_context = body.pop("x_sentinel_context", "api_proxy")
    max_score = 0
    all_rules = []
    blocked = False

    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, list):
                text_parts = [b.get("text", "") for b in content if b.get("type") == "text"]
                content = " ".join(text_parts)

            result = scan_input(content, source="input", context=sentinel_context)
            if result.score > max_score:
                max_score = result.score
            all_rules.extend(result.triggered_rules)
            if result.blocked:
                blocked = True

    if max_score >= ALERT_THRESHOLD:
        alert_result = ScanResult(
            score=max_score,
            threat_level=ThreatLevel.CRITICAL if blocked else ThreatLevel.HIGH,
            triggered_rules=all_rules,
            blocked=blocked,
            source="api_proxy",
            context=sentinel_context,
            raw_text=str(messages)[:200],
        )
        send_telegram_alert(alert_result)

    if blocked:
        return {
            "statusCode": 403,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "error": "blocked_by_sentinel",
                "sentinel_score": max_score,
                "triggered_rules": [r["rule"] for r in all_rules],
            }),
        }

    # Forward to Anthropic
    if not ANTHROPIC_API_KEY or httpx is None:
        return {"statusCode": 500, "body": json.dumps({"error": "config_error"})}

    try:
        resp = httpx.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
            timeout=120,
        )
        return {
            "statusCode": resp.status_code,
            "headers": {"Content-Type": "application/json", "X-Sentinel-Score": str(max_score)},
            "body": resp.text,
        }
    except Exception as e:
        return {"statusCode": 502, "body": json.dumps({"error": "proxy_error", "message": str(e)})}
