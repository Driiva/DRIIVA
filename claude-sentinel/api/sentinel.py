"""
Claude Sentinel — Vercel Serverless Proxy
Intercepts Anthropic API calls, scans for injection, blocks or forwards.

Deploy: vercel --prod
Route:  POST /api/sentinel
"""

import os
import json
import logging
from http.server import BaseHTTPRequestHandler

# Add parent dir to path for sentinel import
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sentinel import scan_input, send_telegram_alert, ScanResult, ThreatLevel, BLOCK_THRESHOLD, ALERT_THRESHOLD

try:
    import httpx
except ImportError:
    httpx = None

logger = logging.getLogger("sentinel-proxy")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
SENTINEL_API_KEY = os.getenv("SENTINEL_API_KEY", "")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless function handler."""

    def do_GET(self):
        """Health check endpoint."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "status": "sentinel_active",
            "version": "1.0.0",
            "block_threshold": BLOCK_THRESHOLD,
            "alert_threshold": ALERT_THRESHOLD,
        }).encode())

    def do_POST(self):
        """Proxy endpoint: scan → block or forward to Anthropic."""
        # ── Auth check ──
        auth_header = self.headers.get("Authorization", "")
        expected = f"Bearer {SENTINEL_API_KEY}"
        if not SENTINEL_API_KEY or auth_header != expected:
            self._json_response(401, {"error": "unauthorized", "message": "Invalid or missing SENTINEL_API_KEY"})
            return

        # ── Parse body ──
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)
        try:
            body = json.loads(raw_body)
        except json.JSONDecodeError:
            self._json_response(400, {"error": "invalid_json", "message": "Request body is not valid JSON"})
            return

        # ── Extract messages to scan ──
        messages = body.get("messages", [])
        context = body.pop("x_sentinel_context", "api_proxy")

        # Scan all user messages
        max_score = 0
        all_rules = []
        blocked = False

        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, list):
                    # Handle content blocks (text, image, etc.)
                    text_parts = [b.get("text", "") for b in content if b.get("type") == "text"]
                    content = " ".join(text_parts)

                result = scan_input(content, source="input", context=context)
                if result.score > max_score:
                    max_score = result.score
                all_rules.extend(result.triggered_rules)
                if result.blocked:
                    blocked = True

        # ── Alert if needed ──
        if max_score >= ALERT_THRESHOLD:
            alert_result = ScanResult(
                score=max_score,
                threat_level=ThreatLevel.CRITICAL if blocked else ThreatLevel.HIGH,
                triggered_rules=all_rules,
                blocked=blocked,
                source="api_proxy",
                context=context,
                raw_text=str(messages)[:200],
            )
            send_telegram_alert(alert_result)

        # ── Block if threshold exceeded ──
        if blocked:
            logger.warning(f"BLOCKED: score={max_score} rules={[r['rule'] for r in all_rules]}")
            self._json_response(403, {
                "error": "blocked_by_sentinel",
                "sentinel_score": max_score,
                "triggered_rules": [r["rule"] for r in all_rules],
                "message": "Request blocked: prompt injection detected",
            })
            return

        # ── Forward to Anthropic ──
        if not ANTHROPIC_API_KEY:
            self._json_response(500, {"error": "config_error", "message": "ANTHROPIC_API_KEY not set on server"})
            return

        if httpx is None:
            self._json_response(500, {"error": "dependency_error", "message": "httpx not installed"})
            return

        try:
            headers = {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }

            resp = httpx.post(
                ANTHROPIC_API_URL,
                headers=headers,
                json=body,
                timeout=120,
            )

            # Forward Anthropic's response
            self.send_response(resp.status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Sentinel-Score", str(max_score))
            self.end_headers()
            self.wfile.write(resp.content)

        except httpx.TimeoutException:
            self._json_response(504, {"error": "upstream_timeout", "message": "Anthropic API timed out"})
        except Exception as e:
            logger.error(f"Proxy error: {e}")
            self._json_response(502, {"error": "proxy_error", "message": str(e)})

    def _json_response(self, status_code: int, body: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def log_message(self, format, *args):
        """Suppress default stderr logging in Vercel."""
        logger.info(format % args)
