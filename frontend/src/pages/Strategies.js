import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Target } from 'lucide-react';
import { Empty } from '@/components/common/Empty';

export default function StrategiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6' });

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/strategies'); setItems(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    await api.post('/strategies', form);
    setForm({ name: '', description: '', color: '#3b82f6' });
    toast.success('Strategy created');
    load();
  };

  const del = async (id) => {
    if (!confirm('Delete this strategy?')) return;
    await api.delete(`/strategies/${id}`);
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-5" data-testid="strategies-page">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Strategies & Setups</h1>
        <p className="text-sm text-muted-foreground mt-1">Organize your trading playbook.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form onSubmit={create} className="glass-card p-5 space-y-3">
          <h2 className="font-display font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> New Strategy</h2>
          <div className="space-y-1.5"><Label>Name</Label><Input data-testid="strategy-name" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} placeholder="Breakout, Reversal, Scalping…" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} placeholder="Entry rules, conditions, exit criteria…" /></div>
          <div className="space-y-1.5"><Label>Color</Label><Input type="color" value={form.color} onChange={e => setForm(s => ({ ...s, color: e.target.value }))} className="h-10 w-20" /></div>
          <Button type="submit" data-testid="strategy-create-button" className="w-full rounded-xl">Create</Button>
        </form>

        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Your Strategies</h2>
          {loading ? <div className="text-sm text-muted-foreground">Loading…</div> :
            items.length === 0 ? <Empty icon={Target} title="No strategies yet" description="Create your first strategy to start tagging trades." /> : (
            <ul className="divide-y divide-border/40">
              {items.map(s => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del(s.id)} data-testid={`delete-strategy-${s.id}`}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
