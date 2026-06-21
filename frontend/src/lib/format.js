export const fmtCurrency = (v, opts = {}) => {
  if (v === null || v === undefined || isNaN(v)) return '$0.00';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, ...opts })}`;
};

export const fmtPercent = (v, decimals = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '0%';
  return `${Number(v).toFixed(decimals)}%`;
};

export const fmtNumber = (v, decimals = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '0';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const fmtR = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}R`;
};

export const pnlClass = (v) => {
  const n = Number(v) || 0;
  if (n > 0) return 'text-pnl-pos';
  if (n < 0) return 'text-pnl-neg';
  return 'text-pnl-neutral';
};

export const fmtDate = (v) => {
  if (!v) return '—';
  try {
    const d = new Date(v);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
};

export const fmtDateTime = (v) => {
  if (!v) return '—';
  try {
    const d = new Date(v);
    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};
