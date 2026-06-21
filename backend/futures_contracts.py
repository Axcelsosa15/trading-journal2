"""Futures contracts reference data.
Common contract specifications used for auto-populating point_value, tick_size, and contract grouping.
"""

FUTURES_CONTRACTS = [
    # Equity Indices
    {"symbol": "ES", "name": "E-mini S&P 500", "category": "Index", "exchange": "CME", "point_value": 50, "tick_size": 0.25, "tick_value": 12.50, "currency": "USD"},
    {"symbol": "MES", "name": "Micro E-mini S&P 500", "category": "Index", "exchange": "CME", "point_value": 5, "tick_size": 0.25, "tick_value": 1.25, "currency": "USD"},
    {"symbol": "NQ", "name": "E-mini Nasdaq-100", "category": "Index", "exchange": "CME", "point_value": 20, "tick_size": 0.25, "tick_value": 5.00, "currency": "USD"},
    {"symbol": "MNQ", "name": "Micro E-mini Nasdaq-100", "category": "Index", "exchange": "CME", "point_value": 2, "tick_size": 0.25, "tick_value": 0.50, "currency": "USD"},
    {"symbol": "YM", "name": "E-mini Dow", "category": "Index", "exchange": "CBOT", "point_value": 5, "tick_size": 1, "tick_value": 5.00, "currency": "USD"},
    {"symbol": "MYM", "name": "Micro E-mini Dow", "category": "Index", "exchange": "CBOT", "point_value": 0.50, "tick_size": 1, "tick_value": 0.50, "currency": "USD"},
    {"symbol": "RTY", "name": "E-mini Russell 2000", "category": "Index", "exchange": "CME", "point_value": 50, "tick_size": 0.10, "tick_value": 5.00, "currency": "USD"},
    {"symbol": "M2K", "name": "Micro E-mini Russell 2000", "category": "Index", "exchange": "CME", "point_value": 5, "tick_size": 0.10, "tick_value": 0.50, "currency": "USD"},
    # Energy
    {"symbol": "CL", "name": "Crude Oil WTI", "category": "Energy", "exchange": "NYMEX", "point_value": 1000, "tick_size": 0.01, "tick_value": 10.00, "currency": "USD"},
    {"symbol": "MCL", "name": "Micro Crude Oil", "category": "Energy", "exchange": "NYMEX", "point_value": 100, "tick_size": 0.01, "tick_value": 1.00, "currency": "USD"},
    {"symbol": "NG", "name": "Natural Gas", "category": "Energy", "exchange": "NYMEX", "point_value": 10000, "tick_size": 0.001, "tick_value": 10.00, "currency": "USD"},
    {"symbol": "RB", "name": "RBOB Gasoline", "category": "Energy", "exchange": "NYMEX", "point_value": 42000, "tick_size": 0.0001, "tick_value": 4.20, "currency": "USD"},
    # Metals
    {"symbol": "GC", "name": "Gold", "category": "Metals", "exchange": "COMEX", "point_value": 100, "tick_size": 0.10, "tick_value": 10.00, "currency": "USD"},
    {"symbol": "MGC", "name": "Micro Gold", "category": "Metals", "exchange": "COMEX", "point_value": 10, "tick_size": 0.10, "tick_value": 1.00, "currency": "USD"},
    {"symbol": "SI", "name": "Silver", "category": "Metals", "exchange": "COMEX", "point_value": 5000, "tick_size": 0.005, "tick_value": 25.00, "currency": "USD"},
    {"symbol": "SIL", "name": "Micro Silver", "category": "Metals", "exchange": "COMEX", "point_value": 1000, "tick_size": 0.005, "tick_value": 5.00, "currency": "USD"},
    {"symbol": "HG", "name": "Copper", "category": "Metals", "exchange": "COMEX", "point_value": 25000, "tick_size": 0.0005, "tick_value": 12.50, "currency": "USD"},
    {"symbol": "PL", "name": "Platinum", "category": "Metals", "exchange": "NYMEX", "point_value": 50, "tick_size": 0.10, "tick_value": 5.00, "currency": "USD"},
    # Treasuries / Rates
    {"symbol": "ZN", "name": "10-Year T-Note", "category": "Rates", "exchange": "CBOT", "point_value": 1000, "tick_size": 0.015625, "tick_value": 15.625, "currency": "USD"},
    {"symbol": "ZB", "name": "30-Year T-Bond", "category": "Rates", "exchange": "CBOT", "point_value": 1000, "tick_size": 0.03125, "tick_value": 31.25, "currency": "USD"},
    {"symbol": "ZF", "name": "5-Year T-Note", "category": "Rates", "exchange": "CBOT", "point_value": 1000, "tick_size": 0.0078125, "tick_value": 7.8125, "currency": "USD"},
    {"symbol": "ZT", "name": "2-Year T-Note", "category": "Rates", "exchange": "CBOT", "point_value": 2000, "tick_size": 0.0078125, "tick_value": 15.625, "currency": "USD"},
    # Currencies (futures-style)
    {"symbol": "6E", "name": "Euro FX", "category": "Currency", "exchange": "CME", "point_value": 125000, "tick_size": 0.00005, "tick_value": 6.25, "currency": "USD"},
    {"symbol": "M6E", "name": "Micro Euro FX", "category": "Currency", "exchange": "CME", "point_value": 12500, "tick_size": 0.0001, "tick_value": 1.25, "currency": "USD"},
    {"symbol": "6B", "name": "British Pound", "category": "Currency", "exchange": "CME", "point_value": 62500, "tick_size": 0.0001, "tick_value": 6.25, "currency": "USD"},
    {"symbol": "6J", "name": "Japanese Yen", "category": "Currency", "exchange": "CME", "point_value": 12500000, "tick_size": 0.0000005, "tick_value": 6.25, "currency": "USD"},
    {"symbol": "6A", "name": "Australian Dollar", "category": "Currency", "exchange": "CME", "point_value": 100000, "tick_size": 0.0001, "tick_value": 10.00, "currency": "USD"},
    {"symbol": "6C", "name": "Canadian Dollar", "category": "Currency", "exchange": "CME", "point_value": 100000, "tick_size": 0.0001, "tick_value": 10.00, "currency": "USD"},
    # Crypto futures
    {"symbol": "BTC", "name": "Bitcoin Futures", "category": "Crypto", "exchange": "CME", "point_value": 5, "tick_size": 5, "tick_value": 25.00, "currency": "USD"},
    {"symbol": "MBT", "name": "Micro Bitcoin", "category": "Crypto", "exchange": "CME", "point_value": 0.10, "tick_size": 5, "tick_value": 0.50, "currency": "USD"},
    {"symbol": "ETH", "name": "Ether Futures", "category": "Crypto", "exchange": "CME", "point_value": 50, "tick_size": 0.50, "tick_value": 25.00, "currency": "USD"},
    {"symbol": "MET", "name": "Micro Ether", "category": "Crypto", "exchange": "CME", "point_value": 0.10, "tick_size": 0.25, "tick_value": 0.025, "currency": "USD"},
    # Agricultural
    {"symbol": "ZC", "name": "Corn", "category": "Agriculture", "exchange": "CBOT", "point_value": 50, "tick_size": 0.25, "tick_value": 12.50, "currency": "USD"},
    {"symbol": "ZS", "name": "Soybeans", "category": "Agriculture", "exchange": "CBOT", "point_value": 50, "tick_size": 0.25, "tick_value": 12.50, "currency": "USD"},
    {"symbol": "ZW", "name": "Wheat", "category": "Agriculture", "exchange": "CBOT", "point_value": 50, "tick_size": 0.25, "tick_value": 12.50, "currency": "USD"},
]


CONTRACTS_BY_SYMBOL = {c["symbol"]: c for c in FUTURES_CONTRACTS}


SESSIONS = [
    {"id": "asia", "label": "Asia", "hours": "18:00-03:00 ET"},
    {"id": "london", "label": "London", "hours": "03:00-08:00 ET"},
    {"id": "ny_am", "label": "NY AM (Open)", "hours": "09:30-12:00 ET"},
    {"id": "ny_pm", "label": "NY PM (Close)", "hours": "12:00-16:00 ET"},
    {"id": "rth", "label": "RTH (Regular)", "hours": "09:30-16:00 ET"},
    {"id": "globex", "label": "Globex (Overnight)", "hours": "18:00-09:30 ET"},
]
