import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, List, PlusCircle, Tag as TagIcon, Plug, FileUp,
  Sparkles, Settings, LogOut, Sun, Moon, ActivitySquare, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
  { to: '/trades', label: 'Trades', icon: List, testid: 'nav-trades' },
  { to: '/trades/new', label: 'New Trade', icon: PlusCircle, testid: 'nav-new-trade' },
  { to: '/strategies', label: 'Strategies', icon: TagIcon, testid: 'nav-strategies' },
  { to: '/contracts', label: 'Contracts', icon: BookOpen, testid: 'nav-contracts' },
  { to: '/brokers', label: 'Brokers', icon: Plug, testid: 'nav-brokers' },
  { to: '/import', label: 'Import CSV', icon: FileUp, testid: 'nav-import' },
  { to: '/insights', label: 'AI Insights', icon: Sparkles, testid: 'nav-insights' },
  { to: '/settings', label: 'Settings', icon: Settings, testid: 'nav-settings' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Decorative orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb" style={{ top: '-200px', left: '-150px', background: 'radial-gradient(circle, hsl(var(--primary)/0.35), transparent)' }} />
        <div className="bg-orb" style={{ bottom: '-180px', right: '-120px', background: 'radial-gradient(circle, hsl(var(--accent)/0.30), transparent)' }} />
        <div className="absolute inset-0 bg-grid opacity-30" />
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/60 bg-card/40 backdrop-blur-xl" data-testid="app-sidebar">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <ActivitySquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display text-base font-semibold leading-none">Edge<span className="text-primary">Futures</span></p>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-0.5">Trading Journal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 mt-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              data-testid={n.testid}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                'transition-colors duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-semibold">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{user?.name || 'Trader'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button data-testid="theme-toggle-button" variant="ghost" size="sm" className="flex-1" onClick={toggle}>
              {theme === 'dark' ? <Sun className="w-4 h-4 mr-1" /> : <Moon className="w-4 h-4 mr-1" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            <Button data-testid="logout-button" variant="ghost" size="sm" className="flex-1" onClick={() => { logout(); navigate('/login'); }}>
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 px-4 py-3 bg-card/70 backdrop-blur-xl border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <ActivitySquare className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold">EdgeFutures</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="mobile-theme-toggle">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }} data-testid="mobile-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:ml-0 mt-14 md:mt-0">
        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1500px]">
          <Outlet />
        </div>
        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/60 flex justify-around py-2">
          {nav.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px]', isActive ? 'text-primary' : 'text-muted-foreground')}>
              <n.icon className="w-4 h-4" />
              {n.label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </main>
    </div>
  );
}
