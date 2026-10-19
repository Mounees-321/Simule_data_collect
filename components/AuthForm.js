import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from './Layout';
import { logIn, signUp } from '../lib/auth';

const USERNAME_OK = /^[a-zA-Z0-9_.-]{3,30}$/;

export default function AuthForm({ mode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (isSignup && !USERNAME_OK.test(username.trim())) {
      setError('பயனர்பெயரில் ஆங்கில எழுத்துகள், எண்கள், _ . - மட்டும் (3–30). இடைவெளி கூடாது. / Username: 3–30 English letters, numbers, _ . - only, no spaces.');
      return;
    }
    if (isSignup && password.length < 6) {
      setError('கடவுச்சொல் குறைந்தது 6 எழுத்துகள். / Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const { error: err } = isSignup ? await signUp(username.trim(), password) : await logIn(username.trim(), password);
    setBusy(false);
    if (err) {
      setError(isSignup
        ? (err.message || 'பதிவு தோல்வி. / Sign-up failed.') + ' (பயனர்பெயர் ஏற்கனவே இருக்கலாம் / the username may already be taken)'
        : 'பயனர்பெயர் அல்லது கடவுச்சொல் தவறு. / Incorrect username or password.');
      return;
    }
    router.push(isSignup ? '/consent' : '/dashboard');
  }

  return (
    <Layout>
      <h1>{isSignup ? 'கணக்கு உருவாக்கு' : 'உள்நுழைவு'}</h1>
      <p className="lead">
        {isSignup
          ? 'Create an account. You can log back in with it to continue the study at any time.'
          : 'Log in to continue where you left off.'}
      </p>
      <form className="card" onSubmit={submit} noValidate>
        <div className="field-group">
          <label htmlFor="u">பயனர்பெயர் / Username</label>
          <input id="u" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          {isSignup && <p className="status-text">ஆங்கில எழுத்துகள் / எண்கள் மட்டும் · English letters and numbers only (e.g. raja_23)</p>}
        </div>
        <div className="field-group">
          <label htmlFor="p">கடவுச்சொல் / Password</label>
          <div className="pw">
            <input id="p" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'} />
            <button type="button" onClick={() => setShow((v) => !v)}>{show ? 'மறை / Hide' : 'காட்டு / Show'}</button>
          </div>
          {isSignup && <p className="status-text">இதை நினைவில் வைத்திருங்கள் — மீட்டமைக்க முடியாது. / Remember it: it cannot be reset.</p>}
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="btn block" type="submit" disabled={busy || !username || !password}>
          {busy ? 'காத்திருங்கள்… / Please wait…' : isSignup ? 'கணக்கு உருவாக்கு / Sign up' : 'உள்நுழை / Log in'}
        </button>
      </form>
      <p className="status-text">
        {isSignup ? 'ஏற்கனவே கணக்கு உள்ளதா? ' : 'கணக்கு இல்லையா? '}
        <Link href={isSignup ? '/login' : '/signup'}>{isSignup ? 'உள்நுழை / Log in' : 'கணக்கு உருவாக்கு / Sign up'}</Link>
      </p>
    </Layout>
  );
}
