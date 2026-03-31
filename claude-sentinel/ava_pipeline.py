"""
╔══════════════════════════════════════════════════════════════════╗
║  AVA — LangGraph Production Pipeline                            ║
║  StrydeOS Voice Receptionist · Spires Physiotherapy              ║
║                                                                  ║
║  Security: Claude Sentinel injection guard                       ║
║  Optimisation: prompt caching, rate limiting, session memory     ║
║  Integration: ElevenLabs, Firestore, n8n                         ║
╚══════════════════════════════════════════════════════════════════╝

PYTHON LEARNING NOTES (for JS/TS developers):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Throughout this file, you'll see comments marked [PY] explaining
Python concepts using JS/TS analogies. These are for you to learn
from — strip them in production if you want a cleaner file.
"""

# ──────────────────────────────────────────────────────────────────
# IMPORTS
# ──────────────────────────────────────────────────────────────────
# [PY] Python imports work like ES modules.
# "from x import y" = import { y } from 'x'
# "import x" = import * as x from 'x'

import os
import json
import time
import hashlib
import logging
from datetime import datetime, timezone
from typing import TypedDict, Optional, Literal  # [PY] TypedDict = like TS interface

# LangGraph — the state machine framework
from langgraph.graph import StateGraph, END

# Anthropic SDK
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    anthropic = None
    ANTHROPIC_AVAILABLE = False

# Firebase (optional — tests run without it)
# [PY] We wrap this in try/except so the file can be imported
# in environments without firebase_admin (like local testing)
try:
    import firebase_admin
    from firebase_admin import credentials, firestore as firestore_module
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    firebase_admin = None
    firestore_module = None

# [PY] "try/except ImportError" = gracefully handle missing packages
# Like a try/catch around require() in Node
try:
    import httpx  # HTTP client, like axios
except ImportError:
    httpx = None

