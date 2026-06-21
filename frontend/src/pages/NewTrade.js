import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, ImagePlus, X } from 'lucide-react';
import { useNavigate as useN } from 'react-router-dom';

const EMOTIONS = ['calm', 'confident', 'neutral', 'fomo', 'anxious', 'revenge', 'greedy', 'fearful'];

export default function NewTradePage() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    market_type: 'stocks', symbol: '', side: 'long',
    quantity: '', entry_price: '', exit_price: '', stop_loss: '', take_profit: '',
    fees: '0', commission: '0',
    entry_time: new Date().toISOString().slice(0,16),
    exit_time: new Date().toISOString().slice(0,16),
    status: 'closed', strategy_id: '', emotion: '', rating: '', notes: '', mistakes: '', lessons: '',
    attachments: [],
  });

  useEffect(() => { api.get('/strategies').then(r => setStrategies(r.data)); }, []);

  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const handleFile = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setForm(s => ({
          ...s,
          attachments: [...s.attachments, { id: crypto.randomUUID(), name: file.name, data_url: reader.result, uploaded_at: new Date().toISOString() }],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.symbol) { toast.error('Symbol is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity) || 0,
        entry_price: parseFloat(form.entry_price) || 0,
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
        fees: parseFloat(form.fees) || 0,
        commission: parseFloat(form.commission) || 0,
        rating: form.rating ? parseInt(form.rating) : null,
        strategy_id: form.strategy_id || null,
        emotion: form.emotion || null,
        entry_time: form.entry_time ? new Date(form.entry_time).toISOString() : null,
        exit_time: form.exit_time ? new Date(form.exit_time).toISOString() : null,
      };
      await api.post('/trades', payload);
      toast.success('Trade saved');
      navigate('/trades');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl" data-testid="new-trade-page">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h1 className="text-3xl font-display font-semibold tracking-tight">New Trade</h1>
          <p className="text-sm text-muted-foreground">Log a trade with full detail.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <section className="glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Basics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Symbol *">
              <Input data-testid="new-trade-symbol" value={form.symbol} onChange={e => upd('symbol', e.target.value.toUpperCase())} placeholder="AAPL, BTCUSDT, EURUSD…" />
            </Field>
            <Field label="Market">
              <Select value={form.market_type} onValueChange={v => upd('market_type', v)}>
                <SelectTrigger data-testid="new-trade-market"><SelectValue /></SelectTrigger>
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
                <SelectTrigger data-testid="new-trade-side"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => upd('status', v)}>
                <SelectTrigger data-testid="new-trade-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quantity">
              <Input data-testid="new-trade-qty" type="number" step="any" value={form.quantity} onChange={e => upd('quantity', e.target.value)} />
            </Field>
            <Field label="Strategy">
              <Select value={form.strategy_id || 'none'} onValueChange={v => upd('strategy_id', v === 'none' ? '' : v)}>
                <SelectTrigger data-testid="new-trade-strategy"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Prices & Risk</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Entry Price"><Input data-testid="new-trade-entry" type="number" step="any" value={form.entry_price} onChange={e => upd('entry_price', e.target.value)} /></Field>
            <Field label="Exit Price"><Input data-testid="new-trade-exit" type="number" step="any" value={form.exit_price} onChange={e => upd('exit_price', e.target.value)} /></Field>
            <Field label="Stop Loss"><Input type="number" step="any" value={form.stop_loss} onChange={e => upd('stop_loss', e.target.value)} /></Field>
            <Field label="Take Profit"><Input type="number" step="any" value={form.take_profit} onChange={e => upd('take_profit', e.target.value)} /></Field>
            <Field label="Fees"><Input type="number" step="any" value={form.fees} onChange={e => upd('fees', e.target.value)} /></Field>
            <Field label="Commission"><Input type="number" step="any" value={form.commission} onChange={e => upd('commission', e.target.value)} /></Field>
            <Field label="Entry Time"><Input type="datetime-local" value={form.entry_time} onChange={e => upd('entry_time', e.target.value)} /></Field>
            <Field label="Exit Time"><Input type="datetime-local" value={form.exit_time} onChange={e => upd('exit_time', e.target.value)} /></Field>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Journal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Emotion">
              <Select value={form.emotion || 'none'} onValueChange={v => upd('emotion', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {EMOTIONS.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rating (1-5)">
              <Input type="number" min="1" max="5" value={form.rating} onChange={e => upd('rating', e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 space-y-4">
            <Field label="Notes"><Textarea data-testid="new-trade-notes" rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="What happened? Why did you enter?" /></Field>
            <Field label="Mistakes"><Textarea rows={2} value={form.mistakes} onChange={e => upd('mistakes', e.target.value)} placeholder="What did you do wrong?" /></Field>
            <Field label="Lessons"><Textarea rows={2} value={form.lessons} onChange={e => upd('lessons', e.target.value)} placeholder="What will you do differently?" /></Field>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-display font-semibold mb-4">Screenshots</h2>
          <label className="flex items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary/30 transition-colors" data-testid="new-trade-attach-label">
            <input data-testid="new-trade-attach" type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
            <div className="text-center">
              <ImagePlus className="w-6 h-6 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-1">Click to upload chart screenshots</p>
            </div>
          </label>
          {form.attachments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {form.attachments.map(a => (
                <div key={a.id} className="relative group">
                  <img src={a.data_url} alt={a.name} className="w-full h-24 object-cover rounded-lg border border-border" />
                  <button type="button" onClick={() => upd('attachments', form.attachments.filter(x => x.id !== a.id))} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 pb-8">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving} data-testid="new-trade-save" className="rounded-xl">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save Trade'}
          </Button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);
