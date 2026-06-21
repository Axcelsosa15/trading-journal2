import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ActivitySquare, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('demo@trading.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      nav('/');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid opacity-40" />
      <div className="bg-orb -z-10" style={{ top: '-100px', left: '20%', background: 'radial-gradient(circle, hsl(var(--primary)/0.45), transparent)' }} />
      <div className="bg-orb -z-10" style={{ bottom: '-100px', right: '15%', background: 'radial-gradient(circle, hsl(var(--accent)/0.40), transparent)' }} />

      <div className="glass-card w-full max-w-md p-8 sm:p-10" data-testid="login-card">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <ActivitySquare className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <p className="font-display text-xl font-semibold">Edge<span className="text-primary">Futures</span></p>
            <p className="text-xs text-muted-foreground">Trade futures smarter. Journal everything.</p>
          </div>
        </div>

        <h1 className="text-3xl font-display font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your futures journal.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input data-testid="login-email" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input data-testid="login-password" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button data-testid="login-submit" type="submit" className="w-full h-11 rounded-xl text-sm font-medium" disabled={loading}>
            {loading ? 'Signing in…' : (<><span>Sign In</span><ArrowRight className="w-4 h-4 ml-2" /></>)}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Don&apos;t have an account?{' '}
          <Link data-testid="go-register" to="/register" className="text-primary hover:underline font-medium">Create one</Link>
        </p>

        <div className="mt-6 pt-5 border-t border-border/60 text-[11px] text-muted-foreground text-center">
          Demo: <span className="font-mono">demo@trading.com / demo123</span>
        </div>
      </div>
    </div>
  );
}