# ──────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────
# [PY] os.getenv("KEY", "default") = process.env.KEY || "default"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
SENTINEL_CLOUD_URL = os.getenv("SENTINEL_CLOUD_URL", "")  # Vercel proxy URL
SENTINEL_API_KEY = os.getenv("SENTINEL_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("SENTINEL_TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("SENTINEL_TELEGRAM_CHAT_ID", "")
N8N_WEBHOOK_URL = os.getenv("AVA_N8N_WEBHOOK_URL", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "")

# Sentinel thresholds
BLOCK_THRESHOLD = int(os.getenv("SENTINEL_BLOCK_THRESHOLD", "70"))
ALERT_THRESHOLD = int(os.getenv("SENTINEL_ALERT_THRESHOLD", "40"))

# Rate limiting
MAX_CALLS_PER_NUMBER_PER_HOUR = 10
MAX_MESSAGES_PER_CALL = 30

# Logging
# [PY] logging = like console.log but with levels (debug/info/warn/error)
# and you can route different levels to different outputs
logger = logging.getLogger("ava")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


# ──────────────────────────────────────────────────────────────────
# FIREBASE INIT
# ──────────────────────────────────────────────────────────────────
# [PY] This runs once when the module loads (like top-level code in a JS module)
# firebase_admin.initialize_app() = admin.initializeApp() in JS

if FIREBASE_AVAILABLE and not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore_module.client() if FIREBASE_AVAILABLE else None


# ──────────────────────────────────────────────────────────────────
# STATE DEFINITION
# ──────────────────────────────────────────────────────────────────
# [PY] TypedDict = like a TypeScript interface.
# Defines the shape of data flowing through the LangGraph pipeline.
#
# In TS this would be:
#   interface AvaState {
#     caller_number: string;
#     caller_input: string;
#     ...
#   }

class AvaState(TypedDict):
    """The state object that flows through every node in the graph."""

    # ── Call metadata ──
    caller_number: str                          # Inbound caller phone number
    call_id: str                                # Unique call session ID
    call_start_time: float                      # Unix timestamp

    # ── Current turn ──
    caller_input: str                           # What the caller just said (transcribed)
    ava_response: str                           # What Ava will say back

    # ── Conversation memory ──
    # [PY] list[dict] = Array<object> in TS
    message_history: list[dict]                 # Running conversation [{role, content}, ...]
    turn_count: int                             # How many exchanges so far

    # ── Sentinel security ──
    sentinel_score: int                         # Injection risk score 0-100
    sentinel_blocked: bool                      # Whether input was blocked
    sentinel_rules: list[str]                   # Which rules fired

    # ── Rate limiting ──
    rate_limited: bool                          # Whether caller hit rate limit

    # ── Booking intent ──
    # [PY] Optional[str] = string | null in TS
    # Literal["booking", "enquiry", ...] = union type of specific strings
    intent: Optional[Literal[
        "booking", "cancel", "reschedule",
        "enquiry", "complaint", "emergency", "unknown"
    ]]
    booking_details: Optional[dict]             # Extracted: date, time, service, name

    # ── Flags ──
    should_end_call: bool                       # Whether to hang up
    escalate_to_human: bool                     # Transfer to clinic staff
    error: Optional[str]                        # Error message if something broke


# ──────────────────────────────────────────────────────────────────
# SENTINEL — LOCAL SCANNER (inline, no import dependency)
# ──────────────────────────────────────────────────────────────────
# [PY] We inline the scanner so this file is self-contained.
# In production you could also use the cloud proxy instead (see
# the CLOUD PROXY node further down as an alternative).

import re  # [PY] regex module — like /pattern/ in JS but as functions

# [PY] This is a list of tuples. A tuple is like a fixed-size array.
# (name, pattern, weight, applies_to)
# JS equivalent: const RULES = [["name", /pattern/, 25, "input"], ...]

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

# ── Ava-specific semantic rules (not regex — pattern matching on meaning) ──
# These catch things regex misses: socially engineered voice attacks
AVA_SEMANTIC_TRIGGERS = [
    # Caller tries to get Ava to confirm she's AI
    r"(?i)(are\s+you\s+(a\s+)?(real|human|robot|ai|bot|computer|machine)|you('re|\s+are)\s+(not\s+)?(real|human|a\s+person))",
    # Caller tries to get personal info about staff
    r"(?i)(what('s|\s+is)\s+(the\s+)?(owner|manager|boss|physio)('s)?\s+(name|number|email|address))",
    # Caller probes for system details
    r"(?i)(what\s+(system|software|platform)\s+(do\s+you|are\s+you)\s+us(e|ing)|what\s+are\s+you\s+built\s+(on|with))",
]


def scan_input(text: str, source: str = "input") -> dict:
    """
    Scan text for injection signals.
    Returns: {score, threat_level, triggered_rules, blocked}

    [PY] Type hints after the colon (text: str) are optional but helpful.
    They're like TypeScript annotations — don't enforce at runtime but
    help editors and linters catch mistakes. The -> dict after the
    parentheses tells you what the function returns.
    """
    if not text or not text.strip():
        return {"score": 0, "threat_level": "clean", "triggered_rules": [], "blocked": False}

    triggered = []
    total = 0

    # [PY] "for name, pattern, weight, applies_to in RULES" = destructuring
    # JS equivalent: for (const [name, pattern, weight, appliesTo] of RULES)
    for name, pattern, weight, applies_to in INJECTION_RULES:
        if applies_to != "both" and applies_to != source:
            continue  # [PY] continue = skip to next iteration, same as JS

        matches = re.findall(pattern, text)
        if matches:
            count = len(matches)  # [PY] len() = .length in JS
            rule_score = weight + min(count - 1, 3) * (weight // 4)
            # [PY] // = integer division (floors the result)
            # 25 // 4 = 6 (not 6.25)
            total += rule_score
            triggered.append({"rule": name, "weight": rule_score})

    # Check Ava semantic triggers (lower weight — these are softer signals)
    for pattern in AVA_SEMANTIC_TRIGGERS:
        if re.search(pattern, text):
            total += 5  # Soft signal, not blocking on its own

    # Voice-specific: unusually long input is suspicious
    if len(text) > 500:
        total += 10
        triggered.append({"rule": "long_voice_input", "weight": 10})

    # Cap at 100
    total = min(total, 100)

    # [PY] Ternary: x if condition else y
    # JS equivalent: condition ? x : y
    if total == 0: level = "clean"
    elif total < 20: level = "low"
    elif total < ALERT_THRESHOLD: level = "medium"
    elif total < BLOCK_THRESHOLD: level = "high"
    else: level = "critical"

    return {
        "score": total,
        "threat_level": level,
        "triggered_rules": triggered,
        "blocked": total >= BLOCK_THRESHOLD,
    }


# ──────────────────────────────────────────────────────────────────
# RATE LIMITER
# ──────────────────────────────────────────────────────────────────
# [PY] A dict used as an in-memory cache.
# In production, you'd use Redis/Upstash for this.
# dict[str, list[float]] = Record<string, number[]> in TS

_rate_cache: dict[str, list[float]] = {}


def check_rate_limit(caller_number: str) -> bool:
    """
    Returns True if the caller has exceeded the rate limit.

    [PY] Mutable default gotcha: never use a mutable object (list, dict)
    as a default argument. Python creates it ONCE and shares it across
    all calls. Use None and create inside the function, or use a module-
    level variable like we do here with _rate_cache.
    """
    now = time.time()
    one_hour_ago = now - 3600

    # [PY] dict.setdefault(key, default) = if key doesn't exist, set it to default and return it
    # Like: cache[number] ??= []
    timestamps = _rate_cache.setdefault(caller_number, [])

    # [PY] List comprehension = .filter() in JS but more powerful
    # [t for t in timestamps if t > one_hour_ago]
    # = timestamps.filter(t => t > oneHourAgo)
    timestamps[:] = [t for t in timestamps if t > one_hour_ago]
    # [PY] timestamps[:] = ... modifies the list IN PLACE
    # Without [:] you'd create a new list and lose the reference

    if len(timestamps) >= MAX_CALLS_PER_NUMBER_PER_HOUR:
        return True  # Rate limited

    timestamps.append(now)
    return False


# ──────────────────────────────────────────────────────────────────
# TELEGRAM ALERTING
# ──────────────────────────────────────────────────────────────────

def alert_telegram(message: str):
    """Fire-and-forget Telegram alert. Non-blocking, never crashes the pipeline."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID or httpx is None:
        logger.warning("Telegram not configured — skipping alert")
        return

    try:
        httpx.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "Markdown"},
            timeout=5,
        )
    except Exception as e:
        logger.error(f"Telegram alert failed: {e}")
        # [PY] We catch broadly and log — never let alerting crash the call


# ──────────────────────────────────────────────────────────────────
# FIRESTORE HELPERS
# ──────────────────────────────────────────────────────────────────

def log_call_to_firestore(state: AvaState):
    """Log call data to Firestore for the dashboard and audit trail."""
    if not FIREBASE_AVAILABLE or db is None:
        logger.debug("Firebase not available — skipping Firestore log")
        return
    try:
        doc_ref = db.collection("ava_calls").document(state["call_id"])
        doc_ref.set({
            "caller_number": _hash_phone(state["caller_number"]),
            "call_id": state["call_id"],
            "start_time": state["call_start_time"],
            "end_time": time.time(),
            "turn_count": state["turn_count"],
            "intent": state.get("intent"),
            "booking_details": state.get("booking_details"),
            "sentinel_max_score": state.get("sentinel_score", 0),
            "sentinel_blocked": state.get("sentinel_blocked", False),
            "escalated": state.get("escalate_to_human", False),
            "rate_limited": state.get("rate_limited", False),
            "error": state.get("error"),
            "created_at": firestore_module.SERVER_TIMESTAMP,
        })
    except Exception as e:
        logger.error(f"Firestore log failed: {e}")


def _hash_phone(number: str) -> str:
    """Hash phone numbers for storage — never store raw PII."""
    # [PY] hashlib works like crypto.createHash() in Node
    return hashlib.sha256(number.encode()).hexdigest()[:16]


# ──────────────────────────────────────────────────────────────────
# N8N WEBHOOK (forward booking intent to n8n for PMS integration)
# ──────────────────────────────────────────────────────────────────

def trigger_n8n_booking(state: AvaState):
    """Send booking data to n8n for appointment creation in the PMS."""
    if not N8N_WEBHOOK_URL or httpx is None:
        logger.warning("n8n webhook not configured")
        return

    try:
        httpx.post(
            N8N_WEBHOOK_URL,
            json={
                "call_id": state["call_id"],
                "caller_number": state["caller_number"],
                "intent": state.get("intent"),
                "booking_details": state.get("booking_details"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            timeout=10,
        )
    except Exception as e:
        logger.error(f"n8n webhook failed: {e}")


# ══════════════════════════════════════════════════════════════════
# LANGGRAPH NODES
# ══════════════════════════════════════════════════════════════════
#
# [PY] Each node is a function that takes the state dict and returns
# a partial dict of updates. LangGraph merges updates into the state.
#
# Think of it like a Redux reducer:
#   function myNode(state) { return { ...partialUpdates } }
#
# The graph connects nodes with edges (including conditional edges)
# to form a DAG (directed acyclic graph) — the pipeline.
#


# ── NODE 1: RATE LIMITER ──────────────────────────────────────────

def rate_limit_node(state: AvaState) -> dict:
    """
    First gate: check if this caller is sending too many requests.
    Catches DoS and brute-force injection attempts.
    """
    caller = state.get("caller_number", "unknown")
    is_limited = check_rate_limit(caller)

    if is_limited:
        logger.warning(f"Rate limited: {_hash_phone(caller)}")
        alert_telegram(
            f"⚠️ *AVA RATE LIMIT*\n"
            f"Caller: `{_hash_phone(caller)}`\n"
            f"Exceeded {MAX_CALLS_PER_NUMBER_PER_HOUR} calls/hour"
        )
        return {
            "rate_limited": True,
            "ava_response": (
                "I'm sorry, we're experiencing a high volume of calls. "
                "Please try again shortly, or you can book online at "
                "spiresphysiotherapy.com."
            ),
            "should_end_call": True,
        }

    return {"rate_limited": False}


# ── NODE 2: SENTINEL GUARD ───────────────────────────────────────

def sentinel_guard_node(state: AvaState) -> dict:
    """
    Second gate: scan caller input for prompt injection.
    Blocks high-risk input, alerts on medium-risk, passes clean.
    """
    text = state.get("caller_input", "")
    result = scan_input(text, source="input")

    score = result["score"]
    blocked = result["blocked"]
    rules = [r["rule"] for r in result.get("triggered_rules", [])]

    # Log all non-clean scans
    if score > 0:
        logger.info(
            f"Sentinel scan: score={score} level={result['threat_level']} "
            f"rules={rules} blocked={blocked}"
        )

    # Alert on medium+ threats
    if score >= ALERT_THRESHOLD:
        emoji = "🔴" if score >= BLOCK_THRESHOLD else "🟠"
        alert_telegram(
            f"{emoji} *AVA SENTINEL ALERT*\n\n"
            f"*Score:* {score}/100\n"
            f"*Level:* {result['threat_level'].upper()}\n"
            f"*Blocked:* {'YES ⛔' if blocked else 'No'}\n"
            f"*Rules:* {', '.join(rules)}\n\n"
            f"*Caller said:*\n`{text[:120]}`"
        )

    if blocked:
        return {
            "sentinel_score": score,
            "sentinel_blocked": True,
            "sentinel_rules": rules,
            "ava_response": (
                "I'm sorry, I wasn't quite able to catch that. "
                "Could you tell me how I can help you today? "
                "I can help with booking appointments, rescheduling, "
                "or answering questions about our services."
            ),
            # Don't end call — give them a chance with a clean message
            "should_end_call": False,
        }

    return {
        "sentinel_score": score,
        "sentinel_blocked": False,
        "sentinel_rules": rules,
    }


# ── NODE 3: INPUT SANITISER ──────────────────────────────────────

def sanitise_input_node(state: AvaState) -> dict:
    """
    Clean the transcribed input before it reaches Claude.
    Removes noise from voice transcription without changing meaning.
    """
    text = state.get("caller_input", "")

    # Strip zero-width characters (unicode smuggling)
    text = re.sub(r"[\u200b\u200c\u200d\u2060\ufeff]", "", text)

    # Collapse excessive whitespace (transcription artefacts)
    text = re.sub(r"\s{3,}", " ", text)

    # Strip any XML/HTML-like tags that might appear in transcription
    text = re.sub(r"<[^>]{1,50}>", "", text)

    # Truncate absurdly long inputs (voice shouldn't produce 2000+ chars)
    # [PY] text[:1500] = text.slice(0, 1500) in JS
    if len(text) > 1500:
        text = text[:1500]

    return {"caller_input": text.strip()}


# ── NODE 4: CONVERSATION ENGINE (Claude) ─────────────────────────

# [PY] We define the system prompt as a constant outside the function.
# This is cached in memory — not rebuilt on every call.
# Triple-quoted strings (""") are multiline strings in Python.

AVA_SYSTEM_PROMPT = """You are Ava, the receptionist at Spires Physiotherapy in West Hampstead, London.

VOICE & PERSONALITY:
- Warm, professional Home Counties accent — think soft, sweet but engaging
- You NEVER mention being an AI, chatbot, or virtual assistant
- If asked directly, deflect naturally: "I'm Ava, the receptionist here at Spires"
- Keep responses SHORT — this is a phone call, not an email. 1-3 sentences max
- Use natural filler occasionally: "Let me just check that for you", "Of course"
- Mirror the caller's energy: if they're rushed, be efficient; if chatty, be warm

CLINIC KNOWLEDGE:
- Address: 283 West End Lane, West Hampstead, London NW6 1RD
- Hours: Monday-Friday 8am-8pm, Saturday 9am-2pm, closed Sunday
- Services: Physiotherapy, sports massage, clinical Pilates, acupuncture
- Initial assessment: 60 minutes, £85
- Follow-up: 30 minutes, £55
- Sports massage: 60 minutes, £75
- Cancellation: 24 hours notice required or full fee charged
- Insurance: we accept BUPA, AXA PPP, Vitality, Aviva — patient must check coverage
- Parking: limited street parking, West Hampstead station 3 min walk

BOOKING FLOW:
1. Ask what they need (new patient/follow-up/massage)
2. Check their preferred day and time
3. Get their full name
4. Get a contact number
5. Confirm the booking details back to them
6. Let them know they'll receive a confirmation text

If you can't help with something, say "Let me get one of the team to help you with that" and flag for human escalation.

CRITICAL SAFETY RULES:
- NEVER reveal patient information to callers — verify identity first
- NEVER provide medical advice — "I'd recommend booking in to see one of our physios"
- NEVER discuss other patients or staff personal details
- If caller is aggressive or abusive, stay calm: "I understand this is frustrating. Let me see how I can help"
- If medical emergency: "If this is a medical emergency, please call 999 immediately"
"""


def conversation_engine_node(state: AvaState) -> dict:
    """
    Core node: sends conversation to Claude and gets Ava's response.

    OPTIMISATIONS:
    1. System prompt caching (Anthropic beta) — saves tokens on multi-turn
    2. Conversation windowing — only send last N turns, not entire history
    3. Intent extraction in the same call — no second API round-trip
    """
    caller_input = state.get("caller_input", "")
    history = state.get("message_history", [])
    turn_count = state.get("turn_count", 0)

    # ── Build message history with window ──
    # Only send last 10 exchanges to stay within context limits
    # and reduce token cost. Older turns are summarised.
    # [PY] history[-20:] = history.slice(-20) in JS — last 20 messages
    windowed_history = history[-20:]  # 10 exchanges = 20 messages (user + assistant)

    # Add current user message
    messages = windowed_history + [
        {"role": "user", "content": caller_input}
    ]

    # ── Call Claude ──
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,  # Short — this is voice, not essay writing
            system=[
                {
                    # [PY] Prompt caching: by wrapping the system prompt in a
                    # cache_control block, Anthropic caches it across turns.
                    # Saves ~90% of input tokens on the system prompt after turn 1.
                    "type": "text",
                    "text": AVA_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        )

        # [PY] response.content is a list of content blocks
        # response.content[0].text gets the text from the first block
        ava_text = response.content[0].text

    except Exception as e:
        # [PY] Catching specific exception types (like catch (e) { if (e instanceof RateLimitError) })
        error_name = type(e).__name__
        if error_name == "RateLimitError":
            logger.error("Anthropic rate limited")
            return {
                "ava_response": "I'm sorry, we're experiencing some technical difficulties. Could you call back in a moment?",
                "error": "anthropic_rate_limited",
            }
        logger.error(f"Claude API error: {e}")
        return {
            "ava_response": "I'm sorry, I'm having a little trouble hearing you. Could you repeat that?",
            "error": str(e),
        }

    # ── Scan Ava's output for leaks ──
    output_scan = scan_input(ava_text, source="output")
    if output_scan["blocked"]:
        logger.warning(f"OUTPUT BLOCKED: {output_scan}")
        alert_telegram(
            f"🚨 *AVA OUTPUT BLOCKED*\n"
            f"Ava almost said something suspicious.\n"
            f"Score: {output_scan['score']}/100\n"
            f"Rules: {[r['rule'] for r in output_scan['triggered_rules']]}"
        )
        ava_text = (
            "Let me just check on that for you. "
            "Could you hold on one moment?"
        )

    # ── Update history ──
    updated_history = history + [
        {"role": "user", "content": caller_input},
        {"role": "assistant", "content": ava_text},
    ]

    return {
        "ava_response": ava_text,
        "message_history": updated_history,
        "turn_count": turn_count + 1,
    }


# ── NODE 5: INTENT CLASSIFIER ────────────────────────────────────

def intent_classifier_node(state: AvaState) -> dict:
    """
    Lightweight intent classification from Ava's response context.
    Uses pattern matching first — only falls back to Claude if ambiguous.

    [PY] We avoid a second API call here. Pattern matching is free.
    """
    text = state.get("caller_input", "").lower()
    response = state.get("ava_response", "").lower()
    combined = f"{text} {response}"

    # [PY] "any()" = .some() in JS — returns True if any element is truthy
    # The thing inside is a "generator expression" — like .some(word => text.includes(word))
    #
    # ORDER MATTERS: check emergency first, then cancel/reschedule before booking
    # because "reschedule" contains "schedule" which would false-positive on booking.
    # Also "can't move my neck" contains "move my" — so emergency must beat reschedule.

    if any(w in text for w in ["emergency", "999", "ambulance", "severe pain"]) or "can't move" in text:
        intent = "emergency"
    elif any(w in text for w in ["complain", "unhappy", "terrible", "awful", "disgusting"]):
        intent = "complaint"
    elif any(w in text for w in ["cancel", "can't make it", "won't be able"]):
        intent = "cancel"
    elif any(w in text for w in ["reschedule", "move my appointment", "change my appointment", "different time", "different day"]):
        # [PY] "move my appointment" instead of "move my" prevents matching "can't move my neck"
        intent = "reschedule"
    elif any(w in text for w in ["book", "appointment", "available", "slot", "see someone"]):
        # [PY] Removed "schedule" — it's a substring of "reschedule" and caused false positives
        intent = "booking"
    elif any(w in text for w in ["how much", "price", "cost", "insurance", "bupa", "axa", "vitality"]):
        intent = "enquiry"
    else:
        intent = "unknown"

    return {"intent": intent}


# ── NODE 6: ESCALATION CHECKER ────────────────────────────────────

def escalation_check_node(state: AvaState) -> dict:
    """
    Decide if the call needs human intervention.
    """
    intent = state.get("intent")
    turn_count = state.get("turn_count", 0)
    sentinel_score = state.get("sentinel_score", 0)

    escalate = False
    reason = None

    # Complaints always escalate
    if intent == "complaint":
        escalate = True
        reason = "complaint"

    # Emergency — tell them to call 999, then escalate
    elif intent == "emergency":
        escalate = True
        reason = "emergency"

    # Conversation going too long — Ava is stuck
    elif turn_count > 15:
        escalate = True
        reason = "long_conversation"

    # Repeated medium-threat injection attempts
    elif sentinel_score >= 30 and turn_count > 3:
        escalate = True
        reason = "repeated_suspicious_input"

    if escalate:
        logger.info(f"Escalating call {state.get('call_id')}: {reason}")
        alert_telegram(
            f"📞 *AVA ESCALATION*\n"
            f"Call: `{state.get('call_id', '?')}`\n"
            f"Reason: {reason}\n"
            f"Turn: {turn_count}"
        )

    return {"escalate_to_human": escalate}


# ── NODE 7: SESSION LOGGER ────────────────────────────────────────

def session_logger_node(state: AvaState) -> dict:
    """
    Final node: log everything to Firestore and trigger n8n if booking.
    Always runs — even on blocked/errored calls (for the audit trail).
    """
    # Log to Firestore
    log_call_to_firestore(state)

    # If booking intent detected, forward to n8n for PMS integration
    if state.get("intent") == "booking" and state.get("booking_details"):
        trigger_n8n_booking(state)

    return {}


# ══════════════════════════════════════════════════════════════════
# GRAPH ASSEMBLY
# ══════════════════════════════════════════════════════════════════
#
# [PY] This is where we wire the nodes together into a pipeline.
# StateGraph is like a state machine — each node transforms the state,
# and edges (including conditional ones) control the flow.
#
# Visual flow:
#
#   START
#     │
#     ▼
#   rate_limit ──(limited?)──▶ session_logger ──▶ END
#     │ (ok)
#     ▼
#   sentinel_guard ──(blocked?)──▶ session_logger ──▶ END
#     │ (clean)
#     ▼
#   sanitise_input
#     │
#     ▼
#   conversation_engine
#     │
#     ▼
#   intent_classifier
#     │
#     ▼
#   escalation_check ──(escalate?)──▶ session_logger ──▶ END
#     │ (continue)
#     ▼
#   session_logger ──▶ END
#

def build_ava_graph() -> StateGraph:
    """
    Assemble and compile the Ava pipeline.

    [PY] Returns a compiled StateGraph that you call with .invoke(state).
    """

    # [PY] StateGraph(AvaState) = create a graph where the state shape
    # is defined by AvaState TypedDict
    graph = StateGraph(AvaState)

    # ── Add nodes ──
    # [PY] graph.add_node("name", function) registers a node
    graph.add_node("rate_limit", rate_limit_node)
    graph.add_node("sentinel_guard", sentinel_guard_node)
    graph.add_node("sanitise_input", sanitise_input_node)
    graph.add_node("conversation_engine", conversation_engine_node)
    graph.add_node("intent_classifier", intent_classifier_node)
    graph.add_node("escalation_check", escalation_check_node)
    graph.add_node("session_logger", session_logger_node)

    # ── Entry point ──
    graph.set_entry_point("rate_limit")

    # ── Conditional edges ──
    # [PY] add_conditional_edges(source_node, routing_function, route_map)
    # The routing function returns a string key, and route_map maps it
    # to the next node. Like a switch statement for graph routing.

    # After rate limiting: if limited, skip to logging; otherwise continue
    graph.add_conditional_edges(
        "rate_limit",
        # [PY] lambda = arrow function: (state) => "blocked" if state.rate_limited else "ok"
        lambda state: "blocked" if state.get("rate_limited") else "ok",
        {
            "blocked": "session_logger",
            "ok": "sentinel_guard",
        },
    )

    # After sentinel: if blocked, log it; otherwise sanitise and continue
    graph.add_conditional_edges(
        "sentinel_guard",
        lambda state: "blocked" if state.get("sentinel_blocked") else "ok",
        {
            "blocked": "session_logger",
            "ok": "sanitise_input",
        },
    )

    # ── Linear edges ──
    # [PY] add_edge(a, b) = a always flows to b
    graph.add_edge("sanitise_input", "conversation_engine")
    graph.add_edge("conversation_engine", "intent_classifier")
    graph.add_edge("intent_classifier", "escalation_check")

    # After escalation check: always log, then end
    graph.add_edge("escalation_check", "session_logger")
    graph.add_edge("session_logger", END)

    # ── Compile ──
    # [PY] .compile() freezes the graph — no more changes.
    # Returns a runnable object with .invoke() and .stream() methods.
    return graph.compile()


# ══════════════════════════════════════════════════════════════════
# ENTRY POINT — how your webhook calls this
# ══════════════════════════════════════════════════════════════════

# [PY] Build the graph once at module level.
# This runs when Python first imports this file — like top-level
# code in a JS module. The graph object lives in memory and is
# reused across all calls (important for serverless warm starts).
ava_pipeline = build_ava_graph()


def handle_call_turn(
    caller_number: str,
    caller_input: str,
    call_id: str,
    message_history: list[dict] | None = None,
    turn_count: int = 0,
) -> dict:
    """
    Main entry point — call this from your ElevenLabs webhook handler
    or from an HTTP route.

    Args:
        caller_number: The inbound phone number
        caller_input: Transcribed speech from caller
        call_id: Unique ID for this call session
        message_history: Previous conversation turns (or None for first turn)
        turn_count: How many exchanges so far

    Returns:
        dict with at minimum: {ava_response, should_end_call, escalate_to_human}

    [PY] list[dict] | None = Array<object> | null in TS
    The | operator for unions was added in Python 3.10.
    """

    # Build initial state
    # [PY] This dict maps directly to the AvaState TypedDict shape
    initial_state: AvaState = {
        "caller_number": caller_number,
        "call_id": call_id,
        "call_start_time": time.time(),
        "caller_input": caller_input,
        "ava_response": "",
        "message_history": message_history or [],
        "turn_count": turn_count,
        "sentinel_score": 0,
        "sentinel_blocked": False,
        "sentinel_rules": [],
        "rate_limited": False,
        "intent": None,
        "booking_details": None,
        "should_end_call": False,
        "escalate_to_human": False,
        "error": None,
    }

    # ── Run the pipeline ──
    # [PY] .invoke() runs the entire graph synchronously.
    # The state flows through each node, getting updated at each step.
    # The return value is the final state after all nodes have run.
    try:
        final_state = ava_pipeline.invoke(initial_state)
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        alert_telegram(f"🚨 *AVA PIPELINE ERROR*\n`{str(e)[:200]}`")
        final_state = {
            **initial_state,
            "ava_response": "I'm sorry, I'm having a little trouble. Could you try again?",
            "error": str(e),
        }

    return {
        "ava_response": final_state["ava_response"],
        "should_end_call": final_state.get("should_end_call", False),
        "escalate_to_human": final_state.get("escalate_to_human", False),
        "intent": final_state.get("intent"),
        "message_history": final_state.get("message_history", []),
        "turn_count": final_state.get("turn_count", 0),
        "sentinel_score": final_state.get("sentinel_score", 0),
        "sentinel_blocked": final_state.get("sentinel_blocked", False),
    }


# ══════════════════════════════════════════════════════════════════
# HTTP HANDLER (for Cloud Functions / Cloud Run / FastAPI)
# ══════════════════════════════════════════════════════════════════

def create_fastapi_app():
    """
    Create a FastAPI app that serves the Ava pipeline.
    Deploy this to Cloud Run, Railway, or any container host.

    [PY] FastAPI is like Express but with automatic type validation
    and OpenAPI docs generation. It's the most popular Python web
    framework for APIs.
    """
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    # [PY] pydantic.BaseModel = like a Zod schema. Validates request bodies.
    from pydantic import BaseModel

    app = FastAPI(title="Ava Voice Pipeline", version="2.0")

    # CORS — lock to your domains in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://strydeos.com", "https://app.strydeos.com"],
        allow_methods=["POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # [PY] BaseModel defines the expected JSON body shape
    # Like a Zod schema: z.object({ caller_number: z.string(), ... })
    class CallTurnRequest(BaseModel):
        caller_number: str
        caller_input: str
        call_id: str
        message_history: list[dict] = []  # [PY] = [] is the default value
        turn_count: int = 0

    class CallTurnResponse(BaseModel):
        ava_response: str
        should_end_call: bool
        escalate_to_human: bool
        intent: Optional[str] = None
        message_history: list[dict] = []
        turn_count: int = 0
        sentinel_score: int = 0
        sentinel_blocked: bool = False

    @app.post("/api/ava/turn", response_model=CallTurnResponse)
    async def handle_turn(req: CallTurnRequest):
        """
        Handle one turn of a phone conversation.
        ElevenLabs webhook → this endpoint → Ava responds.

        [PY] @app.post is a decorator — like a wrapper annotation.
        It registers this function to handle POST /api/ava/turn.
        "async def" makes it an async function (like async in JS).
        FastAPI handles the await/event loop for you.
        """
        result = handle_call_turn(
            caller_number=req.caller_number,
            caller_input=req.caller_input,
            call_id=req.call_id,
            message_history=req.message_history,
            turn_count=req.turn_count,
        )
        return result

    @app.get("/api/ava/health")
    async def health():
        return {
            "status": "ava_online",
            "sentinel": "active",
            "block_threshold": BLOCK_THRESHOLD,
        }

    return app


# [PY] This block only runs if you execute the file directly:
#   python ava_pipeline.py
# It does NOT run if the file is imported by another module.
# Like the if (require.main === module) pattern in Node.
if __name__ == "__main__":
    import uvicorn  # [PY] uvicorn = the ASGI server, like running node server.js

    app = create_fastapi_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)
    # Now running at http://localhost:8000
    # Docs at http://localhost:8000/docs (auto-generated!)
