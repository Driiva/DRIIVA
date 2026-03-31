"""
Claude Sentinel — Prompt Injection Detection Engine
Standalone scanner with Telegram alerting.

Used by:
  - ava_pipeline.py (inline scanner mirrors this logic)
  - api/sentinel.py (Vercel serverless proxy)
  - Any app that wants pre-flight injection scanning
"""

import os
import re
import time
import hashlib
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

try:
    import httpx
except ImportError:
    httpx = None

# ── Config ──────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.getenv("SENTINEL_TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("SENTINEL_TELEGRAM_CHAT_ID", "")
BLOCK_THRESHOLD = int(os.getenv("SENTINEL_BLOCK_THRESHOLD", "70"))
ALERT_THRESHOLD = int(os.getenv("SENTINEL_ALERT_THRESHOLD", "40"))

logger = logging.getLogger("sentinel")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


# ── Types ───────────────────────────────────────────────────────────

class ThreatLevel(str, Enum):
    CLEAN = "clean"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ScanResult:
    score: int
    threat_level: ThreatLevel
    triggered_rules: list = field(default_factory=list)
    blocked: bool = False
    source: str = "input"
    context: str = ""
    raw_text: str = ""


# ── Detection Rules ─────────────────────────────────────────────────
# (name, pattern, weight, applies_to)

INJECTION_RULES = [
    ("system_prompt_override", r"(?i)(ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?))", 25, "both"),
    ("role_hijack", r"(?i)(you\s+are\s+now|act\s+as\s+if|pretend\s+(to\s+be|you('re|\s+are))|DAN\s+mode|jailbreak)", 25, "input"),
    ("system_tag_injection", r"(<\/?system>|<\/?assistant>|<\/?human>|\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>)", 30, "input"),
    ("authority_claim", r"(?i)(i('m|\s+am)\s+(the\s+|an?\s+)?(admin|administrator|developer|owner|anthropic)|admin\s+override|sudo|root\s+access|bypass\s+auth)", 20, "input"),
    ("data_exfil", r"(?i)(show\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions|api\s+key|secret)|reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)|what('s|\s+is)\s+your\s+system\s+(prompt|message))", 20, "input"),
    ("output_leak", r"(?i)(my\s+system\s+prompt\s+is|here\s+are\s+my\s+instructions|my\s+instructions\s+say)", 25, "output"),
    ("ava_voice_injection", r"(?i)(hey\s+(ava|system|computer),?\s+(ignore|forget|override|switch)|transfer\s+me\s+to\s+(the\s+)?admin|give\s+me\s+(all\s+)?patient\s+(data|records|info))", 25, "input"),
    ("ava_data_harvest", r"(?i)(list\s+(all\s+)?patients?|show\s+(me\s+)?(all\s+)?appointments?|read\s+(back|out)\s+(the\s+)?(database|records)|dump\s+(all|the)\s+data|give\s+me\s+(all\s+)?(the\s+)?patient\s+(data|records|info))", 25, "input"),
    ("urgency_bypass", r"(?i)(this\s+is\s+(an?\s+)?emergency|life\s+or\s+death|critically\s+important\s+that\s+you\s+ignore)", 15, "input"),
    ("new_instructions", r"(?i)(new\s+instructions?|updated?\s+instructions?|from\s+now\s+on|going\s+forward\s+you\s+(must|should|will))", 20, "input"),
    ("language_switch", r"(?i)(в\s*системе|系统提示|نظام|ignorez\s+les\s+instructions|تجاهل)", 15, "input"),
    ("fake_conversation", r"(?i)(earlier\s+you\s+said|you\s+(already\s+)?agreed\s+to|you\s+promised|as\s+we\s+discussed)", 15, "input"),
    ("encoded_payload", r"(?i)(base64|atob|decode\s+this)[:\s]+[A-Za-z0-9+/]{20,}={0,2}", 15, "input"),
    ("unicode_smuggling", r"[\u200b\u200c\u200d\u2060\ufeff]{3,}", 20, "input"),
]


