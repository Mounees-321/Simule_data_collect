import { useEffect, useRef, useState } from 'react';

// Recorder with a live level meter, a time bar (minimum marked), a minimum and
// maximum answer length, playback and re-record.
// onRecorded(null, 0)  -> a new take has started
// onRecorded(blob, s)  -> a take finished (s = seconds)
export default function AudioRecorder({ onRecorded, disabled, minSeconds = 15, maxSeconds = 60 }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [hitMax, setHitMax] = useState(false);
  const recRef = useRef(null), chunksRef = useRef([]), timerRef = useRef(null), startRef = useRef(0);
  const ctxRef = useRef(null), rafRef = useRef(null), lockRef = useRef(null), mounted = useRef(true);

  function stopMeter() {
    cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
    setLevel(0);
  }
  function startMeter(stream) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
        setLevel(Math.min(100, Math.round(peak * 1.6)));
        rafRef.current = requestAnimationFrame(tick);
      };
      ctxRef.current = ctx;
      tick();
    } catch {}
  }
  async function releaseLock() { try { await lockRef.current?.release(); } catch {} lockRef.current = null; }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(timerRef.current);
      stopMeter();
      releaseLock();
      if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
    };
  }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function start() {
    setError('');
    setHitMax(false);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
      setError('இந்த உலாவியில் பதிவு செய்ய முடியாது. Chrome அல்லது Safari பயன்படுத்தவும். / This browser cannot record audio. Please use Chrome or Safari.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError('மைக்ரோஃபோன் அனுமதி தேவை. உலாவி அமைப்பில் அனுமதித்து மீண்டும் முயலவும். / Microphone access is blocked. Allow it in your browser settings and try again.');
      return;
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      clearInterval(timerRef.current);
      stopMeter();
      releaseLock();
      stream.getTracks().forEach((t) => t.stop());
      if (!mounted.current) return; // left the question mid-take: discard
      const elapsed = Math.min(maxSeconds, Math.round((Date.now() - startRef.current) / 1000));
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || 'audio/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSeconds(elapsed);
      setRecording(false);
      onRecorded(blob, elapsed);
    };
    recRef.current = rec;
    setPreviewUrl(null);
    onRecorded(null, 0);
    startRef.current = Date.now();
    setSeconds(0);
    rec.start();
    setRecording(true);
    startMeter(stream);
    try { lockRef.current = await navigator.wakeLock?.request('screen'); } catch {}
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      setSeconds(s);
      if (s >= maxSeconds) { setHitMax(true); stop(); }
    }, 250);
  }
  function stop() {
    if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const minReached = seconds >= minSeconds;

  return (
    <div className="rec-wrap">
      <button
        type="button"
        className={`recbtn ${recording ? 'live' : ''}`}
        disabled={disabled || (recording && !minReached)}
        onClick={recording ? stop : start}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        {recording ? '■' : previewUrl ? '↻' : '●'}
      </button>

      <p className="status-text" role="status">
        {recording
          ? <><span className="record-dot" />{fmt(seconds)} / {fmt(maxSeconds)} · {minReached ? 'நிறுத்த தட்டவும் / Tap to stop' : `தொடர்ந்து பேசுங்கள் (குறைந்தது ${minSeconds} விநாடி) / Keep speaking (min ${minSeconds}s)`}</>
          : previewUrl
          ? <>{hitMax ? 'அதிகபட்ச நேரம் எட்டப்பட்டது / Maximum time reached · ' : ''}{fmt(seconds)} · மீண்டும் பதிவு செய்ய தட்டவும் / Tap to re-record</>
          : `பதிவு தொடங்க தட்டவும் / Tap to start · ${minSeconds}–${maxSeconds} விநாடி / seconds`}
      </p>

      {recording && (
        <>
          <div className="timebar" aria-hidden="true">
            <div className={`fill ${minReached ? 'ok' : ''}`} style={{ width: `${(100 * seconds) / maxSeconds}%` }} />
            <div className="tick" style={{ left: `${(100 * minSeconds) / maxSeconds}%` }} />
          </div>
          <div className="meter" aria-hidden="true"><div style={{ width: `${level}%` }} /></div>
        </>
      )}
      {previewUrl && !recording && <audio controls src={previewUrl} />}
      {error && <div className="alert error" role="alert">{error}</div>}
    </div>
  );
}
