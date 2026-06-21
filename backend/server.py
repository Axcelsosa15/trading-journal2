"""Trading Journal FastAPI server."""
import os
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import hash_password, verify_password, create_access_token, get_current_user  # noqa: E402
from models import (  # noqa: E402
    UserCreate, UserLogin, UserPublic, TokenResponse,
    TradeCreate, TradeUpdate, Trade,
    StrategyCreate, Strategy,
    TagCreate, Tag,
    BrokerConnectionCreate, BrokerConnection,
    AIInsightCreate, AIInsight,
)
from utils import serialize_doc, prepare_for_mongo, compute_pnl, parse_dt, encrypt_secret, decrypt_secret  # noqa: E402
from analytics import compute_metrics, compute_equity_curve, compute_calendar, compute_breakdown  # noqa: E402
from brokers import binance_sync, alpaca_sync, oanda_sync, BrokerError  # noqa: E402
from ai_service import generate_insights  # noqa: E402
from csv_import import parse_csv  # noqa: E402
from futures_contracts import FUTURES_CONTRACTS, CONTRACTS_BY_SYMBOL, SESSIONS  # noqa: E402
import uuid

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Trading Journal API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ===================== HEALTH =====================
@api.get("/")
async def root():
    return {"message": "Trading Journal API (Futures)", "status": "ok"}


# ===================== FUTURES REFERENCE =====================
@api.get("/futures/contracts")
async def get_futures_contracts():
    """Public reference list of common futures contracts with point/tick values."""
    return {"contracts": FUTURES_CONTRACTS, "sessions": SESSIONS}


@api.get("/futures/contracts/{symbol}")
async def get_futures_contract(symbol: str):
    c = CONTRACTS_BY_SYMBOL.get(symbol.upper())
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return c


# ===================== AUTH =====================
@api.post("/auth/register", response_model=TokenResponse)
async def register(payload: UserCreate):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "name": payload.name or payload.email.split("@")[0],
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, payload.email.lower())
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user_id, email=payload.email.lower(), name=user_doc["name"],
            created_at=datetime.fromisoformat(user_doc["created_at"]),
        ),
    )


@api.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user["id"], email=user["email"], name=user.get("name"),
            created_at=parse_dt(user["created_at"]) or datetime.now(timezone.utc),
        ),
    )


