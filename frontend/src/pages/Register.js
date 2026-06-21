import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ActivitySquare, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success('Account created');
      nav('/');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid opacity-40" />
      <div className="bg-orb -z-10" style={{ top: '-100px', right: '15%', background: 'radial-gradient(circle, hsl(var(--accent)/0.40), transparent)' }} />
      <div className="bg-orb -z-10" style={{ bottom: '-100px', left: '15%', background: 'radial-gradient(circle, hsl(var(--primary)/0.45), transparent)' }} />

      <div className="glass-card w-full max-w-md p-8 sm:p-10" data-testid="register-card">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <ActivitySquare className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <p className="font-display text-xl font-semibold">Edge<span className="text-primary">Futures</span></p>
            <p className="text-xs text-muted-foreground">Trade futures smarter. Journal everything.</p>
          </div>
        </div>

        <h1 className="text-3xl font-display font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start journaling your futures trades in seconds.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input data-testid="register-name" id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input data-testid="register-email" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input data-testid="register-password" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} />
          </div>
          <Button data-testid="register-submit" type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
            {loading ? 'Creating…' : (<><span>Create Account</span><ArrowRight className="w-4 h-4 ml-2" /></>)}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Already have an account?{' '}
          <Link data-testid="go-login" to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
