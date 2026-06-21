import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/common/Empty';
import { fmtCurrency, fmtNumber, pnlClass, fmtDateTime, fmtR } from '@/lib/format';
import { Search, Filter, PlusCircle, List, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function TradesPage() {
  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [market, setMarket] = useState('all');
  const [status, setStatus] = useState('all');
  const [strategy, setStrategy] = useState('all');
  const [result, setResult] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (market !== 'all') params.market_type = market;
      if (status !== 'all') params.status = status;
      if (strategy !== 'all') params.strategy_id = strategy;
      const [r, s] = await Promise.all([
        api.get('/trades', { params }),
        api.get('/strategies'),
      ]);
      setTrades(r.data);
      setStrategies(s.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [market, status, strategy]);

  const filtered = useMemo(() => {
    let list = trades;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => (t.symbol || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q));
    }
    if (result === 'wins') list = list.filter(t => (t.pnl || 0) > 0);
    else if (result === 'losses') list = list.filter(t => (t.pnl || 0) < 0);
    else if (result === 'breakeven') list = list.filter(t => (t.pnl || 0) === 0);
    return list;
  }, [trades, search, result]);

  const stratMap = useMemo(() => Object.fromEntries(strategies.map(s => [s.id, s])), [strategies]);

  const onDelete = async (id) => {
    if (!confirm('Delete this trade?')) return;
    await api.delete(`/trades/${id}`);
    toast.success('Trade deleted');
    load();
  };

  return (
    <div className="space-y-5" data-testid="trades-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {trades.length} trades</p>
        </div>
        <Link to="/trades/new"><Button data-testid="trades-add-button" className="rounded-xl"><PlusCircle className="w-4 h-4 mr-2" /> New Trade</Button></Link>
      </div>

      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input data-testid="trades-search" placeholder="Search symbol or notes…" className="pl-9 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger data-testid="trades-filter-market" className="rounded-xl"><SelectValue placeholder="Market" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              <SelectItem value="stocks">Stocks</SelectItem>
              <SelectItem value="forex">Forex</SelectItem>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="futures">Futures</SelectItem>
              <SelectItem value="options">Options</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="trades-filter-status" className="rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger data-testid="trades-filter-result" className="rounded-xl"><SelectValue placeholder="Result" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Result</SelectItem>
              <SelectItem value="wins">Wins</SelectItem>
              <SelectItem value="losses">Losses</SelectItem>
              <SelectItem value="breakeven">Break Even</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="solid-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <Empty icon={List} title="No trades match your filters" description="Try clearing filters or adding a new trade."
            action={<Link to="/trades/new"><Button className="rounded-xl"><PlusCircle className="w-4 h-4 mr-2" /> Add a trade</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="trades-table">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-2">Market</th>
                  <th className="py-3 px-2">Side</th>
                  <th className="py-3 px-2 text-right">Qty</th>
                  <th className="py-3 px-2 text-right">Entry</th>
                  <th className="py-3 px-2 text-right">Exit</th>
                  <th className="py-3 px-2 text-right">P&L</th>
                  <th className="py-3 px-2 text-right">R</th>
                  <th className="py-3 px-2">Session</th>
                  <th className="py-3 px-2">Strategy</th>
                  <th className="py-3 px-2">Emotion</th>
                  <th className="py-3 px-2">Date</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-secondary/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-semibold">
                      <Link to={`/trades/${t.id}`} className="hover:text-primary" data-testid={`trade-row-${t.id}`}>{t.symbol}</Link>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground capitalize text-xs">{t.market_type}</td>
                    <td className="py-2.5 px-2">
                      <span className={cn('inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase',
                        t.side === 'long' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400')}>
                        {t.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular">{fmtNumber(t.quantity, 4)}</td>
                    <td className="py-2.5 px-2 text-right tabular">{fmtNumber(t.entry_price, 4)}</td>
                    <td className="py-2.5 px-2 text-right tabular">{t.exit_price ? fmtNumber(t.exit_price, 4) : '—'}</td>
                    <td className={cn('py-2.5 px-2 text-right font-semibold tabular', pnlClass(t.pnl))}>{fmtCurrency(t.pnl)}</td>
                    <td className="py-2.5 px-2 text-right tabular text-xs text-muted-foreground">{t.r_multiple !== null && t.r_multiple !== undefined ? fmtR(t.r_multiple) : '—'}</td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground capitalize">{(t.session || '').replace('_',' ') || '—'}</td>
                    <td className="py-2.5 px-2 text-xs">
                      {t.strategy_id ? <Badge variant="secondary" className="font-normal">{stratMap[t.strategy_id]?.name || 'Unknown'}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground capitalize">{t.emotion || '—'}</td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">{fmtDateTime(t.exit_time || t.entry_time)}</td>
                    <td className="py-2.5 px-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => onDelete(t.id)} data-testid={`delete-trade-${t.id}`}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
