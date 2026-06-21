"""AI insights service using Claude via emergentintegrations."""
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


PRESETS = {
    "general": (
        "Provide a holistic analysis of the trader's recent performance. "
        "Identify clear strengths, weaknesses, behavioral patterns, and 5+ actionable recommendations."
    ),
    "mistakes": (
        "Focus specifically on identifying trading MISTAKES and bad habits from the data. "
        "Look at emotion patterns, revenge trading, FOMO entries, oversizing, and chasing."
    ),
    "best_setups": (
        "Identify the BEST performing setups, strategies, symbols, and conditions. "
        "Suggest how to double down on what's working."
    ),
    "risk": (
        "Perform a deep RISK MANAGEMENT review. Analyze max drawdown, R-multiples, win/loss ratio, "
        "position sizing consistency, and suggest specific risk rules."
    ),
    "weekly": (
        "Write a WEEKLY RECAP for the trader. Include highlights, lowlights, key lessons, and goals for next week."
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
) -> Dict[str, Any]:
    """Run Claude analysis and return structured insights."""
    system = (
        "You are an elite trading coach and quantitative analyst with decades of experience. "
        "You analyze trader performance data and deliver actionable, brutally honest, and insightful coaching. "
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
        "recent_trades_sample": recent_trades[:30],
    }

    user_msg = (
        f"FOCUS: {focus}\n\nTRADER DATA:\n{json.dumps(payload, indent=2, default=str)}\n\n"
        "Respond with the JSON object only, no extra text."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"insights-{uuid.uuid4()}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")

    response = await chat.send_message(UserMessage(text=user_msg))

    text = (response or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        parsed = json.loads(text)
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
    return parsed
