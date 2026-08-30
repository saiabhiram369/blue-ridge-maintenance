import { LockKeyhole, Mail, Mountain, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onAuthenticated: () => void;
}

export function LoginScreen({ onAuthenticated }: Props) {
  const isTech = window.location.pathname.toLowerCase().startsWith('/tech');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    onAuthenticated();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card glass">
        <div className="auth-brand">
          <Mountain size={25}/>
          <span>BLUE RIDGE<small>PRESERVATION MAINTENANCE</small></span>
        </div>

        <div className="auth-icon"><LockKeyhole size={24}/></div>
        <h1>{isTech ? 'Technician access' : 'Admin access'}</h1>
        <p>Sign in with your authorized facilities account.</p>

        <form onSubmit={submit}>
          <label>
            Email
            <div className="auth-input-with-icon">
              <Mail size={15}/>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@artoflivingretreat.org"
              />
            </div>
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          <button disabled={busy}>{busy ? 'Signing in…' : 'Enter Operations'}</button>
        </form>

        <div className="auth-security">
          <ShieldCheck size={15}/>
          Supabase Auth + role-based database access
        </div>
      </section>
    </main>
  );
}
