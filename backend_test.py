"""Comprehensive backend API tests for Trading Journal."""
import requests
import sys
import json
from datetime import datetime, timezone, timedelta

BASE_URL = "https://trading-tracker-full.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class APITester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.token = None
        self.user_id = None
        self.test_user_email = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com"
        self.demo_email = "demo@trading.com"
        self.demo_password = "demo123"
        self.created_ids = {
            'trades': [],
            'strategies': [],
            'tags': [],
            'brokers': [],
            'insights': []
        }

    def log(self, msg, color=Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")

    def test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None, params=None):
        """Run a single API test."""
        url = f"{BASE_URL}{endpoint}"
        h = {'Content-Type': 'application/json'}
        if self.token:
            h['Authorization'] = f'Bearer {self.token}'
        if headers:
            h.update(headers)
        
        self.tests_run += 1
        self.log(f"\n[{self.tests_run}] Testing: {name}", Colors.BLUE)
        
        try:
            if method == 'GET':
                r = requests.get(url, headers=h, params=params, timeout=30)
            elif method == 'POST':
                if files:
                    h.pop('Content-Type', None)
                    r = requests.post(url, headers=h, files=files, data=data, timeout=30)
                else:
                    r = requests.post(url, headers=h, json=data, timeout=30)
            elif method == 'PATCH':
                r = requests.patch(url, headers=h, json=data, timeout=30)
            elif method == 'DELETE':
                r = requests.delete(url, headers=h, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = r.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASS - Status: {r.status_code}", Colors.GREEN)
                try:
                    resp = r.json()
                    return True, resp
                except:
                    return True, {}
            else:
                self.tests_failed += 1
                self.log(f"❌ FAIL - Expected {expected_status}, got {r.status_code}", Colors.RED)
                try:
                    self.log(f"   Response: {r.text[:500]}", Colors.YELLOW)
                except:
                    pass
                return False, {}

        except Exception as e:
            self.tests_failed += 1
            self.log(f"❌ FAIL - Exception: {str(e)}", Colors.RED)
            return False, {}

    def run_all_tests(self):
        """Run all backend tests in sequence."""
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("🚀 TRADING JOURNAL BACKEND API TESTS", Colors.BLUE)
        self.log("="*80 + "\n", Colors.BLUE)

        # ==================== AUTH TESTS ====================
        self.log("\n📋 SECTION 1: AUTHENTICATION", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 1: Register new user
        success, resp = self.test(
            "POST /auth/register - Create new user",
            "POST", "/auth/register", 200,
            data={"email": self.test_user_email, "password": "test123456", "name": "Test User"}
        )
        if success and 'access_token' in resp:
            self.token = resp['access_token']
            self.user_id = resp['user']['id']
            self.log(f"   Token obtained: {self.token[:20]}...", Colors.GREEN)
            self.log(f"   User ID: {self.user_id}", Colors.GREEN)

        # Test 2: Login with demo account
        success, resp = self.test(
            "POST /auth/login - Login with demo@trading.com",
            "POST", "/auth/login", 200,
            data={"email": self.demo_email, "password": self.demo_password}
        )
        demo_token = None
        if success and 'access_token' in resp:
            demo_token = resp['access_token']
            self.log(f"   Demo token obtained", Colors.GREEN)

        # Test 3: Get current user
        success, resp = self.test(
            "GET /auth/me - Get current user info",
            "GET", "/auth/me", 200
        )
        if success:
            self.log(f"   User email: {resp.get('email')}", Colors.GREEN)

        # Test 4: Auth enforcement - no token
        old_token = self.token
        self.token = None
        self.test(
            "GET /auth/me - Without token (expect 401)",
            "GET", "/auth/me", 401
        )
        self.token = old_token

        # Test 5: Auth enforcement - invalid token
        self.token = "invalid_token_12345"
        self.test(
            "GET /auth/me - With invalid token (expect 401)",
            "GET", "/auth/me", 401
        )
        self.token = old_token

        # ==================== STRATEGIES TESTS ====================
        self.log("\n📋 SECTION 2: STRATEGIES", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 6: Create strategy
        success, resp = self.test(
            "POST /strategies - Create strategy",
            "POST", "/strategies", 200,
            data={"name": "Breakout Strategy", "description": "Trade breakouts above resistance", "color": "#3b82f6"}
        )
        if success and 'id' in resp:
            self.created_ids['strategies'].append(resp['id'])
            self.log(f"   Strategy ID: {resp['id']}", Colors.GREEN)

        # Test 7: List strategies
        success, resp = self.test(
            "GET /strategies - List strategies",
            "GET", "/strategies", 200
        )
        if success:
            self.log(f"   Found {len(resp)} strategies", Colors.GREEN)

        # ==================== TAGS TESTS ====================
        self.log("\n📋 SECTION 3: TAGS", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 8: Create tag
        success, resp = self.test(
            "POST /tags - Create tag",
            "POST", "/tags", 200,
            data={"name": "High Confidence", "color": "#10b981"}
        )
        if success and 'id' in resp:
            self.created_ids['tags'].append(resp['id'])

        # Test 9: List tags
        success, resp = self.test(
            "GET /tags - List tags",
            "GET", "/tags", 200
        )
        if success:
            self.log(f"   Found {len(resp)} tags", Colors.GREEN)

        # ==================== TRADES TESTS ====================
        self.log("\n📋 SECTION 4: TRADES CRUD", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 10: Create trade with all fields
        now = datetime.now(timezone.utc)
        entry_time = (now - timedelta(hours=2)).isoformat()
        exit_time = now.isoformat()
        
        trade_data = {
            "symbol": "AAPL",
            "market_type": "stocks",
            "side": "long",
            "quantity": 100,
            "entry_price": 175.50,
            "exit_price": 180.25,
            "stop_loss": 173.00,
            "take_profit": 182.00,
            "fees": 1.00,
            "commission": 1.00,
            "entry_time": entry_time,
            "exit_time": exit_time,
            "status": "closed",
            "strategy_id": self.created_ids['strategies'][0] if self.created_ids['strategies'] else None,
            "tags": ["momentum", "breakout"],
            "emotion": "confident",
            "rating": 5,
            "notes": "Clean breakout above resistance with volume",
            "mistakes": None,
            "lessons": "Patience paid off"
        }
        
        success, resp = self.test(
            "POST /trades - Create trade with all fields",
            "POST", "/trades", 200,
            data=trade_data
        )
        if success and 'id' in resp:
            self.created_ids['trades'].append(resp['id'])
            self.log(f"   Trade ID: {resp['id']}", Colors.GREEN)
            self.log(f"   P&L computed: ${resp.get('pnl', 0)}", Colors.GREEN)
            self.log(f"   P&L %: {resp.get('pnl_percent', 0)}%", Colors.GREEN)

        # Test 11: Create another trade (for analytics)
        trade_data2 = {
            "symbol": "TSLA",
            "market_type": "stocks",
            "side": "short",
            "quantity": 50,
            "entry_price": 265.00,
            "exit_price": 259.50,
            "fees": 0.50,
            "commission": 0.50,
            "entry_time": (now - timedelta(days=1)).isoformat(),
            "exit_time": (now - timedelta(hours=12)).isoformat(),
            "status": "closed",
            "emotion": "calm",
            "notes": "Short on rejection"
        }
        success, resp = self.test(
            "POST /trades - Create second trade",
            "POST", "/trades", 200,
            data=trade_data2
        )
        if success and 'id' in resp:
            self.created_ids['trades'].append(resp['id'])

        # Test 12: List trades
        success, resp = self.test(
            "GET /trades - List all trades",
            "GET", "/trades", 200
        )
        if success:
            self.log(f"   Found {len(resp)} trades", Colors.GREEN)

        # Test 13: List trades with filters
        success, resp = self.test(
            "GET /trades?symbol=AAPL - Filter by symbol",
            "GET", "/trades", 200,
            params={"symbol": "AAPL"}
        )
        if success:
            self.log(f"   Found {len(resp)} AAPL trades", Colors.GREEN)

        # Test 14: List trades with market filter
        success, resp = self.test(
            "GET /trades?market_type=stocks - Filter by market",
            "GET", "/trades", 200,
            params={"market_type": "stocks"}
        )
        if success:
            self.log(f"   Found {len(resp)} stock trades", Colors.GREEN)

        # Test 15: List trades with status filter
        success, resp = self.test(
            "GET /trades?status=closed - Filter by status",
            "GET", "/trades", 200,
            params={"status": "closed"}
        )
        if success:
            self.log(f"   Found {len(resp)} closed trades", Colors.GREEN)

        # Test 16: Get single trade
        if self.created_ids['trades']:
            trade_id = self.created_ids['trades'][0]
            success, resp = self.test(
                f"GET /trades/{trade_id} - Get trade by ID",
                "GET", f"/trades/{trade_id}", 200
            )
            if success:
                self.log(f"   Trade symbol: {resp.get('symbol')}", Colors.GREEN)

        # Test 17: Update trade
        if self.created_ids['trades']:
            trade_id = self.created_ids['trades'][0]
            success, resp = self.test(
                f"PATCH /trades/{trade_id} - Update trade",
                "PATCH", f"/trades/{trade_id}", 200,
                data={"notes": "Updated notes - tested PATCH endpoint", "rating": 4}
            )
            if success:
                self.log(f"   Updated notes: {resp.get('notes')[:50]}...", Colors.GREEN)

        # ==================== ANALYTICS TESTS ====================
        self.log("\n📋 SECTION 5: ANALYTICS", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 18: Get analytics summary
        success, resp = self.test(
            "GET /analytics/summary - Get metrics summary",
            "GET", "/analytics/summary", 200
        )
        if success:
            self.log(f"   Net P&L: ${resp.get('net_pnl', 0)}", Colors.GREEN)
            self.log(f"   Win Rate: {resp.get('win_rate', 0)}%", Colors.GREEN)
            self.log(f"   Profit Factor: {resp.get('profit_factor', 0)}", Colors.GREEN)
            self.log(f"   Max Drawdown: ${resp.get('max_drawdown', 0)}", Colors.GREEN)
            self.log(f"   Avg Win: ${resp.get('avg_win', 0)}", Colors.GREEN)
            self.log(f"   Avg Loss: ${resp.get('avg_loss', 0)}", Colors.GREEN)
            self.log(f"   Best Trade: ${resp.get('best_trade', 0)}", Colors.GREEN)
            self.log(f"   Worst Trade: ${resp.get('worst_trade', 0)}", Colors.GREEN)

        # Test 19: Get equity curve
        success, resp = self.test(
            "GET /analytics/equity - Get equity curve",
            "GET", "/analytics/equity", 200
        )
        if success:
            self.log(f"   Equity curve points: {len(resp)}", Colors.GREEN)

        # Test 20: Get calendar
        success, resp = self.test(
            "GET /analytics/calendar - Get P&L calendar",
            "GET", "/analytics/calendar", 200
        )
        if success:
            self.log(f"   Calendar days: {len(resp)}", Colors.GREEN)

        # Test 21: Breakdown by symbol
        success, resp = self.test(
            "GET /analytics/breakdown?by=symbol - Breakdown by symbol",
            "GET", "/analytics/breakdown", 200,
            params={"by": "symbol"}
        )
        if success:
            self.log(f"   Symbols analyzed: {len(resp)}", Colors.GREEN)

        # Test 22: Breakdown by strategy
        success, resp = self.test(
            "GET /analytics/breakdown?by=strategy_id - Breakdown by strategy",
            "GET", "/analytics/breakdown", 200,
            params={"by": "strategy_id"}
        )
        if success:
            self.log(f"   Strategies analyzed: {len(resp)}", Colors.GREEN)

        # Test 23: Breakdown by day_of_week
        success, resp = self.test(
            "GET /analytics/breakdown?by=day_of_week - Breakdown by day of week",
            "GET", "/analytics/breakdown", 200,
            params={"by": "day_of_week"}
        )
        if success:
            self.log(f"   Days analyzed: {len(resp)}", Colors.GREEN)

        # Test 24: Breakdown by emotion
        success, resp = self.test(
            "GET /analytics/breakdown?by=emotion - Breakdown by emotion",
            "GET", "/analytics/breakdown", 200,
            params={"by": "emotion"}
        )
        if success:
            self.log(f"   Emotions analyzed: {len(resp)}", Colors.GREEN)

        # ==================== BROKER CONNECTIONS TESTS ====================
        self.log("\n📋 SECTION 6: BROKER CONNECTIONS", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 25: Create Binance connection
        success, resp = self.test(
            "POST /brokers/connections - Create Binance connection",
            "POST", "/brokers/connections", 200,
            data={
                "broker": "binance",
                "label": "Binance Main",
                "api_key": "dummy_binance_key_12345",
                "api_secret": "dummy_binance_secret_67890",
                "environment": "live"
            }
        )
        if success and 'id' in resp:
            self.created_ids['brokers'].append(resp['id'])
            self.log(f"   Binance connection ID: {resp['id']}", Colors.GREEN)

        # Test 26: Create Alpaca connection
        success, resp = self.test(
            "POST /brokers/connections - Create Alpaca connection",
            "POST", "/brokers/connections", 200,
            data={
                "broker": "alpaca",
                "label": "Alpaca Paper",
                "api_key": "dummy_alpaca_key",
                "api_secret": "dummy_alpaca_secret",
                "environment": "paper"
            }
        )
        if success and 'id' in resp:
            self.created_ids['brokers'].append(resp['id'])

        # Test 27: Create OANDA connection
        success, resp = self.test(
            "POST /brokers/connections - Create OANDA connection",
            "POST", "/brokers/connections", 200,
            data={
                "broker": "oanda",
                "label": "OANDA Practice",
                "api_key": "dummy_oanda_token",
                "account_id": "001-001-1234567-001",
                "environment": "practice"
            }
        )
        if success and 'id' in resp:
            self.created_ids['brokers'].append(resp['id'])

        # Test 28: List broker connections
        success, resp = self.test(
            "GET /brokers/connections - List connections",
            "GET", "/brokers/connections", 200
        )
        if success:
            self.log(f"   Found {len(resp)} broker connections", Colors.GREEN)
            # Verify secrets are not exposed
            for conn in resp:
                if 'api_key_enc' in conn or 'api_secret_enc' in conn:
                    self.log(f"   ⚠️  WARNING: Encrypted secrets exposed in list response!", Colors.YELLOW)

        # Test 29: Sync broker with dummy keys (expect 400)
        if self.created_ids['brokers']:
            broker_id = self.created_ids['brokers'][0]
            success, resp = self.test(
                f"POST /brokers/connections/{broker_id}/sync - Sync with dummy keys (expect 400)",
                "POST", f"/brokers/connections/{broker_id}/sync", 400
            )
            if success:
                self.log(f"   Correctly returned 400 for invalid credentials", Colors.GREEN)

        # ==================== CSV IMPORT TESTS ====================
        self.log("\n📋 SECTION 7: CSV IMPORT", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 30: CSV preview
        try:
            with open('/app/sample_trades.csv', 'rb') as f:
                success, resp = self.test(
                    "POST /import/csv/preview - Preview CSV",
                    "POST", "/import/csv/preview", 200,
                    files={'file': ('sample_trades.csv', f, 'text/csv')}
                )
                if success:
                    self.log(f"   Total parsed: {resp.get('total_parsed', 0)}", Colors.GREEN)
                    self.log(f"   Headers: {resp.get('headers', [])}", Colors.GREEN)
                    self.log(f"   Mapping: {resp.get('mapping', {})}", Colors.GREEN)
                    self.log(f"   Errors: {len(resp.get('errors', []))}", Colors.GREEN)
        except Exception as e:
            self.log(f"   ⚠️  CSV preview failed: {e}", Colors.YELLOW)

        # Test 31: CSV import
        try:
            with open('/app/sample_trades.csv', 'rb') as f:
                success, resp = self.test(
                    "POST /import/csv - Import CSV trades",
                    "POST", "/import/csv", 200,
                    files={'file': ('sample_trades.csv', f, 'text/csv')}
                )
                if success:
                    inserted = resp.get('inserted', 0)
                    self.log(f"   Inserted: {inserted} trades", Colors.GREEN)
                    if inserted >= 10:
                        self.log(f"   ✅ CSV import successful (>=10 trades)", Colors.GREEN)
                    else:
                        self.log(f"   ⚠️  Expected >=10 trades, got {inserted}", Colors.YELLOW)
        except Exception as e:
            self.log(f"   ⚠️  CSV import failed: {e}", Colors.YELLOW)

        # ==================== AI INSIGHTS TESTS ====================
        self.log("\n📋 SECTION 8: AI INSIGHTS", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 32: Generate AI insights (general preset)
        success, resp = self.test(
            "POST /ai/insights - Generate insights (general preset)",
            "POST", "/ai/insights", 200,
            data={"prompt_preset": "general"}
        )
        if success and 'id' in resp:
            self.created_ids['insights'].append(resp['id'])
            self.log(f"   Insight ID: {resp['id']}", Colors.GREEN)
            self.log(f"   Trades analyzed: {resp.get('trades_analyzed', 0)}", Colors.GREEN)
            response_data = resp.get('response', {})
            if isinstance(response_data, dict):
                self.log(f"   Summary: {response_data.get('summary', '')[:100]}...", Colors.GREEN)
                self.log(f"   Strengths: {len(response_data.get('strengths', []))} items", Colors.GREEN)
                self.log(f"   Weaknesses: {len(response_data.get('weaknesses', []))} items", Colors.GREEN)
                self.log(f"   Recommendations: {len(response_data.get('recommendations', []))} items", Colors.GREEN)

        # Test 33: List AI insights
        success, resp = self.test(
            "GET /ai/insights - List insights",
            "GET", "/ai/insights", 200
        )
        if success:
            self.log(f"   Found {len(resp)} insights", Colors.GREEN)

        # ==================== USER DATA ISOLATION TESTS ====================
        self.log("\n📋 SECTION 9: USER DATA ISOLATION", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Test 34: Register second user
        second_user_email = f"test2_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com"
        success, resp = self.test(
            "POST /auth/register - Create second user",
            "POST", "/auth/register", 200,
            data={"email": second_user_email, "password": "test123456", "name": "Test User 2"}
        )
        second_token = None
        if success and 'access_token' in resp:
            second_token = resp['access_token']
            self.log(f"   Second user created", Colors.GREEN)

        # Test 35: Verify second user cannot see first user's trades
        if second_token:
            old_token = self.token
            self.token = second_token
            success, resp = self.test(
                "GET /trades - Second user's trades (should be empty)",
                "GET", "/trades", 200
            )
            if success:
                if len(resp) == 0:
                    self.log(f"   ✅ Data isolation working - second user sees 0 trades", Colors.GREEN)
                else:
                    self.log(f"   ⚠️  WARNING: Second user can see {len(resp)} trades!", Colors.YELLOW)
            self.token = old_token

        # ==================== CLEANUP ====================
        self.log("\n📋 SECTION 10: CLEANUP", Colors.BLUE)
        self.log("-" * 80, Colors.BLUE)

        # Delete created resources
        for trade_id in self.created_ids['trades'][:2]:  # Delete first 2 trades only
            self.test(
                f"DELETE /trades/{trade_id} - Delete trade",
                "DELETE", f"/trades/{trade_id}", 200
            )

        for strategy_id in self.created_ids['strategies']:
            self.test(
                f"DELETE /strategies/{strategy_id} - Delete strategy",
                "DELETE", f"/strategies/{strategy_id}", 200
            )

        for broker_id in self.created_ids['brokers']:
            self.test(
                f"DELETE /brokers/connections/{broker_id} - Delete broker connection",
                "DELETE", f"/brokers/connections/{broker_id}", 200
            )

        # ==================== SUMMARY ====================
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("📊 TEST SUMMARY", Colors.BLUE)
        self.log("="*80, Colors.BLUE)
        self.log(f"Total Tests: {self.tests_run}", Colors.BLUE)
        self.log(f"Passed: {self.tests_passed}", Colors.GREEN)
        self.log(f"Failed: {self.tests_failed}", Colors.RED)
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Success Rate: {success_rate:.1f}%", Colors.GREEN if success_rate >= 90 else Colors.YELLOW)
        self.log("="*80 + "\n", Colors.BLUE)

        return 0 if self.tests_failed == 0 else 1

def main():
    tester = APITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
