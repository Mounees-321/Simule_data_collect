import { useEffect, useRef, useState } from 'react';

// 5-second microphone test with a live level meter, shown before the interview.
export default function MicCheck() {
  const [state, setState] = useState('idle'); // idle | testing | ok | quiet | denied
  const [level, setLevel] = useState(0);
  const refs = useRef({});

  function cleanup() {
    const r = refs.current;
    cancelAnimationFrame(r.raf);
    clearTimeout(r.timer);
    if (r.stream) r.stream.getTracks().forEach((t) => t.stop());
    if (r.ctx) { try { r.ctx.close(); } catch {} }
    refs.current = {};
  }
  useEffect(() => cleanup, []);

  async function test() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setState('denied'); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let max = 0;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
      max = Math.max(max, peak);
      setLevel(Math.min(100, Math.round(peak * 1.6)));
      refs.current.raf = requestAnimationFrame(tick);
    };
    refs.current = { stream, ctx };
    setState('testing');
    tick();
    refs.current.timer = setTimeout(() => {
      cleanup();
      setLevel(0);
      setState(max > 8 ? 'ok' : 'quiet');
    }, 5000);
  }

  return (
    <div>
      <button className="btn secondary" onClick={test} disabled={state === 'testing'}>
        {state === 'testing' ? 'பேசுங்கள்… / Say something…' : '🎤 மைக்ரோஃபோனைச் சோதிக்க / Test microphone'}
      </button>
      {state === 'testing' && <div className="meter"><div style={{ width: `${level}%` }} /></div>}
      {state === 'ok' && <div className="alert ok" role="status">✓ மைக்ரோஃபோன் வேலை செய்கிறது. / Your microphone works.</div>}
      {state === 'quiet' && <div className="alert error" role="alert">ஒலி கேட்கவில்லை. மைக்ரோஃபோனை அருகில் வைத்து மீண்டும் சோதிக்கவும். / We could not hear you. Move closer to the microphone and test again.</div>}
      {state === 'denied' && <div className="alert error" role="alert">மைக்ரோஃபோன் அனுமதி தடுக்கப்பட்டுள்ளது. உலாவி அமைப்பில் அனுமதிக்கவும். / Microphone access is blocked. Allow it in your browser settings.</div>}
    </div>
  );
}
