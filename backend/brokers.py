"""Broker integrations: Binance, Alpaca, OANDA.
Fetch trades from each broker and normalize to our schema.
"""
import hmac
import hashlib
import time
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import urlencode

import requests


BINANCE_LIVE = "https://api.binance.com"
ALPACA_LIVE = "https://api.alpaca.markets"
ALPACA_PAPER = "https://paper-api.alpaca.markets"
OANDA_LIVE = "https://api-fxtrade.oanda.com"
OANDA_PRACTICE = "https://api-fxpractice.oanda.com"


class BrokerError(Exception):
    pass


# -------------------- BINANCE --------------------

def binance_sign(query: str, secret: str) -> str:
    return hmac.new(secret.encode(), query.encode(), hashlib.sha256).hexdigest()


def binance_get_account_info(api_key: str, api_secret: str) -> dict:
    ts = int(time.time() * 1000)
    query = f"timestamp={ts}&recvWindow=10000"
    sig = binance_sign(query, api_secret)
    url = f"{BINANCE_LIVE}/api/v3/account?{query}&signature={sig}"
    r = requests.get(url, headers={"X-MBX-APIKEY": api_key}, timeout=15)
    if r.status_code != 200:
        raise BrokerError(f"Binance account error {r.status_code}: {r.text}")
    return r.json()


def binance_fetch_trades_for_symbol(api_key: str, api_secret: str, symbol: str, limit: int = 100) -> List[dict]:
    ts = int(time.time() * 1000)
    query = f"symbol={symbol}&limit={limit}&timestamp={ts}&recvWindow=10000"
    sig = binance_sign(query, api_secret)
    url = f"{BINANCE_LIVE}/api/v3/myTrades?{query}&signature={sig}"
    r = requests.get(url, headers={"X-MBX-APIKEY": api_key}, timeout=15)
    if r.status_code != 200:
        raise BrokerError(f"Binance trades error {r.status_code}: {r.text}")
    return r.json()


