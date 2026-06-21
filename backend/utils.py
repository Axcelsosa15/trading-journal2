"""Utility helpers: serialization, encryption, P&L computation."""
import os
import base64
from datetime import datetime, timezone
from typing import Any, Optional

from cryptography.fernet import Fernet


ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")


def _get_fernet() -> Fernet:
    key = ENCRYPTION_KEY
    if not key:
        # generate ephemeral - WARNING in prod
        key = Fernet.generate_key().decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plain: str) -> str:
    if not plain:
        return ""
    f = _get_fernet()
    return f.encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    if not token:
        return ""
    f = _get_fernet()
    return f.decrypt(token.encode()).decode()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-serializable dict. Strip _id, convert datetimes."""
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, datetime):
            out[k] = v.isoformat() if v.tzinfo else v.replace(tzinfo=timezone.utc).isoformat()
        elif isinstance(v, dict):
            out[k] = serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [serialize_doc(i) if isinstance(i, dict) else (i.isoformat() if isinstance(i, datetime) else i) for i in v]
        else:
            out[k] = v
    return out


def prepare_for_mongo(doc: dict) -> dict:
    """Convert datetime objects to ISO strings for MongoDB storage."""
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).isoformat()
        elif isinstance(v, dict):
            out[k] = prepare_for_mongo(v)
        elif isinstance(v, list):
            out[k] = [
                prepare_for_mongo(i) if isinstance(i, dict)
                else (i.isoformat() if isinstance(i, datetime) else i)
                for i in v
            ]
        else:
            out[k] = v
    return out


def compute_pnl(trade: dict) -> dict:
    """Compute P&L for a trade. Modifies trade in place and returns it.
    For futures (market_type='futures'), uses point_value: gross = (move) * qty * point_value.
    """
    side = trade.get("side", "long")
    qty = float(trade.get("quantity") or 0)
    entry = float(trade.get("entry_price") or 0)
    exit_p = trade.get("exit_price")
    fees = float(trade.get("fees") or 0)
    comm = float(trade.get("commission") or 0)
    sl = trade.get("stop_loss")
    status = trade.get("status", "closed")
    market = trade.get("market_type", "futures")
    pv = trade.get("point_value")

    if status == "closed" and exit_p is not None:
        exit_p = float(exit_p)
        move = (exit_p - entry) if side == "long" else (entry - exit_p)
        if market == "futures" and pv:
            multiplier = float(pv)
            gross = move * qty * multiplier
            cost_basis = abs(entry * qty * multiplier) if entry and qty else 0
        else:
            gross = move * qty
            cost_basis = abs(entry * qty) if entry and qty else 0
        pnl = gross - fees - comm
        pnl_pct = (pnl / cost_basis * 100) if cost_basis > 0 else 0
        trade["pnl"] = round(pnl, 2)
        trade["pnl_percent"] = round(pnl_pct, 2)

        # R-multiple
        if sl is not None and entry:
            risk_per_unit = abs(entry - float(sl))
            if risk_per_unit > 0:
                if market == "futures" and pv:
                    r_denom = risk_per_unit * float(pv) * qty
                    if r_denom > 0:
                        trade["r_multiple"] = round((gross) / r_denom, 2)
                    else:
                        trade["r_multiple"] = None
                else:
                    r = (exit_p - entry) / risk_per_unit if side == "long" else (entry - exit_p) / risk_per_unit
                    trade["r_multiple"] = round(r, 2)
            else:
                trade["r_multiple"] = None
        else:
            trade["r_multiple"] = None
    else:
        trade["pnl"] = 0.0
        trade["pnl_percent"] = 0.0
        trade["r_multiple"] = None
    return trade


def parse_dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            # Ensure timezone-aware
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            # Try a few common formats
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y"):
                try:
                    dt = datetime.strptime(v, fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except Exception:
                    continue
            return None
    return None