# ── Scanner ─────────────────────────────────────────────────────────

def scan_input(text: str, source: str = "input", context: str = "") -> ScanResult:
    """
    Scan text for prompt injection signals.
    Returns a ScanResult with score, threat level, and triggered rules.
    """
    if not text or not text.strip():
        return ScanResult(score=0, threat_level=ThreatLevel.CLEAN, source=source, context=context, raw_text=text or "")

    triggered = []
    total = 0

    for name, pattern, weight, applies_to in INJECTION_RULES:
        if applies_to != "both" and applies_to != source:
            continue

        matches = re.findall(pattern, text)
        if matches:
            count = len(matches)
            rule_score = weight + min(count - 1, 3) * (weight // 4)
            total += rule_score
            triggered.append({
                "rule": name,
                "weight": rule_score,
                "match_count": count,
                "sample": matches[0] if isinstance(matches[0], str) else str(matches[0]),
            })

    # Voice-specific: unusually long input is suspicious
    if len(text) > 500:
        total += 10
        triggered.append({"rule": "long_input", "weight": 10, "match_count": 1, "sample": f"len={len(text)}"})

    # Cap at 100
    total = min(total, 100)

    # Determine threat level
    if total == 0:
        level = ThreatLevel.CLEAN
    elif total < 20:
        level = ThreatLevel.LOW
    elif total < ALERT_THRESHOLD:
        level = ThreatLevel.MEDIUM
    elif total < BLOCK_THRESHOLD:
        level = ThreatLevel.HIGH
    else:
        level = ThreatLevel.CRITICAL

    return ScanResult(
        score=total,
        threat_level=level,
        triggered_rules=triggered,
        blocked=total >= BLOCK_THRESHOLD,
        source=source,
        context=context,
        raw_text=text,
    )


# ── Telegram Alerting ───────────────────────────────────────────────

def send_telegram_alert(result: ScanResult):
    """Send a Telegram alert for a scan result. Fire-and-forget."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured — skipping alert")
        return

    if httpx is None:
        logger.warning("httpx not installed — skipping Telegram alert")
        return

    emoji = "🔴" if result.score >= BLOCK_THRESHOLD else "🟠" if result.score >= ALERT_THRESHOLD else "🟡"
    blocked_text = "YES" if result.blocked else "No"
    rules_text = ", ".join(r["rule"] for r in result.triggered_rules) or "none"
    raw_preview = result.raw_text[:120] if result.raw_text else "(empty)"

    message = (
        f"{emoji} *SENTINEL ALERT*\n\n"
        f"*Score:* {result.score}/100\n"
        f"*Level:* {result.threat_level.value.upper()}\n"
        f"*Blocked:* {blocked_text}\n"
        f"*Source:* {result.source}\n"
        f"*Context:* {result.context}\n"
        f"*Rules:* {rules_text}\n\n"
        f"*Text:*\n`{raw_preview}`"
    )

    try:
        httpx.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "Markdown"},
            timeout=5,
        )
    except Exception as e:
        logger.error(f"Telegram alert failed: {e}")


# ── Convenience ─────────────────────────────────────────────────────

def scan_and_alert(text: str, source: str = "input", context: str = "") -> ScanResult:
    """Scan text and auto-alert if score >= ALERT_THRESHOLD."""
    result = scan_input(text, source=source, context=context)
    if result.score >= ALERT_THRESHOLD:
        send_telegram_alert(result)
    return result


# ── CLI ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = input("Enter text to scan: ")

    result = scan_input(text)
    print(f"\nScore:   {result.score}/100")
    print(f"Level:   {result.threat_level.value}")
    print(f"Blocked: {result.blocked}")
    if result.triggered_rules:
        print("Rules:")
        for r in result.triggered_rules:
            print(f"  - {r['rule']} (weight: {r['weight']})")
    else:
        print("Rules:   (none)")
