"""CSV import: parse uploaded CSV into normalized trades.
Supports auto-detection of common broker formats (TradingView, MT4/MT5, IBKR, generic).
"""
import csv
import io
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from utils import parse_dt


FIELD_ALIASES = {
    "symbol": ["symbol", "ticker", "instrument", "pair", "market"],
    "side": ["side", "direction", "type", "action"],
    "quantity": ["qty", "quantity", "size", "volume", "units", "shares", "amount"],
    "entry_price": ["entry", "entry_price", "open price", "open_price", "price", "buy price"],
    "exit_price": ["exit", "exit_price", "close price", "close_price", "sell price"],
    "entry_time": ["entry_time", "open_time", "open time", "entry date", "date", "time", "datetime"],
    "exit_time": ["exit_time", "close_time", "close time", "exit date"],
    "fees": ["fees", "fee", "swap"],
    "commission": ["commission", "comm", "commissions"],
    "pnl": ["pnl", "p&l", "profit", "net profit", "realized pnl", "realized p&l", "gain"],
    "stop_loss": ["stop_loss", "sl", "stop loss"],
    "take_profit": ["take_profit", "tp", "take profit"],
    "strategy": ["strategy", "setup"],
    "notes": ["notes", "comment", "comments"],
    "market_type": ["market_type", "asset_class", "market", "asset"],
}


def _map_headers(headers: List[str]) -> Dict[str, str]:
    """Map CSV headers to normalized field names."""
    norm = {h: h.lower().strip() for h in headers}
    mapping = {}
    for field, aliases in FIELD_ALIASES.items():
        for h, hl in norm.items():
            if hl in aliases:
                mapping[field] = h
                break
    return mapping


def _norm_side(v: str) -> str:
    v = (v or "").lower().strip()
    if v in ("long", "buy", "b", "1"):
        return "long"
    if v in ("short", "sell", "s", "-1"):
        return "short"
    return "long"


def _to_float(v: Any) -> float:
    if v is None or v == "":
        return 0.0
    try:
        s = str(v).replace(",", "").replace("$", "").replace("%", "").strip()
        if s.startswith("(") and s.endswith(")"):
            s = "-" + s[1:-1]
        return float(s)
    except Exception:
        return 0.0


def _norm_market(v: str, symbol: str = "") -> str:
    v = (v or "").lower().strip()
    if v in ("forex", "fx"):
        return "forex"
    if v in ("crypto", "cryptocurrency"):
        return "crypto"
    if v in ("futures", "future"):
        return "futures"
    if v in ("options", "option"):
        return "options"
    if v in ("stocks", "stock", "equity", "equities"):
        return "stocks"
    # infer from symbol
    s = (symbol or "").upper()
    if any(s.endswith(x) for x in ["USDT", "BTC", "ETH", "USDC"]):
        return "crypto"
    if "/" in s and len(s) <= 8:
        return "forex"
    if "_" in s and len(s) <= 8:
        return "forex"
    return "stocks"


def parse_csv(content: bytes, user_id: str) -> Dict[str, Any]:
    """Parse CSV bytes into normalized trades. Returns {'trades': [...], 'errors': [...], 'mapping': {...}}."""
    text = content.decode("utf-8", errors="ignore")
    # Sniff delimiter
    try:
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t|")
        delim = dialect.delimiter
    except Exception:
        delim = ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    headers = reader.fieldnames or []
    mapping = _map_headers(headers)
    trades = []
    errors = []
    for i, row in enumerate(reader):
        try:
            sym = row.get(mapping.get("symbol", ""), "") or row.get("Symbol", "")
            if not sym:
                continue
            side = _norm_side(row.get(mapping.get("side", ""), ""))
            qty = _to_float(row.get(mapping.get("quantity", "")))
            entry = _to_float(row.get(mapping.get("entry_price", "")))
            exit_p = _to_float(row.get(mapping.get("exit_price", ""))) or None
            entry_t = parse_dt(row.get(mapping.get("entry_time", "")))
            exit_t = parse_dt(row.get(mapping.get("exit_time", ""))) or entry_t
            fees = _to_float(row.get(mapping.get("fees", "")))
            commission = _to_float(row.get(mapping.get("commission", "")))
            pnl_raw = _to_float(row.get(mapping.get("pnl", ""))) if mapping.get("pnl") else None
            sl = _to_float(row.get(mapping.get("stop_loss", ""))) if mapping.get("stop_loss") else None
            tp = _to_float(row.get(mapping.get("take_profit", ""))) if mapping.get("take_profit") else None
            market = _norm_market(row.get(mapping.get("market_type", ""), ""), sym)
            now = datetime.now(timezone.utc).isoformat()
            t = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "market_type": market,
                "symbol": str(sym).strip(),
                "side": side,
                "quantity": qty,
                "entry_price": entry,
                "exit_price": exit_p,
                "stop_loss": sl,
                "take_profit": tp,
                "fees": fees,
                "commission": commission,
                "entry_time": entry_t.isoformat() if entry_t else now,
                "exit_time": exit_t.isoformat() if exit_t else None,
                "status": "closed" if exit_p else "open",
                "strategy_id": None,
                "tags": [],
                "emotion": None,
                "rating": None,
                "notes": row.get(mapping.get("notes", ""), "") or f"Imported from CSV (row {i+1})",
                "mistakes": None,
                "lessons": None,
                "attachments": [],
                "broker": "csv",
                "broker_trade_id": None,
                "pnl": pnl_raw or 0.0,
                "pnl_percent": 0.0,
                "r_multiple": None,
                "created_at": now,
                "updated_at": now,
            }
            trades.append(t)
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})
    return {"trades": trades, "errors": errors, "mapping": mapping, "headers": headers}
