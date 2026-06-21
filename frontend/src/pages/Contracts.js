import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useFuturesContracts } from '@/lib/futures';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ContractsPage() {
  const { contracts, sessions } = useFuturesContracts();
  const [q, setQ] = useState('');

  const filtered = (contracts || []).filter(c =>
    !q || c.symbol.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase()) || c.category.toLowerCase().includes(q.toLowerCase()),
  );
  const byCat = filtered.reduce((acc, c) => { (acc[c.category] = acc[c.category] || []).push(c); return acc; }, {});

  return (
    <div className="space-y-5" data-testid="contracts-page">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-primary" /> Contracts Reference
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Specifications for the most-traded futures contracts.</p>
      </div>

      <div className="glass-card p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input data-testid="contracts-search" placeholder="Search ES, Crude, Gold..." value={q} onChange={e => setQ(e.target.value)} className="pl-9 rounded-xl" />
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(byCat).map(([cat, list]) => (
          <section key={cat} className="glass-card p-5">
            <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Badge variant="secondary" className="font-normal">{cat}</Badge>
              <span className="text-xs text-muted-foreground">{list.length} contracts</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <th className="py-2.5 pr-3">Symbol</th>
                    <th className="py-2.5 pr-3">Name</th>
                    <th className="py-2.5 pr-3">Exchange</th>
                    <th className="py-2.5 pr-3 text-right">Point Value</th>
                    <th className="py-2.5 pr-3 text-right">Tick Size</th>
                    <th className="py-2.5 pr-3 text-right">Tick Value</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(c => (
                    <tr key={c.symbol} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 pr-3 font-mono font-semibold">{c.symbol}</td>
                      <td className="py-2.5 pr-3">{c.name}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs">{c.exchange}</td>
                      <td className="py-2.5 pr-3 text-right tabular">${c.point_value.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 text-right tabular font-mono">{c.tick_size}</td>
                      <td className="py-2.5 pr-3 text-right tabular">${c.tick_value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="glass-card p-5">
        <h2 className="font-display font-semibold mb-3">Trading Sessions (ET)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {(sessions || []).map(s => (
            <div key={s.id} className="p-3 rounded-xl bg-secondary/40">
              <p className="font-medium text-sm">{s.label}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.hours}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
