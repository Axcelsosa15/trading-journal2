import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/common/Empty';
import { toast } from 'sonner';
import { Sparkles, Zap, AlertTriangle, Target, TrendingUp, Calendar as CalIcon, Trash2 } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRESETS = [
  { id: 'general', label: 'General Analysis', icon: Sparkles, color: 'text-primary' },
  { id: 'mistakes', label: 'Find Mistakes', icon: AlertTriangle, color: 'text-rose-500' },
  { id: 'best_setups', label: 'Best Setups', icon: TrendingUp, color: 'text-emerald-500' },
  { id: 'risk', label: 'Risk Review', icon: Target, color: 'text-amber-500' },
  { id: 'weekly', label: 'Weekly Recap', icon: CalIcon, color: 'text-accent' },
];

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [custom, setCustom] = useState('');

  const load = async () => {
    const r = await api.get('/ai/insights');
    setInsights(r.data);
    if (r.data.length && !selected) setSelected(r.data[0]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const run = async (preset, customPrompt) => {
    setRunning(true);
    try {
      const r = await api.post('/ai/insights', {
        prompt_preset: preset || null,
        custom_prompt: customPrompt || null,
      });
      toast.success('Insight generated');
      setSelected(r.data);
      setCustom('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Generation failed');
    } finally { setRunning(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this insight?')) return;
    await api.delete(`/ai/insights/${id}`);
    setSelected(null);
    load();
  };

  const r = selected?.response || {};

  return (
    <div className="space-y-5" data-testid="insights-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight flex items-center gap-2">
            AI Insights <Sparkles className="w-6 h-6 text-accent" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Powered by Claude. Actionable coaching from your trade data.</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="font-display font-semibold mb-3">Run Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PRESETS.map(p => (
            <Button key={p.id} variant="secondary" disabled={running} onClick={() => run(p.id)} className="justify-start rounded-xl" data-testid={`insight-preset-${p.id}`}>
              <p.icon className={cn('w-4 h-4 mr-2', p.color)} /> <span className="text-xs">{p.label}</span>
            </Button>
          ))}
        </div>
        <div className="mt-4">
          <Textarea data-testid="insight-custom-prompt" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Or write a custom question, e.g.: How can I reduce my drawdown?" rows={2} className="resize-none" />
          <div className="flex justify-end mt-2">
            <Button onClick={() => run(null, custom)} disabled={running || !custom.trim()} data-testid="insight-custom-run">
              <Zap className="w-4 h-4 mr-2" /> {running ? 'Analyzing…' : 'Run Custom Analysis'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 glass-card p-4 max-h-[600px] overflow-auto">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">History</h3>
          {insights.length === 0 ? (
            <p className="text-xs text-muted-foreground">No insights yet. Run your first analysis.</p>
          ) : (
            <ul className="space-y-2">
              {insights.map(i => (
                <li key={i.id}>
                  <button onClick={() => setSelected(i)} className={cn('w-full text-left p-2.5 rounded-lg transition-colors', selected?.id === i.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50')} data-testid={`insight-item-${i.id}`}>
                    <p className="text-xs font-medium capitalize">{i.prompt_preset || 'Custom'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(i.created_at)}</p>
                    <p className="text-[10px] text-muted-foreground">{i.trades_analyzed} trades</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="lg:col-span-9 glass-card p-5 min-h-[400px]">
          {!selected ? (
            <Empty icon={Sparkles} title="No insight selected" description="Run an analysis from the buttons above to receive AI coaching." />
          ) : (
            <div className="space-y-5" data-testid="insight-detail">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold capitalize">{selected.prompt_preset || 'Custom Analysis'}</h2>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(selected.created_at)} • {selected.trades_analyzed} trades analyzed</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => del(selected.id)} data-testid="insight-delete"><Trash2 className="w-4 h-4 text-rose-500" /></Button>
              </div>

              {r.summary && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm leading-relaxed">{r.summary}</p>
                </div>
              )}

              <Block title="Strengths" items={r.strengths} accent="emerald" icon={TrendingUp} />
              <Block title="Weaknesses" items={r.weaknesses} accent="rose" icon={AlertTriangle} />
              <Block title="Patterns" items={r.patterns} accent="blue" icon={Sparkles} />
              <Block title="Recommendations" items={r.recommendations} accent="amber" icon={Target} />

              {r.risk_assessment && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <h3 className="font-display font-semibold text-sm mb-1">Risk Assessment</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.risk_assessment}</p>
                </div>
              )}

              {r.next_actions && r.next_actions.length > 0 && (
                <div>
                  <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Next Actions</h3>
                  <ol className="space-y-1.5 list-decimal list-inside text-sm text-muted-foreground">
                    {r.next_actions.map((a, i) => <li key={i} className="leading-relaxed">{a}</li>)}
                  </ol>
                </div>
              )}

              {r._raw && (
                <div className="p-3 rounded-xl bg-muted text-xs text-muted-foreground whitespace-pre-wrap">
                  {r.summary}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const Block = ({ title, items, accent = 'blue', icon: Icon }) => {
  if (!items || items.length === 0) return null;
  const colors = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/20',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-500/5 border-rose-500/20',
    blue: 'text-primary bg-primary/5 border-primary/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/20',
  };
  return (
    <div className={cn('p-4 rounded-xl border', colors[accent])}>
      <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" />} {title}
      </h3>
      <ul className="space-y-1.5 list-disc list-inside text-sm text-foreground/80">
        {items.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
      </ul>
    </div>
  );
};
