import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

let _cache = null;
let _pending = null;

export function useFuturesContracts() {
  const [data, setData] = useState(_cache);
  useEffect(() => {
    if (_cache) { setData(_cache); return; }
    if (!_pending) _pending = api.get('/futures/contracts').then(r => { _cache = r.data; return r.data; });
    _pending.then(d => setData(d));
  }, []);
  return data || { contracts: [], sessions: [] };
}

export function useContractsBySymbol() {
  const data = useFuturesContracts();
  return useMemo(() => Object.fromEntries((data.contracts || []).map(c => [c.symbol, c])), [data]);
}
