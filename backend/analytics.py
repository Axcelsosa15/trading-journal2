"""Analytics & metrics computation."""
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import List, Dict, Any

from utils import parse_dt


def compute_metrics(trades: List[dict]) -> Dict[str, Any]:
    closed = [tr for tr in trades if tr.get("status") == "closed" and tr.get("exit_price") is not None]
    open_count = len([tr for tr in trades if tr.get("status") == "open"])
    if not closed:
        return {
            "total_trades": len(trades),
            "closed_trades": 0,
            "open_trades": open_count,
            "net_pnl": 0.0,
            "gross_profit": 0.0,
            "gross_loss": 0.0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "expectancy": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "best_trade": 0.0,
            "worst_trade": 0.0,
            "max_drawdown": 0.0,
            "sharpe_ratio": 0.0,
            "avg_r": 0.0,
            "wins": 0,
            "losses": 0,
            "break_evens": 0,
        }

    pnls = [float(tr.get("pnl") or 0) for tr in closed]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    break_evens = [p for p in pnls if p == 0]

    net_pnl = sum(pnls)
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))

    win_rate = (len(wins) / len(pnls) * 100) if pnls else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0)
    avg_win = (sum(wins) / len(wins)) if wins else 0
    avg_loss = (sum(losses) / len(losses)) if losses else 0
    expectancy = (net_pnl / len(pnls)) if pnls else 0

    # Drawdown
    sorted_closed = sorted(
        closed,
        key=lambda tr: parse_dt(tr.get("exit_time")) or parse_dt(tr.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc),
    )
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for tr in sorted_closed:
        equity += float(tr.get("pnl") or 0)
        if equity > peak:
            peak = equity
        dd = equity - peak
        if dd < max_dd:
            max_dd = dd

    # Sharpe (simple)
    import statistics
    sharpe = 0.0
    if len(pnls) > 1:
        mean = statistics.mean(pnls)
        stdev = statistics.stdev(pnls)
        if stdev > 0:
            sharpe = mean / stdev

    # avg R
    rs = [float(tr.get("r_multiple")) for tr in closed if tr.get("r_multiple") is not None]
    avg_r = (sum(rs) / len(rs)) if rs else 0

    return {
        "total_trades": len(trades),
        "closed_trades": len(closed),
        "open_trades": open_count,
        "net_pnl": round(net_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 2),
        "expectancy": round(expectancy, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "best_trade": round(max(pnls), 2),
        "worst_trade": round(min(pnls), 2),
        "max_drawdown": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 3),
        "avg_r": round(avg_r, 2),
        "wins": len(wins),
        "losses": len(losses),
        "break_evens": len(break_evens),
    }


def compute_equity_curve(trades: List[dict]) -> List[Dict[str, Any]]:
    closed = [t for t in trades if t.get("status") == "closed" and t.get("exit_price") is not None]
    sorted_closed = sorted(
        closed,
        key=lambda t: parse_dt(t.get("exit_time")) or parse_dt(t.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc),
    )
    points = []
    equity = 0.0
    peak = 0.0
    for t in sorted_closed:
        equity += float(t.get("pnl") or 0)
        if equity > peak:
            peak = equity
        dt = parse_dt(t.get("exit_time")) or parse_dt(t.get("created_at"))
        points.append({
            "date": dt.isoformat() if dt else None,
            "equity": round(equity, 2),
            "pnl": round(float(t.get("pnl") or 0), 2),
            "drawdown": round(equity - peak, 2),
            "symbol": t.get("symbol"),
        })
    return points


def compute_calendar(trades: List[dict]) -> List[Dict[str, Any]]:
    """Daily P&L aggregation."""
    closed = [t for t in trades if t.get("status") == "closed" and t.get("exit_price") is not None]
    by_day = defaultdict(lambda: {"pnl": 0.0, "trades": 0, "wins": 0, "losses": 0})
    for t in closed:
        dt = parse_dt(t.get("exit_time")) or parse_dt(t.get("created_at"))
        if not dt:
            continue
        day = dt.strftime("%Y-%m-%d")
        pnl = float(t.get("pnl") or 0)
        by_day[day]["pnl"] += pnl
        by_day[day]["trades"] += 1
        if pnl > 0:
            by_day[day]["wins"] += 1
        elif pnl < 0:
            by_day[day]["losses"] += 1
    out = []
    for day, data in sorted(by_day.items()):
        wr = (data["wins"] / data["trades"] * 100) if data["trades"] else 0
        out.append({
            "date": day,
            "pnl": round(data["pnl"], 2),
            "trades": data["trades"],
            "wins": data["wins"],
            "losses": data["losses"],
            "win_rate": round(wr, 1),
        })
    return out


def compute_breakdown(trades: List[dict], key: str) -> List[Dict[str, Any]]:
    """Breakdown by strategy_id, symbol, market_type, emotion, session, hour, day_of_week."""
    closed = [t for t in trades if t.get("status") == "closed" and t.get("exit_price") is not None]
    buckets = defaultdict(lambda: {"pnl": 0.0, "trades": 0, "wins": 0})
    for t in closed:
        if key == "day_of_week":
            dt = parse_dt(t.get("exit_time")) or parse_dt(t.get("created_at"))
            if not dt:
                continue
            k = dt.strftime("%A")
        elif key == "hour":
            dt = parse_dt(t.get("entry_time")) or parse_dt(t.get("exit_time")) or parse_dt(t.get("created_at"))
            if not dt:
                continue
            k = dt.strftime("%H:00")
        else:
            k = t.get(key) or "unknown"
            if isinstance(k, list):
                continue  # tags handled separately
        pnl = float(t.get("pnl") or 0)
        buckets[k]["pnl"] += pnl
        buckets[k]["trades"] += 1
        if pnl > 0:
            buckets[k]["wins"] += 1

    out = []
    for k, data in buckets.items():
        wr = (data["wins"] / data["trades"] * 100) if data["trades"] else 0
        out.append({
            "key": k,
            "pnl": round(data["pnl"], 2),
            "trades": data["trades"],
            "win_rate": round(wr, 1),
        })
    out.sort(key=lambda x: x["pnl"], reverse=True)
    return out
