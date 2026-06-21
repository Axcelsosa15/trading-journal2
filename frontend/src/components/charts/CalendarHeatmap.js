import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fmtCurrency, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

export default function CalendarHeatmap({ data = [], days = 120 }) {
  // build map of date -> entry
  const map = {};
  data.forEach(d => { map[d.date] = d; });

  // build last N days
  const today = new Date();
  today.setHours(0,0,0,0);
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, day: d, entry: map[key] });
  }

  // group into columns of 7 (weeks)
  const cols = [];
  let week = [];
  // first column padding to start week on Sun
  const firstDow = cells[0].day.getDay();
  for (let p = 0; p < firstDow; p++) week.push(null);
  cells.forEach((c) => {
    week.push(c);
    if (week.length === 7) { cols.push(week); week = []; }
  });
  if (week.length) { while (week.length < 7) week.push(null); cols.push(week); }

  const max = Math.max(1, ...data.map(d => Math.abs(d.pnl || 0)));

  const intensity = (pnl) => {
    const ratio = Math.min(1, Math.abs(pnl) / max);
    const steps = [0.10, 0.18, 0.28, 0.40, 0.55];
    return steps[Math.min(steps.length - 1, Math.floor(ratio * steps.length))];
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1" data-testid="calendar-heatmap">
        {/* month labels */}
        <div className="flex gap-1 pl-6 mb-1">
          {cols.map((wk, i) => {
            const first = wk.find(c => c);
            const showLabel = first && first.day.getDate() <= 7;
            const colKey = first ? `m-${first.date}` : `m-empty-${i}`;
            return (
              <div key={colKey} className="w-3 text-[9px] text-muted-foreground text-center">
                {showLabel ? monthLabel(first.day) : ''}
              </div>
            );
          })}
        </div>

        <div className="flex gap-1">
          {/* day labels */}
          <div className="flex flex-col gap-1 text-[9px] text-muted-foreground pr-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
              <div key={d} className="h-3 leading-3">{i % 2 === 1 ? d : ''}</div>
            ))}
          </div>
          {cols.map((wk, i) => {
            const first = wk.find(c => c);
            const wkKey = first ? `wk-${first.date}` : `wk-empty-${i}`;
            return (
            <div key={wkKey} className="flex flex-col gap-1">
              {wk.map((c, j) => {
                if (!c) return <div key={`pad-${wkKey}-${j}`} className="w-3 h-3" />;
                const e = c.entry;
                let bg = 'hsl(var(--muted)/0.5)';
                if (e) {
                  const a = intensity(e.pnl);
                  const color = e.pnl > 0 ? `hsl(152 55% 38% / ${a})` : (e.pnl < 0 ? `hsl(0 72% 52% / ${a})` : 'hsl(215 16% 40% / 0.10)');
                  bg = color;
                }
                return (
                  <Tooltip key={c.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn('w-3 h-3 rounded-[3px] cursor-pointer border border-border/30')}
                        style={{ backgroundColor: bg }}
                        data-testid={`heatmap-cell-${c.date}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="font-medium">{c.date}</div>
                      {e ? (
                        <>
                          <div>P&L: <span className={e.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{fmtCurrency(e.pnl)}</span></div>
                          <div className="text-muted-foreground">{e.trades} trades • {fmtPercent(e.win_rate, 0)} WR</div>
                        </>
                      ) : <div className="text-muted-foreground">No trades</div>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );})}
        </div>

        <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[0.10, 0.18, 0.28, 0.40, 0.55].map((a) => (
            <div key={`lgd-${a}`} className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: `hsl(152 55% 38% / ${a})` }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
