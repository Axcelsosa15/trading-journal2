"""Pydantic models for Trading Journal."""
from datetime import datetime, timezone
from typing import List, Optional, Literal
import uuid

from pydantic import BaseModel, EmailStr, Field, ConfigDict


MARKET_TYPES = Literal["stocks", "forex", "crypto", "futures", "options"]
SIDE_TYPES = Literal["long", "short"]
STATUS_TYPES = Literal["open", "closed"]
BROKER_TYPES = Literal["binance", "alpaca", "oanda", "manual", "csv"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: Optional[str] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class Attachment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    data_url: str  # base64 data url
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TradeBase(BaseModel):
    market_type: MARKET_TYPES = "stocks"
    symbol: str
    side: SIDE_TYPES = "long"
    quantity: float = 0.0
    entry_price: float = 0.0
    exit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    fees: float = 0.0
    commission: float = 0.0
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    status: STATUS_TYPES = "closed"
    strategy_id: Optional[str] = None
    tags: List[str] = []
    emotion: Optional[str] = None  # calm, fomo, revenge, confident, anxious, neutral
    rating: Optional[int] = None  # 1-5
    notes: Optional[str] = None
    mistakes: Optional[str] = None
    lessons: Optional[str] = None
    attachments: List[Attachment] = []
    broker: BROKER_TYPES = "manual"
    broker_trade_id: Optional[str] = None


class TradeCreate(TradeBase):
    pass


class TradeUpdate(BaseModel):
    market_type: Optional[MARKET_TYPES] = None
    symbol: Optional[str] = None
    side: Optional[SIDE_TYPES] = None
    quantity: Optional[float] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    fees: Optional[float] = None
    commission: Optional[float] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    status: Optional[STATUS_TYPES] = None
    strategy_id: Optional[str] = None
    tags: Optional[List[str]] = None
    emotion: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    mistakes: Optional[str] = None
    lessons: Optional[str] = None
    attachments: Optional[List[Attachment]] = None


class Trade(TradeBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    pnl: float = 0.0  # computed
    pnl_percent: float = 0.0
    r_multiple: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#3b82f6"


class Strategy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    description: Optional[str] = None
    color: str = "#3b82f6"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = "#64748b"


class Tag(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    color: str = "#64748b"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BrokerConnectionCreate(BaseModel):
    broker: BROKER_TYPES
    label: Optional[str] = None
    api_key: str
    api_secret: Optional[str] = None
    account_id: Optional[str] = None  # for OANDA
    environment: Optional[str] = "live"  # live or paper/practice


class BrokerConnection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    broker: BROKER_TYPES
    label: Optional[str] = None
    account_id: Optional[str] = None
    environment: str = "live"
    last_sync: Optional[datetime] = None
    last_status: Optional[str] = None  # success / error / pending
    last_error: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AIInsightCreate(BaseModel):
    prompt_preset: Optional[str] = None  # 'general', 'mistakes', 'best_setups', 'risk', 'weekly'
    custom_prompt: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class AIInsight(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    prompt_preset: Optional[str] = None
    custom_prompt: Optional[str] = None
    response: dict
    trades_analyzed: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
