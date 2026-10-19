import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useParticipant } from '../lib/useParticipant';
import Layout, { ActionBar } from '../components/Layout';
import AudioRecorder from '../components/AudioRecorder';
import MicCheck from '../components/MicCheck';

const BATCH_SIZE = 10, MIN_SECONDS = 15, MAX_SECONDS = 60;

export default function Interview() {
  const router = useRouter();
  const { loading, participant } = useParticipant();
  const [questions, setQuestions] = useState([]);
  const [recorded, setRecorded] = useState({}); // question_id -> { duration_seconds }
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState('questions'); // 'intro' | 'questions'
  const [ready, setReady] = useState(false);
  const [breakBatch, setBreakBatch] = useState(null);
  const [busy, setBusy] = useState(false); // recording or uploading
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const pending = useRef(null);

  useEffect(() => {
    if (!participant) return;
    (async () => {
      const { data: inst } = await supabase.from('instruments').select('*').eq('slug', 'interview').single();
      if (!inst) { router.replace('/dashboard'); return; }
      const { data: qs } = await supabase.from('questions').select('*')
        .eq('instrument_id', inst.id).eq('is_active', true).order('order_index');
      setQuestions(qs || []);
      const { data: existing } = await supabase.from('interview_recordings').select('question_id, duration_seconds')
        .eq('participant_id', participant.id).in('question_id', (qs || []).map((q) => q.id));
      const map = {};
      (existing || []).forEach((r) => { map[r.question_id] = r; });
      setRecorded(map);
      const first = (qs || []).findIndex((q) => !(q.id in map));
      setIndex(first === -1 ? 0 : first);
      setStage(Object.keys(map).length === 0 ? 'intro' : 'questions');
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant]);

  // warn before closing the tab while a take is recording or uploading
  useEffect(() => {
    const warn = (e) => { if (busy) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const question = questions[index];

  async function uploadWithRetry(p) {
    const path = `${participant.id}/${p.question.id}.webm`;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error: upErr } = await supabase.storage.from('interview-audio')
        .upload(path, p.blob, { upsert: true, contentType: p.blob.type || 'audio/webm' });
      if (!upErr) {
        const { error: dbErr } = await supabase.from('interview_recordings').upsert(
          { participant_id: participant.id, question_id: p.question.id, storage_path: path, duration_seconds: p.seconds },
          { onConflict: 'participant_id,question_id' }
        );
        if (!dbErr) return null;
        lastErr = dbErr;
      } else lastErr = upErr;
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
    return lastErr;
  }

  // Each take is uploaded the moment it stops; the participant never loses a finished answer.
  async function upload() {
    const p = pending.current;
    if (!p) return;
    setStatus('saving');
    setBusy(true);
    const err = await uploadWithRetry(p);
    if (err) { setStatus('error'); setBusy(false); return; }
    setRecorded((r) => ({ ...r, [p.question.id]: { duration_seconds: p.seconds } }));
    setStatus('saved');
    setBusy(false);
  }

  function handleRecorded(blob, seconds) {
    if (!blob) { pending.current = null; setStatus('idle'); setBusy(true); return; } // new take started
    pending.current = { blob, seconds, question };
    upload();
  }

  function goTo(i) {
    if (i > index && i % BATCH_SIZE === 0) setBreakBatch(i / BATCH_SIZE);
    setIndex(i);
    setStatus('idle');
    pending.current = null;
    window.scrollTo(0, 0);
  }

  if (loading || !participant || !ready) return null;
  if (!question) {
    return (
      <Layout username={participant.username}>
        <h1>ஒலிப்பேட்டு நேர்காணல்</h1>
        <p className="lead">கேள்விகள் இல்லை. / No interview questions configured yet.</p>
        <button className="btn" onClick={() => router.push('/dashboard')}>திரும்பு / Back</button>
      </Layout>
    );
  }

  const doneCount = Object.keys(recorded).length;
  const totalBatches = Math.ceil(questions.length / BATCH_SIZE);
  const batchNo = Math.floor(index / BATCH_SIZE) + 1;
  const isLast = index === questions.length - 1;
  const hasAnswer = question.id in recorded;

  if (stage === 'intro') {
    return (
      <Layout username={participant.username}
        bar={<ActionBar><button className="btn" onClick={() => setStage('questions')}>தொடங்கு / Start the interview →</button></ActionBar>}>
        <h1>ஒலிப்பேட்டு நேர்காணல்</h1>
        <p className="lead">Audio interview · {questions.length} questions in {totalBatches} batches of {BATCH_SIZE}</p>
        <div className="card">
          <h2>தொடங்கும் முன் / Before you begin</h2>
          <ul className="clean">
            <li>அமைதியான இடத்தில் இருங்கள். / Sit somewhere quiet.</li>
            <li>ஒவ்வொரு கேள்விக்கும் {MIN_SECONDS}–{MAX_SECONDS} விநாடி பேசுங்கள். / Answer each question for {MIN_SECONDS}–{MAX_SECONDS} seconds.</li>
            <li>தமிழ் அல்லது தங்கிலீஷ் — எது இயல்பாக வருகிறதோ அதில். / Tamil or Tanglish, whichever feels natural.</li>
            <li>சரி இல்லையென்றால் மீண்டும் பதிவு செய்யலாம். / You can re-record any answer.</li>
            <li>பதில்கள் உடனே சேமிக்கப்படும்; எப்போது வேண்டுமானாலும் நிறுத்தி தொடரலாம். / Answers save instantly; stop and resume any time.</li>
          </ul>
        </div>
        <div className="card"><MicCheck /></div>
      </Layout>
    );
  }

  if (breakBatch !== null) {
    return (
      <Layout username={participant.username} progress={(100 * doneCount) / questions.length}
        bar={<ActionBar><button className="btn" onClick={() => setBreakBatch(null)}>தொடர் / Continue →</button></ActionBar>}>
        <h1>தொகுதி {breakBatch} / {totalBatches} முடிந்தது 🎉</h1>
        <p className="lead">Batch {breakBatch} of {totalBatches} complete</p>
        <div className="card">
          <p>சிறிது ஓய்வு எடுத்துக்கொண்டு, தயாரானதும் தொடரவும்.</p>
          <p className="muted">Take a short break, then continue when you are ready.</p>
        </div>
      </Layout>
    );
  }

  const start = (batchNo - 1) * BATCH_SIZE;
  const dots = questions.slice(start, start + BATCH_SIZE);

  return (
    <Layout username={participant.username} progress={(100 * doneCount) / questions.length}
      bar={
        <ActionBar>
          <button className="btn secondary" disabled={index === 0 || busy} onClick={() => goTo(index - 1)}>← முந்தைய / Back</button>
          <button className="btn" disabled={busy || !hasAnswer} onClick={() => (isLast ? router.push('/dashboard') : goTo(index + 1))}>
            {isLast ? 'முடி / Finish' : 'அடுத்து / Next →'}
          </button>
        </ActionBar>
      }>
      <p className="status-text" style={{ marginTop: 0 }}>
        தொகுதி / Batch {batchNo} of {totalBatches} · கேள்வி / Question {(index % BATCH_SIZE) + 1} of {dots.length}
      </p>
      <div className="dots" aria-hidden="true">
        {dots.map((q, i) => <span key={q.id} className={q.id in recorded ? 'done' : start + i === index ? 'cur' : ''} />)}
      </div>

      <div className="card">
        {question.section && <span className="q-tag">{question.section}</span>}
        <p className="q-text">{question.prompt_tamil}</p>
        <p className="q-sub">{MIN_SECONDS}–{MAX_SECONDS} விநாடி · தமிழ் / Tanglish</p>

        <AudioRecorder key={question.id} minSeconds={MIN_SECONDS} maxSeconds={MAX_SECONDS}
          onRecorded={handleRecorded} disabled={status === 'saving'} />

        {status === 'saving' && <div className="alert ok" role="status">சேமிக்கிறது… / Saving…</div>}
        {status === 'saved' && <div className="alert ok" role="status">✓ சேமிக்கப்பட்டது / Saved</div>}
        {status === 'error' && (
          <div className="alert error" role="alert">
            சேமிக்க முடியவில்லை. இணைப்பைச் சரிபார்க்கவும். உங்கள் பதிவு இந்தப் பக்கத்தில் உள்ளது. /
            Could not save. Check your connection; your recording is still on this page.{' '}
            <button className="btn small" onClick={upload}>மீண்டும் முயல் / Retry</button>
          </div>
        )}
        {status === 'idle' && hasAnswer && !busy && (
          <p className="status-text">✓ ஏற்கனவே பதிவு செய்யப்பட்டது. மாற்ற மீண்டும் பதிவு செய்யுங்கள். / Already recorded. Record again to replace it.</p>
        )}
      </div>
    </Layout>
  );
}