@api.get("/auth/me", response_model=UserPublic)
async def me(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(
        id=user["id"], email=user["email"], name=user.get("name"),
        created_at=parse_dt(user["created_at"]) or datetime.now(timezone.utc),
    )


# ===================== TRADES =====================
@api.post("/trades", response_model=Trade)
async def create_trade(payload: TradeCreate, current=Depends(get_current_user)):
    t = payload.model_dump()
    t["id"] = str(uuid.uuid4())
    t["user_id"] = current["id"]
    t["created_at"] = datetime.now(timezone.utc)
    t["updated_at"] = datetime.now(timezone.utc)
    t = compute_pnl(t)
    doc = prepare_for_mongo(t)
    await db.trades.insert_one(doc)
    return Trade(**serialize_doc(doc))


@api.get("/trades", response_model=List[Trade])
async def list_trades(
    current=Depends(get_current_user),
    symbol: Optional[str] = None,
    market_type: Optional[str] = None,
    strategy_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(500, le=2000),
    skip: int = 0,
):
    q: dict = {"user_id": current["id"]}
    if symbol:
        q["symbol"] = {"$regex": symbol, "$options": "i"}
    if market_type:
        q["market_type"] = market_type
    if strategy_id:
        q["strategy_id"] = strategy_id
    if status:
        q["status"] = status
    if date_from:
        q.setdefault("entry_time", {})["$gte"] = date_from
    if date_to:
        q.setdefault("entry_time", {})["$lte"] = date_to
    cursor = db.trades.find(q, {"_id": 0}).sort("entry_time", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    out = []
    for it in items:
        try:
            out.append(Trade(**serialize_doc(it)))
        except Exception as e:
            logger.warning(f"Trade parse failed: {e}")
    return out


@api.get("/trades/{trade_id}", response_model=Trade)
async def get_trade(trade_id: str, current=Depends(get_current_user)):
    t = await db.trades.find_one({"id": trade_id, "user_id": current["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Trade not found")
    return Trade(**serialize_doc(t))


@api.patch("/trades/{trade_id}", response_model=Trade)
async def update_trade(trade_id: str, payload: TradeUpdate, current=Depends(get_current_user)):
    existing = await db.trades.find_one({"id": trade_id, "user_id": current["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Trade not found")
    upd = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    existing.update(upd)
    existing["updated_at"] = datetime.now(timezone.utc)
    existing = compute_pnl(existing)
    doc = prepare_for_mongo(existing)
    await db.trades.update_one({"id": trade_id, "user_id": current["id"]}, {"$set": doc})
    return Trade(**serialize_doc(doc))


@api.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, current=Depends(get_current_user)):
    res = await db.trades.delete_one({"id": trade_id, "user_id": current["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"ok": True}


@api.post("/trades/bulk")
async def bulk_create_trades(trades: List[dict], current=Depends(get_current_user)):
    if not trades:
        return {"inserted": 0}
    inserted = 0
    for t in trades:
        t["user_id"] = current["id"]
        t.setdefault("id", str(uuid.uuid4()))
        t = compute_pnl(t)
        # Dedup: skip if broker_trade_id already exists for this user+broker
        if t.get("broker_trade_id") and t.get("broker") not in (None, "manual"):
            exists = await db.trades.find_one({
                "user_id": current["id"],
                "broker": t["broker"],
                "broker_trade_id": t["broker_trade_id"],
            })
            if exists:
                continue
        await db.trades.insert_one(prepare_for_mongo(t))
        inserted += 1
    return {"inserted": inserted, "received": len(trades)}


# ===================== STRATEGIES =====================
@api.post("/strategies", response_model=Strategy)
async def create_strategy(payload: StrategyCreate, current=Depends(get_current_user)):
    s = Strategy(user_id=current["id"], **payload.model_dump())
    await db.strategies.insert_one(prepare_for_mongo(s.model_dump()))
    return s


@api.get("/strategies", response_model=List[Strategy])
async def list_strategies(current=Depends(get_current_user)):
    items = await db.strategies.find({"user_id": current["id"]}, {"_id": 0}).to_list(500)
    return [Strategy(**serialize_doc(i)) for i in items]


@api.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str, current=Depends(get_current_user)):
    res = await db.strategies.delete_one({"id": strategy_id, "user_id": current["id"]})
    return {"ok": res.deleted_count > 0}


# ===================== TAGS =====================
@api.post("/tags", response_model=Tag)
async def create_tag(payload: TagCreate, current=Depends(get_current_user)):
    t = Tag(user_id=current["id"], **payload.model_dump())
    await db.tags.insert_one(prepare_for_mongo(t.model_dump()))
    return t


@api.get("/tags", response_model=List[Tag])
async def list_tags(current=Depends(get_current_user)):
    items = await db.tags.find({"user_id": current["id"]}, {"_id": 0}).to_list(500)
    return [Tag(**serialize_doc(i)) for i in items]


@api.delete("/tags/{tag_id}")
async def delete_tag(tag_id: str, current=Depends(get_current_user)):
    res = await db.tags.delete_one({"id": tag_id, "user_id": current["id"]})
    return {"ok": res.deleted_count > 0}


# ===================== ANALYTICS =====================
async def _get_user_trades(user_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[dict]:
    q: dict = {"user_id": user_id}
    if date_from:
        q.setdefault("entry_time", {})["$gte"] = date_from
    if date_to:
        q.setdefault("entry_time", {})["$lte"] = date_to
    items = await db.trades.find(q, {"_id": 0}).to_list(5000)
    return [serialize_doc(i) for i in items]


@api.get("/analytics/summary")
async def analytics_summary(
    current=Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    trades = await _get_user_trades(current["id"], date_from, date_to)
    return compute_metrics(trades)


@api.get("/analytics/equity")
async def analytics_equity(current=Depends(get_current_user)):
    trades = await _get_user_trades(current["id"])
    return compute_equity_curve(trades)


@api.get("/analytics/calendar")
async def analytics_calendar(current=Depends(get_current_user)):
    trades = await _get_user_trades(current["id"])
    return compute_calendar(trades)


@api.get("/analytics/breakdown")
async def analytics_breakdown(
    by: str = Query("strategy_id"),
    current=Depends(get_current_user),
):
    if by not in {"strategy_id", "symbol", "market_type", "emotion", "day_of_week", "side", "broker", "session", "hour"}:
        raise HTTPException(status_code=400, detail="Invalid 'by' value")
    trades = await _get_user_trades(current["id"])
    return compute_breakdown(trades, by)


# ===================== BROKER CONNECTIONS =====================
@api.post("/brokers/connections", response_model=BrokerConnection)
async def create_broker_connection(payload: BrokerConnectionCreate, current=Depends(get_current_user)):
    if payload.broker not in {"binance", "alpaca", "oanda"}:
        raise HTTPException(status_code=400, detail="Unsupported broker")
    conn = BrokerConnection(
        user_id=current["id"],
        broker=payload.broker,
        label=payload.label or payload.broker.capitalize(),
        account_id=payload.account_id,
        environment=payload.environment or "live",
    )
    doc = prepare_for_mongo(conn.model_dump())
    doc["api_key_enc"] = encrypt_secret(payload.api_key)
    doc["api_secret_enc"] = encrypt_secret(payload.api_secret or "")
    await db.broker_connections.insert_one(doc)
    return conn


@api.get("/brokers/connections", response_model=List[BrokerConnection])
async def list_broker_connections(current=Depends(get_current_user)):
    items = await db.broker_connections.find(
        {"user_id": current["id"]}, {"_id": 0, "api_key_enc": 0, "api_secret_enc": 0}
    ).to_list(50)
    return [BrokerConnection(**serialize_doc(i)) for i in items]


@api.delete("/brokers/connections/{conn_id}")
async def delete_broker_connection(conn_id: str, current=Depends(get_current_user)):
    res = await db.broker_connections.delete_one({"id": conn_id, "user_id": current["id"]})
    return {"ok": res.deleted_count > 0}


@api.post("/brokers/connections/{conn_id}/sync")
async def sync_broker(conn_id: str, current=Depends(get_current_user)):
    conn = await db.broker_connections.find_one({"id": conn_id, "user_id": current["id"]}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    api_key = decrypt_secret(conn.get("api_key_enc", ""))
    api_secret = decrypt_secret(conn.get("api_secret_enc", ""))
    broker = conn["broker"]
    env = conn.get("environment", "live")
    new_trades: List[dict] = []
    err: Optional[str] = None
    try:
        if broker == "binance":
            new_trades = binance_sync(api_key, api_secret, current["id"])
        elif broker == "alpaca":
            new_trades = alpaca_sync(api_key, api_secret, current["id"], env)
        elif broker == "oanda":
            new_trades = oanda_sync(api_key, conn.get("account_id", ""), current["id"], env)
    except BrokerError as e:
        err = str(e)
    except Exception as e:
        err = f"Unexpected error: {e}"

    inserted = 0
    for t in new_trades:
        t = compute_pnl(t)
        # dedup
        exists = await db.trades.find_one({
            "user_id": current["id"],
            "broker": broker,
            "broker_trade_id": t.get("broker_trade_id"),
        })
        if exists:
            continue
        await db.trades.insert_one(prepare_for_mongo(t))
        inserted += 1

    now = datetime.now(timezone.utc).isoformat()
    await db.broker_connections.update_one(
        {"id": conn_id, "user_id": current["id"]},
        {"$set": {
            "last_sync": now,
            "last_status": "error" if err else "success",
            "last_error": err,
        }},
    )

    if err:
        # Return 200 with structured payload reflecting graceful failure
        return {"imported": inserted, "fetched": len(new_trades), "last_sync": now, "status": "error", "error": err}
    return {"imported": inserted, "fetched": len(new_trades), "last_sync": now, "status": "success"}


# ===================== CSV IMPORT =====================
@api.post("/import/csv")
async def import_csv(file: UploadFile = File(...), current=Depends(get_current_user)):
    content = await file.read()
    result = parse_csv(content, current["id"])
    inserted = 0
    for t in result["trades"]:
        t = compute_pnl(t)
        await db.trades.insert_one(prepare_for_mongo(t))
        inserted += 1
    return {
        "inserted": inserted,
        "errors": result["errors"][:20],
        "mapping": result["mapping"],
        "headers": result["headers"],
        "total_parsed": len(result["trades"]),
    }


@api.post("/import/csv/preview")
async def preview_csv(file: UploadFile = File(...), current=Depends(get_current_user)):
    content = await file.read()
    result = parse_csv(content, current["id"])
    return {
        "errors": result["errors"][:20],
        "mapping": result["mapping"],
        "headers": result["headers"],
        "total_parsed": len(result["trades"]),
        "preview": result["trades"][:10],
    }


# ===================== AI INSIGHTS =====================
@api.post("/ai/insights", response_model=AIInsight)
async def run_ai_insights(payload: AIInsightCreate, current=Depends(get_current_user)):
    df = payload.date_from.isoformat() if payload.date_from else None
    dt = payload.date_to.isoformat() if payload.date_to else None
    trades = await _get_user_trades(current["id"], df, dt)
    if not trades:
        raise HTTPException(status_code=400, detail="No trades to analyze yet. Log some trades first.")
    summary = compute_metrics(trades)
    by_strategy = compute_breakdown(trades, "strategy_id")
    by_emotion = compute_breakdown(trades, "emotion")
    by_symbol = compute_breakdown(trades, "symbol")[:10]
    by_session = compute_breakdown(trades, "session")
    by_dow = compute_breakdown(trades, "day_of_week")
    # recent trades sample
    closed = sorted(
        [t for t in trades if t.get("status") == "closed"],
        key=lambda t: t.get("exit_time") or t.get("created_at") or "",
        reverse=True,
    )[:30]
    sample = [
        {
            "symbol": t.get("symbol"),
            "side": t.get("side"),
            "qty": t.get("quantity"),
            "point_value": t.get("point_value"),
            "session": t.get("session"),
            "pnl": t.get("pnl"),
            "r": t.get("r_multiple"),
            "emotion": t.get("emotion"),
            "strategy_id": t.get("strategy_id"),
            "notes": (t.get("notes") or "")[:200],
            "mistakes": (t.get("mistakes") or "")[:200],
        }
        for t in closed
    ]
    try:
        response = await generate_insights(
            summary, by_strategy, by_emotion, by_symbol, sample,
            preset=payload.prompt_preset, custom_prompt=payload.custom_prompt,
            by_session=by_session, by_day_of_week=by_dow,
        )
    except Exception as e:
        logger.exception("AI insights generation failed")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    insight = AIInsight(
        user_id=current["id"],
        prompt_preset=payload.prompt_preset,
        custom_prompt=payload.custom_prompt,
        response=response,
        trades_analyzed=len(trades),
    )
    await db.ai_insights.insert_one(prepare_for_mongo(insight.model_dump()))
    return insight


@api.get("/ai/insights", response_model=List[AIInsight])
async def list_ai_insights(current=Depends(get_current_user)):
    items = await db.ai_insights.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return [AIInsight(**serialize_doc(i)) for i in items]


@api.delete("/ai/insights/{insight_id}")
async def delete_ai_insight(insight_id: str, current=Depends(get_current_user)):
    res = await db.ai_insights.delete_one({"id": insight_id, "user_id": current["id"]})
    return {"ok": res.deleted_count > 0}


# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.trades.create_index([("user_id", 1), ("entry_time", -1)])
    await db.trades.create_index([("user_id", 1), ("broker", 1), ("broker_trade_id", 1)])
    await db.broker_connections.create_index([("user_id", 1), ("broker", 1)])


@app.on_event("shutdown")
async def shutdown():
    client.close()
