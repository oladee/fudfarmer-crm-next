'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAgents } from '@/hooks/use-queries';
import { Leaf, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { data: agents = [] } = useAgents();
  const router = useRouter();

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(selectedAgentId, password);
    setLoading(false);
    if (success) {
      router.replace('/');
    } else {
      setError('Invalid credentials. Please check your password and try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
              <Leaf className="text-primary-foreground" size={22} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">FudFarmer CRM</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground/80">Agent</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground/80">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary placeholder:text-muted-foreground/50"
              />
            </div>

            {error && (
              <p className="text-[13px] text-destructive font-medium bg-destructive/8 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-4 text-sm font-medium shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Sign In
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Default password: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground/80 font-mono text-[11px]">password</code>
          </p>
        </div>
      </div>
    </div>
  );
}
