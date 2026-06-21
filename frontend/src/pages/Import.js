import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileUp, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { fmtCurrency, fmtNumber, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await api.post('/import/csv/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not parse CSV');
    } finally { setLoading(false); }
  };

  const doImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/import/csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Imported ${r.data.inserted} trades`);
      navigate('/trades');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-5 max-w-5xl" data-testid="import-page">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Import CSV</h1>
        <p className="text-sm text-muted-foreground mt-1">Import trades from any broker. We auto-detect TradingView, MT4/MT5, IBKR, and generic formats.</p>
      </div>

      <div className="glass-card p-6">
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:bg-secondary/30 transition-colors">
          <input data-testid="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <FileUp className="w-8 h-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Click to upload CSV</p>
          <p className="text-xs text-muted-foreground mt-1">{file ? file.name : 'CSV up to 5MB'}</p>
        </label>
      </div>

      {loading && <div className="glass-card p-6 text-sm text-muted-foreground">Parsing…</div>}

      {preview && (
        <>
          <div className="glass-card p-5" data-testid="csv-preview-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-semibold">Preview</h2>
                <p className="text-xs text-muted-foreground">{preview.total_parsed} trades parsed • {Object.keys(preview.mapping).length} fields detected</p>
              </div>
              <Button data-testid="csv-import-confirm" onClick={doImport} disabled={importing || preview.total_parsed === 0}>
                <Upload className="w-4 h-4 mr-2" /> {importing ? 'Importing…' : `Import ${preview.total_parsed}`}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(preview.mapping).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 bg-secondary/40 px-2.5 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">{k}</span>
                  <span className="ml-auto font-mono text-foreground truncate">{v}</span>
                </div>
              ))}
            </div>

            {preview.errors.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                <div className="flex items-center gap-2 font-medium mb-1"><AlertCircle className="w-4 h-4" /> {preview.errors.length} errors</div>
                <ul className="list-disc list-inside">
                  {preview.errors.slice(0, 5).map((e) => <li key={`err-${e.row}`}>Row {e.row}: {e.error}</li>)}
                </ul>
              </div>
            )}
          </div>

          {preview.preview.length > 0 && (
            <div className="solid-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="csv-preview-table">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-2">Market</th>
                      <th className="py-3 px-2">Side</th>
                      <th className="py-3 px-2 text-right">Qty</th>
                      <th className="py-3 px-2 text-right">Entry</th>
                      <th className="py-3 px-2 text-right">Exit</th>
                      <th className="py-3 px-2 text-right">P&L</th>
                      <th className="py-3 px-2">Entry Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((t) => (
                      <tr key={t.id || `${t.symbol}-${t.entry_time}-${t.quantity}`} className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-semibold">{t.symbol}</td>
                        <td className="py-2.5 px-2 capitalize text-xs text-muted-foreground">{t.market_type}</td>
                        <td className="py-2.5 px-2 capitalize text-xs">{t.side}</td>
                        <td className="py-2.5 px-2 text-right tabular">{fmtNumber(t.quantity, 4)}</td>
                        <td className="py-2.5 px-2 text-right tabular">{fmtNumber(t.entry_price, 4)}</td>
                        <td className="py-2.5 px-2 text-right tabular">{t.exit_price ? fmtNumber(t.exit_price, 4) : '—'}</td>
                        <td className={cn('py-2.5 px-2 text-right font-semibold tabular', pnlClass(t.pnl))}>{fmtCurrency(t.pnl)}</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{t.entry_time?.slice(0,16)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="glass-card p-5">
        <h3 className="font-display font-semibold mb-2">Supported columns</h3>
        <p className="text-xs text-muted-foreground mb-3">Your CSV should have a header row. We auto-map these common columns:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
          {['symbol', 'side', 'quantity', 'entry_price', 'exit_price', 'entry_time', 'exit_time', 'fees', 'commission', 'pnl', 'stop_loss', 'take_profit', 'strategy', 'notes', 'market_type'].map(f => (
            <code key={f} className="px-2 py-1 bg-secondary rounded">{f}</code>
          ))}
        </div>
      </div>
    </div>
  );
}
