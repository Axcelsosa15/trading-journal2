"""AI insights service using Claude via the official Anthropic API."""
import os
import json
import re
from typing import Dict, Any, List, Optional

from anthropic import AsyncAnthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
# Model is configurable. Defaults to Sonnet 4.6 (cheaper, what this app shipped with).
# Set AI_MODEL=claude-opus-4-8 for higher-quality (and pricier) analysis.
AI_MODEL = os.environ.get("AI_MODEL", "claude-sonnet-4-6")

_client: Optional[AsyncAnthropic] = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not configured. Set it in the backend environment."
            )
        _client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _client


PRESETS = {
    "general": (
        "Provide a holistic analysis of the futures trader's recent performance. "
        "Identify strengths, weaknesses, behavioral patterns, and 5+ actionable recommendations. "
        "Consider session timing (RTH vs Globex), contract selection (Mini vs Micro), and risk per contract."
    ),
    "mistakes": (
        "Focus on identifying trading MISTAKES specific to futures trading: oversizing contracts, "
        "trading outside RTH without preparation, revenge trading after a loss, ignoring news/macro events, "
        "FOMO entries during fast moves, holding losers past stop, and inconsistent position sizing."
    ),
    "best_setups": (
        "Identify the BEST performing futures setups: which contracts (ES/NQ/CL/GC/MES/MNQ...), "
        "which sessions (NY AM, London, Globex), which days of week, and which strategies are working. "
        "Suggest how to double down on what's working."
    ),
    "risk": (
        "Perform a deep RISK MANAGEMENT review for a futures trader. Analyze max drawdown in $, "
        "R-multiples, win/loss ratio, position sizing across contracts (Mini vs Micro), "
        "stop-loss discipline, and suggest specific risk rules (max daily loss, max contracts per setup, etc.)."
    ),
    "weekly": (
        "Write a WEEKLY RECAP for a futures trader. Include best/worst trades, session performance, "
        "contract performance (ES, NQ, CL, GC...), key lessons learned, and 3 concrete goals for next week."
    ),
    "sessions": (
        "Analyze the trader's performance by SESSION (Asia, London, NY AM, NY PM, RTH, Globex). "
        "Which sessions are profitable? Which destroy edge? Recommend session-specific rules."
    ),
}


async def generate_insights(
    summary: Dict[str, Any],
    by_strategy: List[Dict[str, Any]],
    by_emotion: List[Dict[str, Any]],
    by_symbol: List[Dict[str, Any]],
    recent_trades: List[Dict[str, Any]],
    preset: Optional[str] = "general",
    custom_prompt: Optional[str] = None,
    by_session: Optional[List[Dict[str, Any]]] = None,
    by_day_of_week: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run Claude analysis and return structured insights."""
    system = (
        "You are an elite FUTURES trading coach with 20+ years of experience at prop firms (e.g., Topstep, FTMO Futures). "
        "You specialize in coaching futures traders on contracts like ES, NQ, CL, GC, YM, RTY and their Micros (MES, MNQ, MYM, M2K, MGC, MCL). "
        "You analyze trader performance data and deliver actionable, brutally honest, session-aware coaching. "
        "Always consider: session timing (Globex, London, NY AM/PM, RTH), contract size selection, "
        "tick value, risk per contract in $, and emotional patterns. "
        "Always respond with STRICT JSON. No markdown, no code fences. Schema: "
        "{\"summary\": string, \"strengths\": string[], \"weaknesses\": string[], "
        "\"patterns\": string[], \"recommendations\": string[], \"risk_assessment\": string, "
        "\"next_actions\": string[]}"
    )

    focus = PRESETS.get(preset or "general", PRESETS["general"])
    if custom_prompt:
        focus = custom_prompt

    payload = {
        "summary": summary,
        "by_strategy": by_strategy,
        "by_emotion": by_emotion,
        "by_symbol": by_symbol,
        "by_session": by_session or [],
        "by_day_of_week": by_day_of_week or [],
        "recent_trades_sample": recent_trades[:30],
    }

    user_msg = (
        f"FOCUS: {focus}\n\nTRADER DATA:\n{json.dumps(payload, indent=2, default=str)}\n\n"
        "Respond with the JSON object only, no extra text."
    )

    client = _get_client()
    message = await client.messages.create(
        model=AI_MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = "".join(block.text for block in message.content if block.type == "text").strip()

    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    # Extract first JSON object if there's surrounding text
    if text and not text.startswith("{"):
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
    try:
        parsed = json.loads(text)
        # If parsed is wrapped in nested {"summary": "{...}"}, try to unwrap
        if isinstance(parsed, dict) and isinstance(parsed.get("summary"), str) and parsed["summary"].strip().startswith("{"):
            try:
                inner = json.loads(parsed["summary"])
                if isinstance(inner, dict) and ("recommendations" in inner or "strengths" in inner):
                    parsed = inner
            except Exception:
                pass
    except Exception:
        parsed = {
            "summary": text[:1500],
            "strengths": [],
            "weaknesses": [],
            "patterns": [],
            "recommendations": [],
            "risk_assessment": "",
            "next_actions": [],
            "_raw": True,
        }
    # Ensure all expected keys exist
    for key, default in [
        ("summary", ""),
        ("strengths", []),
        ("weaknesses", []),
        ("patterns", []),
        ("recommendations", []),
        ("risk_assessment", ""),
        ("next_actions", []),
    ]:
        parsed.setdefault(key, default)
    return parsed