def binance_normalize_trade(raw: dict, user_id: str) -> dict:
    side = "long" if raw.get("isBuyer") else "short"
    qty = float(raw.get("qty", 0))
    price = float(raw.get("price", 0))
    commission = float(raw.get("commission", 0))
    t = datetime.fromtimestamp(raw["time"] / 1000, tz=timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "market_type": "crypto",
        "symbol": raw.get("symbol"),
        "side": side,
        "quantity": qty,
        "entry_price": price,
        "exit_price": price,
        "fees": 0.0,
        "commission": commission,
        "entry_time": t.isoformat(),
        "exit_time": t.isoformat(),
        "status": "closed",
        "strategy_id": None,
        "tags": [],
        "emotion": None,
        "rating": None,
        "notes": f"Imported from Binance. OrderID: {raw.get('orderId')}",
        "mistakes": None,
        "lessons": None,
        "attachments": [],
        "broker": "binance",
        "broker_trade_id": str(raw.get("id")),
        "pnl": 0.0,
        "pnl_percent": 0.0,
        "r_multiple": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def binance_sync(api_key: str, api_secret: str, user_id: str, symbols: Optional[List[str]] = None) -> List[dict]:
    """Sync trades from Binance. If no symbols provided, fetch account then top assets."""
    if not symbols:
        try:
            info = binance_get_account_info(api_key, api_secret)
            balances = info.get("balances", [])
            non_zero = [b["asset"] for b in balances if float(b["free"]) + float(b["locked"]) > 0]
            symbols = [f"{a}USDT" for a in non_zero if a != "USDT"][:5]
        except Exception:
            symbols = ["BTCUSDT", "ETHUSDT"]
    all_trades = []
    for sym in symbols:
        try:
            raws = binance_fetch_trades_for_symbol(api_key, api_secret, sym, 100)
            for r in raws:
                all_trades.append(binance_normalize_trade(r, user_id))
        except BrokerError:
            continue
    return all_trades


# -------------------- ALPACA --------------------

def alpaca_base(env: str) -> str:
    return ALPACA_PAPER if env in ("paper", "practice") else ALPACA_LIVE


def alpaca_get_account(api_key: str, api_secret: str, env: str = "paper") -> dict:
    url = f"{alpaca_base(env)}/v2/account"
    r = requests.get(url, headers={
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": api_secret,
    }, timeout=15)
    if r.status_code != 200:
        raise BrokerError(f"Alpaca account error {r.status_code}: {r.text}")
    return r.json()


def alpaca_fetch_orders(api_key: str, api_secret: str, env: str = "paper") -> List[dict]:
    url = f"{alpaca_base(env)}/v2/orders?status=closed&limit=500&direction=desc"
    r = requests.get(url, headers={
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": api_secret,
    }, timeout=20)
    if r.status_code != 200:
        raise BrokerError(f"Alpaca orders error {r.status_code}: {r.text}")
    return r.json()


def alpaca_normalize_order(raw: dict, user_id: str) -> Optional[dict]:
    if raw.get("status") != "filled":
        return None
    side = "long" if raw.get("side") == "buy" else "short"
    qty = float(raw.get("filled_qty") or raw.get("qty") or 0)
    price = float(raw.get("filled_avg_price") or 0)
    submitted = raw.get("submitted_at") or raw.get("created_at")
    filled = raw.get("filled_at") or submitted
    market = "crypto" if "/" in (raw.get("symbol") or "") else "stocks"
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "market_type": market,
        "symbol": raw.get("symbol"),
        "side": side,
        "quantity": qty,
        "entry_price": price,
        "exit_price": price,
        "fees": 0.0,
        "commission": 0.0,
        "entry_time": submitted,
        "exit_time": filled,
        "status": "closed",
        "strategy_id": None,
        "tags": [],
        "emotion": None,
        "rating": None,
        "notes": f"Imported from Alpaca. OrderID: {raw.get('id')}",
        "mistakes": None,
        "lessons": None,
        "attachments": [],
        "broker": "alpaca",
        "broker_trade_id": str(raw.get("id")),
        "pnl": 0.0,
        "pnl_percent": 0.0,
        "r_multiple": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def alpaca_sync(api_key: str, api_secret: str, user_id: str, env: str = "paper") -> List[dict]:
    raws = alpaca_fetch_orders(api_key, api_secret, env)
    out = []
    for r in raws:
        n = alpaca_normalize_order(r, user_id)
        if n:
            out.append(n)
    return out


# -------------------- OANDA --------------------

def oanda_base(env: str) -> str:
    return OANDA_PRACTICE if env in ("paper", "practice") else OANDA_LIVE


def oanda_get_account(token: str, account_id: str, env: str = "practice") -> dict:
    url = f"{oanda_base(env)}/v3/accounts/{account_id}"
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if r.status_code != 200:
        raise BrokerError(f"OANDA account error {r.status_code}: {r.text}")
    return r.json()


def oanda_fetch_closed_trades(token: str, account_id: str, env: str = "practice") -> List[dict]:
    url = f"{oanda_base(env)}/v3/accounts/{account_id}/trades?state=CLOSED&count=500"
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20)
    if r.status_code != 200:
        raise BrokerError(f"OANDA trades error {r.status_code}: {r.text}")
    return r.json().get("trades", [])


def oanda_normalize_trade(raw: dict, user_id: str) -> dict:
    units = float(raw.get("initialUnits", 0))
    side = "long" if units > 0 else "short"
    qty = abs(units)
    entry = float(raw.get("price", 0))
    exit_p = float(raw.get("averageClosePrice") or entry)
    pnl_raw = float(raw.get("realizedPL", 0))
    open_time = raw.get("openTime")
    close_time = raw.get("closeTime")
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "market_type": "forex",
        "symbol": raw.get("instrument"),
        "side": side,
        "quantity": qty,
        "entry_price": entry,
        "exit_price": exit_p,
        "fees": float(raw.get("financing", 0)),
        "commission": 0.0,
        "entry_time": open_time,
        "exit_time": close_time,
        "status": "closed",
        "strategy_id": None,
        "tags": [],
        "emotion": None,
        "rating": None,
        "notes": f"Imported from OANDA. TradeID: {raw.get('id')}",
        "mistakes": None,
        "lessons": None,
        "attachments": [],
        "broker": "oanda",
        "broker_trade_id": str(raw.get("id")),
        "pnl": round(pnl_raw, 2),
        "pnl_percent": 0.0,
        "r_multiple": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def oanda_sync(token: str, account_id: str, user_id: str, env: str = "practice") -> List[dict]:
    raws = oanda_fetch_closed_trades(token, account_id, env)
    return [oanda_normalize_trade(r, user_id) for r in raws]
