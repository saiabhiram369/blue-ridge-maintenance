import { LockKeyhole, Mountain, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Profile } from '../types';

interface Props { onAuthenticated: () => void; }

const admins = {
  Abhiram: { pin:'8118', email:'abhiram@artoflivingretreat.org' },
  Tiffany: { pin:'1914', email:'tiffany@artoflivingretreat.org' },
  Catherine: { pin:'8799', email:'catherine@artoflivingretreat.org' },
  Corey: { pin:'2004', email:'corey@artoflivingretreat.org' }
} as const;

const technicians = {
  Ethan: { pin:'1234', email:'ethan@blueridge.local' },
  Eric: { pin:'5678', email:'eric@blueridge.local' }
} as const;

export function LoginScreen({ onAuthenticated }: Props) {
  const isTech = window.location.pathname.toLowerCase().startsWith('/tech');
  const users = useMemo(() => isTech ? technicians : admins, [isTech]);
  const names = Object.keys(users);
  const [name, setName] = useState(names[0] || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const record = users[name as keyof typeof users] as { pin:string; email:string } | undefined;
    if (!record || record.pin !== pin) {
      setError('Incorrect name or PIN.');
      return;
    }

    const profile: Profile = {
      id: `legacy-${name.toLowerCase()}`,
      email: record.email,
      full_name: isTech ? name : `${name} Walsh`.replace('Abhiram Walsh','Abhiram').replace('Catherine Walsh','Catherine').replace('Corey Walsh','Corey'),
      role: isTech ? 'technician' : 'admin',
      can_resolve: !isTech && name === 'Tiffany'
    };

    localStorage.setItem('br_legacy_profile', JSON.stringify(profile));
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
        <p>Use your existing Blue Ridge name and PIN.</p>

        <form onSubmit={submit}>
          <label>
            Name
            <select value={name} onChange={e => setName(e.target.value)}>
              {names.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label>
            4-digit PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          <button>Enter Operations</button>
        </form>

        <div className="auth-security">
          <ShieldCheck size={15}/>
          Authorized facilities staff only
        </div>
      </section>
    </main>
  );
}
