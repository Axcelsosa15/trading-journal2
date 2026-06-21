import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { User, Moon, Sun, LogOut, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  return (
    <div className="space-y-5 max-w-3xl" data-testid="settings-page">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="glass-card p-5">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-display text-xl font-semibold">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">{theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Dark Mode</Label>
            <p className="text-xs text-muted-foreground">Toggle between light and dark themes.</p>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={toggle} data-testid="settings-theme-toggle" />
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Security</h2>
        <p className="text-xs text-muted-foreground mb-3">Your broker API keys are encrypted at rest using Fernet (AES-128).</p>
        <Button variant="destructive" onClick={() => { logout(); navigate('/login'); }} data-testid="settings-logout">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
    </div>
  );
}
