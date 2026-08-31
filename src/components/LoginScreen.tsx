import { KeyRound, LockKeyhole, Mountain, ShieldCheck, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onAuthenticated: () => void;
}

const adminNames = ['Abhiram', 'Tiffany', 'Catherine', 'Corey'];
const technicianNames = ['Ethan', 'Eric'];

export function LoginScreen({ onAuthenticated }: Props) {
  const isTech = window.location.pathname.toLowerCase().startsWith('/tech');
  const names = useMemo(() => isTech ? technicianNames : adminNames, [isTech]);
  const [name, setName] = useState(names[0] || '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(pin)) {
      setError('Enter your 4-digit code.');
      return;
    }

    setBusy(true);

    const { data, error: invokeError } = await supabase.functions.invoke('pin-login', {
      body: {
        displayName: name,
        pin,
        portal: isTech ? 'technician' : 'admin'
      }
    });

    if (invokeError || !data?.tokenHash) {
      setBusy(false);
      setPin('');
      setError(data?.error || 'Incorrect name or 4-digit code.');
      return;
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: 'magiclink'
    });

    setBusy(false);
    setPin('');

    if (verifyError) {
      setError('Could not start your secure session. Please try again.');
      return;
    }

    onAuthenticated();
  }

  return (
    <main className="auth-shell pin-auth-shell">
      <section className="auth-card glass pin-auth-card">
        <div className="auth-brand">
          <Mountain size={25}/>
          <span>BLUE RIDGE<small>PRESERVATION MAINTENANCE</small></span>
        </div>

        <div className="auth-icon"><LockKeyhole size={24}/></div>
        <h1>{isTech ? 'Technician access' : 'Admin access'}</h1>
        <p>Select your name and enter your private 4-digit code.</p>

        <form onSubmit={submit}>
          <label>
            Your name
            <div className="auth-input-with-icon">
              <UserRound size={15}/>
              <select value={name} onChange={e => setName(e.target.value)}>
                {names.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
          </label>

          <label>
            4-digit code
            <div className="pin-entry-wrap">
              <KeyRound size={16}/>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                required
                autoFocus
                autoComplete="off"
                aria-label="4-digit access code"
              />
            </div>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button disabled={busy || pin.length !== 4}>
            {busy ? 'Verifying…' : 'Enter Operations'}
          </button>
        </form>

        <div className="auth-security">
          <ShieldCheck size={15}/>
          Secure PIN verification · role-based access
        </div>
      </section>
    </main>
  );
}
