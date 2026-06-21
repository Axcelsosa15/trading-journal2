import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, ImagePlus, X } from 'lucide-react';
import { fmtCurrency, fmtR, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

const EMOTIONS = ['calm', 'confident', 'neutral', 'fomo', 'anxious', 'revenge', 'greedy', 'fearful'];

export default function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trade, setTrade] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, s] = await Promise.all([api.get(`/trades/${id}`), api.get('/strategies')]);
        setTrade(t.data);
        setStrategies(s.data);
        setForm({
          ...t.data,
          entry_time: t.data.entry_time ? new Date(t.data.entry_time).toISOString().slice(0,16) : '',
          exit_time: t.data.exit_time ? new Date(t.data.exit_time).toISOString().slice(0,16) : '',
        });
      } catch {
        toast.error('Trade not found');
        navigate('/trades');
      }
    })();
  }, [id, navigate]);

  if (!trade || !form) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;

  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const handleFile = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setForm(s => ({ ...s, attachments: [...(s.attachments || []), { id: crypto.randomUUID(), name: file.name, data_url: reader.result, uploaded_at: new Date().toISOString() }] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity) || 0,
        entry_price: parseFloat(form.entry_price) || 0,
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
        point_value: form.point_value ? parseFloat(form.point_value) : null,
        tick_size: form.tick_size ? parseFloat(form.tick_size) : null,
        session: form.session || null,
        fees: parseFloat(form.fees) || 0,
        commission: parseFloat(form.commission) || 0,
        rating: form.rating ? parseInt(form.rating) : null,
        emotion: form.emotion || null,
        strategy_id: form.strategy_id || null,
        entry_time: form.entry_time ? new Date(form.entry_time).toISOString() : null,
        exit_time: form.exit_time ? new Date(form.exit_time).toISOString() : null,
      };
      const r = await api.patch(`/trades/${id}`, payload);
      setTrade(r.data);
      toast.success('Saved');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm('Delete this trade?')) return;
    await api.delete(`/trades/${id}`);
    toast.success('Deleted');
    navigate('/trades');
  };

  return (
    <div className="space-y-5" data-testid="trade-detail-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-display font-semibold tracking-tight font-mono">{trade.symbol}</h1>
            <Badge variant="secondary" className="capitalize">{trade.market_type}</Badge>
            <Badge className={cn('uppercase', trade.side === 'long' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20')}>{trade.side}</Badge>
            <div className="flex items-baseline gap-3">
              <span className={cn('text-2xl font-display font-semibold tabular', pnlClass(trade.pnl))}>{fmtCurrency(trade.pnl)}</span>
              {trade.r_multiple !== null && trade.r_multiple !== undefined && <span className={cn('text-sm tabular', pnlClass(trade.r_multiple))}>{fmtR(trade.r_multiple)}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={del} data-testid="trade-detail-delete"><Trash2 className="w-4 h-4 mr-2 text-rose-500" /> Delete</Button>
            <Button onClick={save} disabled={saving} data-testid="trade-detail-save"><Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Trade Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol"><Input value={form.symbol} onChange={e => upd('symbol', e.target.value.toUpperCase())} /></Field>
            <Field label="Market">
              <Select value={form.market_type} onValueChange={v => upd('market_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stocks">Stocks</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="futures">Futures</SelectItem>
                  <SelectItem value="options">Options</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Side">
              <Select value={form.side} onValueChange={v => upd('side', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="long">Long</SelectItem><SelectItem value="short">Short</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => upd('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="closed">Closed</SelectItem><SelectItem value="open">Open</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Quantity"><Input type="number" step="any" value={form.quantity ?? ''} onChange={e => upd('quantity', e.target.value)} /></Field>
            <Field label="Session">
              <Select value={form.session || 'none'} onValueChange={v => upd('session', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="asia">Asia</SelectItem>
                  <SelectItem value="london">London</SelectItem>
                  <SelectItem value="ny_am">NY AM</SelectItem>
                  <SelectItem value="ny_pm">NY PM</SelectItem>
                  <SelectItem value="rth">RTH</SelectItem>
                  <SelectItem value="globex">Globex</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Point Value"><Input type="number" step="any" value={form.point_value ?? ''} onChange={e => upd('point_value', e.target.value)} placeholder="ES=50, NQ=20" /></Field>
            <Field label="Tick Size"><Input type="number" step="any" value={form.tick_size ?? ''} onChange={e => upd('tick_size', e.target.value)} /></Field>
            <Field label="Strategy">
              <Select value={form.strategy_id || 'none'} onValueChange={v => upd('strategy_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Entry Price"><Input type="number" step="any" value={form.entry_price ?? ''} onChange={e => upd('entry_price', e.target.value)} /></Field>
            <Field label="Exit Price"><Input type="number" step="any" value={form.exit_price ?? ''} onChange={e => upd('exit_price', e.target.value)} /></Field>
            <Field label="Stop Loss"><Input type="number" step="any" value={form.stop_loss ?? ''} onChange={e => upd('stop_loss', e.target.value)} /></Field>
            <Field label="Take Profit"><Input type="number" step="any" value={form.take_profit ?? ''} onChange={e => upd('take_profit', e.target.value)} /></Field>
            <Field label="Fees"><Input type="number" step="any" value={form.fees ?? ''} onChange={e => upd('fees', e.target.value)} /></Field>
            <Field label="Commission"><Input type="number" step="any" value={form.commission ?? ''} onChange={e => upd('commission', e.target.value)} /></Field>
            <Field label="Entry Time"><Input type="datetime-local" value={form.entry_time || ''} onChange={e => upd('entry_time', e.target.value)} /></Field>
            <Field label="Exit Time"><Input type="datetime-local" value={form.exit_time || ''} onChange={e => upd('exit_time', e.target.value)} /></Field>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Journal</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Emotion">
              <Select value={form.emotion || 'none'} onValueChange={v => upd('emotion', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{EMOTIONS.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Rating"><Input type="number" min="1" max="5" value={form.rating ?? ''} onChange={e => upd('rating', e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={3} value={form.notes || ''} onChange={e => upd('notes', e.target.value)} /></Field>
          <div className="mt-3"><Field label="Mistakes"><Textarea rows={2} value={form.mistakes || ''} onChange={e => upd('mistakes', e.target.value)} /></Field></div>
          <div className="mt-3"><Field label="Lessons"><Textarea rows={2} value={form.lessons || ''} onChange={e => upd('lessons', e.target.value)} /></Field></div>

          <div className="mt-5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Screenshots</Label>
            <label className="mt-1.5 flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary/30 transition-colors">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFile} data-testid="trade-detail-attach" />
              <div className="text-center text-xs text-muted-foreground"><ImagePlus className="w-5 h-5 mx-auto" /> Add screenshots</div>
            </label>
            {(form.attachments || []).length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                {form.attachments.map(a => (
                  <Dialog key={a.id}>
                    <DialogTrigger asChild>
                      <div className="relative group cursor-pointer">
                        <img src={a.data_url} alt={a.name} className="w-full h-20 object-cover rounded-lg border border-border" />
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); upd('attachments', form.attachments.filter(x => x.id !== a.id)); }} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3 mx-auto" />
                        </button>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <img src={a.data_url} alt={a.name} className="w-full rounded-lg" />
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);
