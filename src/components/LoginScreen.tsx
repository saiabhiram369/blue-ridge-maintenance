import { LockKeyhole, Mountain, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props { onAuthenticated: () => void; }

export function LoginScreen({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) setError(authError.message);
    else onAuthenticated();
  }

  return (
    <main className="auth-shell">
      <div className="auth-ambient ambient-one" /><div className="auth-ambient ambient-two" />
      <section className="auth-card glass">
        <div className="auth-brand"><Mountain size={25} /><span>BLUE RIDGE<small>FACILITIES</small></span></div>
        <div className="auth-icon"><LockKeyhole size={24} /></div>
        <h1>Operations access</h1>
        <p>Secure sign-in for facilities administrators and technicians.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          {error && <div className="auth-error">{error}</div>}
          <button disabled={busy}>{busy ? 'Signing in…' : 'Enter Operations'}</button>
        </form>
        <div className="auth-security"><ShieldCheck size={15} />Protected by Supabase Auth + row-level security</div>
      </section>
    </main>
  );
}
