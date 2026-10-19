import Link from 'next/link';
import { useEffect, useState } from 'react';

// Shared page frame: sticky top bar, optional progress bar, and a live
// offline banner so participants know immediately when saving cannot work.
export default function Layout({ children, username, onLogout, progress, bar }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="brand">ஆய்வு · Study</Link>
          <div>
            {username && <span className="who">{username}</span>}
            {onLogout && <button className="btn secondary small" onClick={onLogout}>வெளியேறு / Log out</button>}
          </div>
        </div>
        {progress !== undefined && <div className="progress"><div style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}
      </header>
      {!online && (
        <div className="banner offline" role="status">
          இணைய இணைப்பு இல்லை. இணைப்பு வந்ததும் தொடரலாம் — உங்கள் பதிவு இழக்கப்படாது. /
          You are offline. Reconnect to continue; your current answer is kept on this page.
        </div>
      )}
      <main className="page">{children}</main>
      {bar}
    </>
  );
}

export function ActionBar({ children }) {
  return <div className="actionbar"><div className="actionbar-inner">{children}</div></div>;
}
