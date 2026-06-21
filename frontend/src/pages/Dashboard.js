import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/common/KpiCard';
import { Empty } from '@/components/common/Empty';
import { Button } from '@/components/ui/button';
import { fmtCurrency, fmtPercent, fmtNumber, pnlClass, fmtDate, fmtDateTime } from '@/lib/format';
import { TrendingUp, TrendingDown, Percent, Target, Activity, AlertTriangle, BarChart2, PlusCircle, Sparkles } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import CalendarHeatmap from '@/components/charts/CalendarHeatmap';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [equity, setEquity] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, e, c, t] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/equity'),
          api.get('/analytics/calendar'),
          api.get('/trades', { params: { limit: 8 } }),
        ]);
        setSummary(s.data);
        setEquity(e.data);
        setCalendar(c.data);
        setRecent(t.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <div key={i} className="glass-card p-5 h-28 animate-pulse" />)}
      </div>
    );
  }

  const noData = !summary || summary.total_trades === 0;

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your trading edge at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/trades/new"><Button data-testid="dashboard-add-trade" className="rounded-xl"><PlusCircle className="w-4 h-4 mr-2" /> New Trade</Button></Link>
          <Link to="/insights"><Button data-testid="dashboard-run-insight" variant="secondary" className="rounded-xl"><Sparkles className="w-4 h-4 mr-2" /> Run AI Insight</Button></Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard testid="kpi-net-pnl" label="Net P&L" value={fmtCurrency(summary.net_pnl)} sublabel={`${summary.closed_trades} closed trades`} icon={summary.net_pnl >= 0 ? TrendingUp : TrendingDown} accent={pnlClass(summary.net_pnl)} />
        <KpiCard testid="kpi-win-rate" label="Win Rate" value={fmtPercent(summary.win_rate)} sublabel={`${summary.wins}W / ${summary.losses}L`} icon={Percent} accent={summary.win_rate >= 50 ? 'text-pnl-pos' : 'text-pnl-neutral'} />
        <KpiCard testid="kpi-profit-factor" label="Profit Factor" value={fmtNumber(summary.profit_factor)} sublabel={`Expectancy ${fmtCurrency(summary.expectancy)}`} icon={Target} accent={summary.profit_factor >= 1.5 ? 'text-pnl-pos' : (summary.profit_factor >= 1 ? 'text-pnl-neutral' : 'text-pnl-neg')} />
        <KpiCard testid="kpi-max-dd" label="Max Drawdown" value={fmtCurrency(summary.max_drawdown)} sublabel={`Sharpe ${fmtNumber(summary.sharpe_ratio, 2)}`} icon={AlertTriangle} accent="text-pnl-neg" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard testid="kpi-avg-win" label="Avg Win" value={fmtCurrency(summary.avg_win)} icon={TrendingUp} accent="text-pnl-pos" />
        <KpiCard testid="kpi-avg-loss" label="Avg Loss" value={fmtCurrency(summary.avg_loss)} icon={TrendingDown} accent="text-pnl-neg" />
        <KpiCard testid="kpi-best" label="Best Trade" value={fmtCurrency(summary.best_trade)} icon={Activity} accent="text-pnl-pos" />
        <KpiCard testid="kpi-worst" label="Worst Trade" value={fmtCurrency(summary.worst_trade)} icon={Activity} accent="text-pnl-neg" />
      </div>

      {/* Equity + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 glass-card p-5" data-testid="equity-chart-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold">Equity Curve</h2>
              <p className="text-xs text-muted-foreground">Cumulative P&L over time</p>
            </div>
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
          </div>
          {equity.length === 0 ? (
            <Empty icon={BarChart2} title="No closed trades yet" description="Add or import trades to see your equity curve." />
          ) : (
            <div className="h-64" data-testid="equity-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equity} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border)/0.5)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => fmtDate(v)} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                    formatter={(value, name) => [fmtCurrency(value), name]}
                    labelFormatter={(l) => fmtDateTime(l)}
                  />
                  <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#equityGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 glass-card p-5" data-testid="calendar-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold">P&L Calendar</h2>
              <p className="text-xs text-muted-foreground">Daily performance heatmap</p>
            </div>
          </div>
          <CalendarHeatmap data={calendar} />
        </div>
      </div>

      {/* Recent trades */}
      <div className="glass-card p-5" data-testid="recent-trades-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold">Recent Trades</h2>
            <p className="text-xs text-muted-foreground">Latest 8 entries</p>
          </div>
          <Link to="/trades" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <Empty icon={PlusCircle} title="No trades yet" description="Start logging trades or import from a broker."
            action={<Link to="/trades/new"><Button className="rounded-xl"><PlusCircle className="w-4 h-4 mr-2" /> Add your first trade</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="recent-trades-table">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="py-2.5 pr-3">Symbol</th>
                  <th className="py-2.5 pr-3">Side</th>
                  <th className="py-2.5 pr-3">Market</th>
                  <th className="py-2.5 pr-3 text-right">Qty</th>
                  <th className="py-2.5 pr-3 text-right">Entry</th>
                  <th className="py-2.5 pr-3 text-right">Exit</th>
                  <th className="py-2.5 pr-3 text-right">P&L</th>
                  <th className="py-2.5 pr-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 pr-3 font-mono font-medium">
                      <Link to={`/trades/${t.id}`} className="hover:text-primary">{t.symbol}</Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase',
                        t.side === 'long' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}>
                        {t.side}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground capitalize">{t.market_type}</td>
                    <td className="py-2.5 pr-3 text-right tabular">{fmtNumber(t.quantity, 4)}</td>
                    <td className="py-2.5 pr-3 text-right tabular">{fmtNumber(t.entry_price, 2)}</td>
                    <td className="py-2.5 pr-3 text-right tabular">{t.exit_price ? fmtNumber(t.exit_price, 2) : '—'}</td>
                    <td className={cn('py-2.5 pr-3 text-right font-semibold tabular', pnlClass(t.pnl))}>{fmtCurrency(t.pnl)}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{fmtDate(t.exit_time || t.entry_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {noData && (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Pro tip: connect a broker, import a CSV, or add your first trade manually to see metrics light up.</p>
        </div>
      )}
    </div>
  );
}
