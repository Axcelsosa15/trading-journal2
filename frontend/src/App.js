import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AppShell from '@/components/layout/AppShell';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';
import DashboardPage from '@/pages/Dashboard';
import TradesPage from '@/pages/Trades';
import TradeDetailPage from '@/pages/TradeDetail';
import NewTradePage from '@/pages/NewTrade';
import StrategiesPage from '@/pages/Strategies';
import BrokersPage from '@/pages/Brokers';
import ContractsPage from '@/pages/Contracts';
import ImportPage from '@/pages/Import';
import InsightsPage from '@/pages/Insights';
import SettingsPage from '@/pages/Settings';
import '@/App.css';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicOnly = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="App min-h-screen bg-background text-foreground">
            <Routes>
              <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
              <Route element={<Protected><AppShell /></Protected>}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/trades" element={<TradesPage />} />
                <Route path="/trades/new" element={<NewTradePage />} />
                <Route path="/trades/:id" element={<TradeDetailPage />} />
                <Route path="/strategies" element={<StrategiesPage />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/brokers" element={<BrokersPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-right" />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
