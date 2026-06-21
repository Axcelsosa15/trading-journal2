import { cn } from '@/lib/utils';

export const KpiCard = ({ label, value, sublabel, icon: Icon, accent, testid }) => {
  return (
    <div className="glass-card p-4 sm:p-5 group hover:shadow-lg transition-shadow" data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        {Icon && (
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center bg-secondary/70')}>
            <Icon className={cn('w-3.5 h-3.5', accent || 'text-muted-foreground')} />
          </div>
        )}
      </div>
      <div className={cn('text-2xl sm:text-3xl font-display font-semibold tabular', accent)}>{value}</div>
      {sublabel && <p className="text-xs text-muted-foreground mt-1.5">{sublabel}</p>}
    </div>
  );
};
