import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/common/KpiCard';
import { Empty } from '@/components/common/Empty';
import { Button } from '@/components/ui/button';
import { fmtCurrency, fmtPercent, fmtNumber, pnlClass, fmtDate, fmtDateTime } from '@/lib/format';
import { TrendingUp, TrendingDown, Percent, Target, Activity, AlertTriangle, BarChart2, PlusCircle, Sparkles, Layers, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';
import CalendarHeatmap from '@/components/charts/CalendarHeatmap';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [equity, setEquity] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [recent, setRecent] = useState([]);
  const [bySymbol, setBySymbol] = useState([]);
  const [bySession, setBySession] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [s, e, c, t, bs, bss] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/equity'),
        api.get('/analytics/calendar'),
        api.get('/trades', { params: { limit: 8 } }),
        api.get('/analytics/breakdown', { params: { by: 'symbol' } }),
        api.get('/analytics/breakdown', { params: { by: 'session' } }),
      ]);
      setSummary(s.data);
      setEquity(e.data);
      setCalendar(c.data);
      setRecent(t.data);
      setBySymbol(bs.data);
      setBySession(bss.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Stable chart configuration objects (avoid new refs on every render)
  const chartMargin = useMemo(() => ({ top: 10, right: 8, bottom: 0, left: 0 }), []);
  const barMargin = useMemo(() => ({ top: 5, right: 5, left: 5, bottom: 5 }), []);
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    fontSize: 12,
  }), []);
  const axisStyleSmall = useMemo(() => ({ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }), []);
  const axisStyleMono = useMemo(() => ({ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono' }), []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['a','b','c','d'].map(k => <div key={`sk-${k}`} className="glass-card p-5 h-28 animate-pulse" />)}
      </div>
    );
  }

  const noData = !summary || summary.total_trades === 0;
  const topContracts = bySymbol.slice(0, 8);

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your futures trading edge at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/trades/new"><Button data-testid="dashboard-add-trade" className="rounded-xl"><PlusCircle className="w-4 h-4 mr-2" /> New Trade</Button></Link>
          <Link to="/insights"><Button data-testid="dashboard-run-insight" variant="secondary" className="rounded-xl"><Sparkles className="w-4 h-4 mr-2" /> Run AI Insight</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard testid="kpi-net-pnl" label="Net P&L" value={fmtCurrency(summary.net_pnl)} sublabel={`${summary.closed_trades} closed trades`} icon={summary.net_pnl >= 0 ? TrendingUp : TrendingDown} accent={pnlClass(summary.net_pnl)} />
        <KpiCard testid="kpi-win-rate" label="Win Rate" value={fmtPercent(summary.win_rate)} sublabel={`${summary.wins}W / ${summary.losses}L`} icon={Percent} accent={summary.win_rate >= 50 ? 'text-pnl-pos' : 'text-pnl-neutral'} />
        <KpiCard testid="kpi-profit-factor" label="Profit Factor" value={fmtNumber(summary.profit_factor)} sublabel={`Expectancy ${fmtCurrency(summary.expectancy)}`} icon={Target} accent={summary.profit_factor >= 1.5 ? 'text-pnl-pos' : (summary.profit_factor >= 1 ? 'text-pnl-neutral' : 'text-pnl-neg')} />
        <KpiCard testid="kpi-max-dd" label="Max Drawdown" value={fmtCurrency(summary.max_drawdown)} sublabel={`Sharpe ${fmtNumber(summary.sharpe_ratio, 2)}`} icon={AlertTriangle} accent="text-pnl-neg" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard testid="kpi-avg-win" label="Avg Win" value={fmtCurrency(summary.avg_win)} icon={TrendingUp} accent="text-pnl-pos" />
        <KpiCard testid="kpi-avg-loss" label="Avg Loss" value={fmtCurrency(summary.avg_loss)} icon={TrendingDown} accent="text-pnl-neg" />
        <KpiCard testid="kpi-best" label="Best Trade" value={fmtCurrency(summary.best_trade)} icon={Activity} accent="text-pnl-pos" />
        <KpiCard testid="kpi-worst" label="Worst Trade" value={fmtCurrency(summary.worst_trade)} icon={Activity} accent="text-pnl-neg" />
      </div>

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
                <AreaChart data={equity} margin={chartMargin}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border)/0.5)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="date" tick={axisStyleSmall} tickFormatter={(v) => fmtDate(v)} stroke="hsl(var(--border))" />
                  <YAxis tick={axisStyleSmall} stroke="hsl(var(--border))" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5" data-testid="by-contract-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold flex items-center gap-2"><Layers className="w-4 h-4" /> Top Contracts</h2>
              <p className="text-xs text-muted-foreground">P&L by symbol</p>
            </div>
          </div>
          {topContracts.length === 0 ? (
            <Empty icon={Layers} title="No data yet" description="Log futures trades to see contract performance." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContracts} margin={barMargin}>
                  <CartesianGrid stroke="hsl(var(--border)/0.5)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="key" tick={axisStyleMono} stroke="hsl(var(--border))" />
                  <YAxis tick={axisStyleSmall} stroke="hsl(var(--border))" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name, props) => [fmtCurrency(value), `P&L (${props.payload.trades} trades)`]}
                  />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                    {topContracts.map((d) => (
                      <Cell key={d.key} fill={d.pnl >= 0 ? 'hsl(152 55% 42%)' : 'hsl(0 72% 55%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-5" data-testid="by-session-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> By Session</h2>
              <p className="text-xs text-muted-foreground">When are you profitable?</p>
            </div>
          </div>
          {bySession.length === 0 ? (
            <Empty icon={Clock} title="No session data" description="Tag your trades with sessions (RTH, Globex, NY AM, etc.)." />
          ) : (
            <ul className="space-y-2.5">
              {bySession.map(s => {
                const max = Math.max(1, ...bySession.map(x => Math.abs(x.pnl)));
                const ratio = Math.min(1, Math.abs(s.pnl) / max);
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <span className="w-24 text-xs font-medium capitalize">{(s.key || '').replace('_', ' ')}</span>
                    <div className="flex-1 h-6 bg-secondary/40 rounded-lg overflow-hidden relative">
                      <div className={cn('h-full', s.pnl >= 0 ? 'bg-emerald-500/40' : 'bg-rose-500/40')} style={{ width: `${ratio * 100}%` }} />
                      <span className="absolute left-2 top-0.5 text-[10px] text-muted-foreground">{s.trades} trades • {fmtPercent(s.win_rate, 0)} WR</span>
                    </div>
                    <span className={cn('text-sm font-semibold tabular w-20 text-right', pnlClass(s.pnl))}>{fmtCurrency(s.pnl)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

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
                  <th className="py-2.5 pr-3 text-right">Qty</th>
                  <th className="py-2.5 pr-3 text-right">Entry</th>
                  <th className="py-2.5 pr-3 text-right">Exit</th>
                  <th className="py-2.5 pr-3">Session</th>
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
                    <td className="py-2.5 pr-3 text-right tabular">{fmtNumber(t.quantity, 0)}</td>
                    <td className="py-2.5 pr-3 text-right tabular">{fmtNumber(t.entry_price, 2)}</td>
                    <td className="py-2.5 pr-3 text-right tabular">{t.exit_price ? fmtNumber(t.exit_price, 2) : '—'}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs capitalize">{(t.session || '').replace('_',' ') || '—'}</td>
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
          <p className="text-sm text-muted-foreground">Pro tip: Import a CSV from Tradovate, NinjaTrader or TopStep — or add your first futures trade manually using the quick contract picker (ES, NQ, MES, MNQ…).</p>
        </div>
      )}
    </div>
  );
}
