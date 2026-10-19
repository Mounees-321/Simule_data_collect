import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useParticipant } from '../../lib/useParticipant';
import { isApplicable } from '../../lib/conditions';
import Layout, { ActionBar } from '../../components/Layout';
import Choices from '../../components/Choices';

function choiceOptions(q) {
  const o = q.options;
  if (q.type === 'likert5' && Array.isArray(o)) return o.map((label, i) => ({ value: String(i + 1), label }));
  if (q.type === 'single_choice' && Array.isArray(o)) return o;
  if (q.type === 'binary_choice' && o?.left && o?.right) return [o.left, o.right].map((x) => ({ value: x.value, label: `${x.tamil} (${x.english})` }));
  return null;
}

// An answer is valid when present; game amounts must be whole numbers in range.
function isValid(q, value) {
  if (value === '' || value === undefined || value === null) return false;
  if (q.type === 'slider' && q.options) {
    const n = Number(value);
    return Number.isInteger(n) && n >= (q.options.min ?? 0) && n <= (q.options.max ?? 100);
  }
  return String(value).trim() !== '';
}

export default function SurveySection() {
  const router = useRouter();
  const { slug } = router.query;
  const { loading, participant } = useParticipant();
  const [instrument, setInstrument] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!participant || !slug) return;
    (async () => {
      const { data: inst } = await supabase.from('instruments').select('*').eq('slug', slug).single();
      if (!inst) { router.replace('/dashboard'); return; }
      setInstrument(inst);
      const { data: allQs } = await supabase.from('questions').select('*')
        .eq('instrument_id', inst.id).eq('is_active', true).order('order_index');
      const qs = (allQs || []).filter((q) => isApplicable(q, participant.demographics));
      setQuestions(qs);
      const { data: existing } = await supabase.from('responses').select('question_id, answer_value')
        .eq('participant_id', participant.id).in('question_id', qs.map((q) => q.id));
      const map = {};
      (existing || []).forEach((r) => { map[r.question_id] = r.answer_value; });
      setAnswers(map);
      const first = qs.findIndex((q) => !(q.id in map));
      const start = first === -1 ? 0 : first; // fully answered: review from the start
      setIndex(start);
      setCurrent(map[qs[start]?.id] ?? '');
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, slug]);

  const question = questions[index];
  const options = question ? choiceOptions(question) : null;
  const isLast = index === questions.length - 1;

  async function goNext() {
    if (!question || saving || !isValid(question, current)) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('responses').upsert(
      { participant_id: participant.id, question_id: question.id, answer_value: String(current).trim() },
      { onConflict: 'participant_id,question_id' }
    );
    setSaving(false);
    if (err) {
      setError('சேமிக்க முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும். / Could not save. Check your connection and try again.');
      return;
    }
    setAnswers((a) => ({ ...a, [question.id]: String(current).trim() }));
    if (isLast) { router.push('/dashboard'); return; }
    const n = index + 1;
    setIndex(n);
    setCurrent(answers[questions[n].id] ?? '');
    window.scrollTo(0, 0);
  }

  function goPrev() {
    if (index === 0 || saving) return;
    setError('');
    setIndex(index - 1);
    setCurrent(answers[questions[index - 1].id] ?? '');
    window.scrollTo(0, 0);
  }

  // keyboard: 1-9 pick an option, Enter continues
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (!question || tag === 'TEXTAREA' || tag === 'BUTTON' || e.metaKey || e.ctrlKey) return;
      if (options && tag !== 'INPUT' && /^[1-9]$/.test(e.key)) {
        const o = options[Number(e.key) - 1];
        if (o) setCurrent(typeof o === 'string' ? o : o.value);
      } else if (e.key === 'Enter' && isValid(question, current)) {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading || !participant || !ready) return null;
  if (!question) {
    return (
      <Layout username={participant.username}>
        <h1>{instrument?.name_tamil}</h1>
        <p className="lead">இந்தப் பகுதியில் உங்களுக்கான கேள்விகள் இல்லை. / No questions for you in this section.</p>
        <button className="btn" onClick={() => router.push('/dashboard')}>திரும்பு / Back</button>
      </Layout>
    );
  }

  const main = question.prompt_tamil || question.prompt_english || '';
  const isGame = instrument.slug === 'behavioral_games' && !question.prompt_tamil;
  const parts = isGame ? main.split('\n\n') : [main];

  return (
    <Layout username={participant.username} progress={(100 * index) / questions.length}
      bar={
        <ActionBar>
          <button className="btn secondary" disabled={index === 0 || saving} onClick={goPrev}>← முந்தைய / Back</button>
          <button className="btn" disabled={saving || !isValid(question, current)} onClick={goNext}>
            {saving ? 'சேமிக்கிறது… / Saving…' : isLast ? 'முடி / Finish' : 'அடுத்து / Next →'}
          </button>
        </ActionBar>
      }>
      <p className="status-text" style={{ marginTop: 0 }}>{instrument.name_tamil} · {index + 1} / {questions.length}</p>
      <div className="card">
        {question.section && <span className="q-tag">{question.section}</span>}

        {isGame ? (
          <>
            <div className="scenario">{parts[0]}</div>
            {parts.slice(1).map((p, i) => (
              /^(Your earnings|Pairing|Example)/.test(p) ? <p key={i} className="muted" style={{ whiteSpace: 'pre-line' }}>{p}</p>
              : p.includes('\n') ? <div key={i} className="scenario">{p}</div>
              : <p key={i} className="q-text" style={{ fontSize: '1.1rem' }}>{p}</p>
            ))}
          </>
        ) : (
          <p className="q-text">{parts[0]}</p>
        )}
        {question.prompt_tamil && question.prompt_english && <p className="q-sub">{question.prompt_english}</p>}

        {options && <Choices options={options} value={current} onChange={setCurrent} showNumbers />}

        {question.type === 'slider' && question.options && (
          <div>
            <div className="amount">
              <span>{question.options.unit || ''}</span>
              <input type="number" inputMode="numeric" min={question.options.min ?? 0} max={question.options.max ?? 100} step={1}
                value={current} placeholder={`${question.options.min ?? 0}–${question.options.max ?? 100}`}
                onChange={(e) => setCurrent(e.target.value)} aria-label="Amount" />
            </div>
            <input type="range" min={question.options.min ?? 0} max={question.options.max ?? 100} step={question.options.step ?? 1}
              value={current === '' ? (question.options.min ?? 0) : Number(current)} onChange={(e) => setCurrent(e.target.value)} />
            <div className="row" style={{ marginTop: 2 }}>
              <span className="status-text" style={{ margin: 0 }}>{question.options.left_label}</span>
              <span className="status-text" style={{ margin: 0 }}>{question.options.right_label}</span>
            </div>
            {current !== '' && !isValid(question, current) && (
              <div className="alert error" role="alert">முழு எண் மட்டும், {question.options.min ?? 0}–{question.options.max ?? 100} / Whole number between {question.options.min ?? 0} and {question.options.max ?? 100}.</div>
            )}
          </div>
        )}

        {question.type === 'text' && (
          <textarea rows={4} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="உங்கள் பதில் / Your answer" />
        )}
        {question.type === 'numeric' && (
          <input type="number" inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value)} />
        )}
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
    </Layout>
  );
}
