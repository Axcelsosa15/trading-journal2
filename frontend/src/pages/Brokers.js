import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plug, Trash2, RefreshCw, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const BROKERS = [
  {
    id: 'binance', name: 'Binance', desc: 'Crypto exchange (live API)',
    color: 'from-amber-400 to-yellow-500', envs: [['live', 'Live']],
    fields: [{ key: 'api_key', label: 'API Key', required: true }, { key: 'api_secret', label: 'API Secret', required: true, type: 'password' }],
  },
  {
    id: 'alpaca', name: 'Alpaca', desc: 'Stocks & crypto (US)',
    color: 'from-yellow-400 to-orange-500', envs: [['paper', 'Paper'], ['live', 'Live']],
    fields: [{ key: 'api_key', label: 'API Key ID', required: true }, { key: 'api_secret', label: 'API Secret', required: true, type: 'password' }],
  },
  {
    id: 'oanda', name: 'OANDA', desc: 'Forex & CFDs',
    color: 'from-rose-400 to-red-500', envs: [['practice', 'Practice'], ['live', 'Live']],
    fields: [{ key: 'api_key', label: 'Access Token', required: true, type: 'password' }, { key: 'account_id', label: 'Account ID', required: true }],
  },
];

export default function BrokersPage() {
  const [conns, setConns] = useState([]);
  const [openBroker, setOpenBroker] = useState(null);
  const [form, setForm] = useState({});
  const [syncing, setSyncing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await api.get('/brokers/connections');
    setConns(r.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!openBroker) return;
    setSaving(true);
    try {
      const payload = {
        broker: openBroker.id,
        label: form.label || openBroker.name,
        api_key: form.api_key || '',
        api_secret: form.api_secret || '',
        account_id: form.account_id || '',
        environment: form.environment || openBroker.envs[0][0],
      };
      await api.post('/brokers/connections', payload);
      toast.success(`${openBroker.name} connected`);
      setOpenBroker(null);
      setForm({});
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to connect');
    } finally { setSaving(false); }
  };

  const sync = async (conn) => {
    setSyncing(conn.id);
    try {
      const r = await api.post(`/brokers/connections/${conn.id}/sync`);
      toast.success(`Imported ${r.data.imported} new trades from ${conn.broker}`);
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.error : (detail || 'Sync failed');
      toast.error(msg);
      load();
    } finally { setSyncing(null); }
  };

  const del = async (conn) => {
    if (!confirm(`Disconnect ${conn.broker}?`)) return;
    await api.delete(`/brokers/connections/${conn.id}`);
    toast.success('Disconnected');
    load();
  };

  return (
    <div className="space-y-5" data-testid="brokers-page">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Brokers</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect your brokers to automatically import trades. Keys are encrypted at rest.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BROKERS.map(b => {
          const c = conns.find(x => x.broker === b.id);
          return (
            <div key={b.id} className="glass-card p-5" data-testid={`broker-card-${b.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-display font-semibold', b.color)}>
                    {b.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">{b.name}</h3>
                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
                {c ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <KeyRound className="w-3 h-3" /> Not connected
                  </span>
                )}
              </div>

              {c && (
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between"><span>Environment</span><span className="font-mono capitalize">{c.environment}</span></div>
                  <div className="flex items-center justify-between"><span>Last sync</span><span>{c.last_sync ? fmtDateTime(c.last_sync) : 'Never'}</span></div>
                  <div className="flex items-center justify-between"><span>Status</span>
                    <span className={cn(c.last_status === 'success' ? 'text-emerald-500' : c.last_status === 'error' ? 'text-rose-500' : 'text-muted-foreground')}>
                      {c.last_status || 'pending'}
                    </span>
                  </div>
                  {c.last_error && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] flex gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span className="break-all">{c.last_error}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {c ? (
                  <>
                    <Button data-testid={`broker-sync-${b.id}`} className="flex-1 rounded-xl" onClick={() => sync(c)} disabled={syncing === c.id}>
                      <RefreshCw className={cn('w-4 h-4 mr-2', syncing === c.id && 'animate-spin')} />
                      {syncing === c.id ? 'Syncing…' : 'Sync Now'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del(c)} data-testid={`broker-delete-${b.id}`}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                  </>
                ) : (
                  <Button data-testid={`broker-connect-${b.id}`} className="w-full rounded-xl" onClick={() => { setOpenBroker(b); setForm({ environment: b.envs[0][0] }); }}>
                    <Plug className="w-4 h-4 mr-2" /> Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!openBroker} onOpenChange={(o) => !o && setOpenBroker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Connect {openBroker?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {openBroker?.envs.length > 1 && (
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select value={form.environment} onValueChange={v => setForm(s => ({ ...s, environment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{openBroker.envs.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {openBroker?.fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}{f.required && ' *'}</Label>
                <Input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} data-testid={`broker-field-${f.key}`} />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-2">Read-only API permissions are sufficient. Keys are encrypted before storage.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenBroker(null)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} data-testid="broker-save-button">{saving ? 'Connecting…' : 'Save & Connect'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
