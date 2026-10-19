import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useParticipant } from '../lib/useParticipant';
import { logOut } from '../lib/auth';
import { isApplicable } from '../lib/conditions';
import Layout from '../components/Layout';

const ESTIMATE = { interview: '30–50', gss: '10', bfi: '6', behavioral_games: '8' }; // rough minutes

export default function Dashboard() {
  const router = useRouter();
  const { loading, participant } = useParticipant();
  const [sections, setSections] = useState(null);

  const load = useCallback(async () => {
    if (!participant) return;
    const { data: instruments } = await supabase
      .from('instruments').select('id, slug, name_tamil, name_english, kind').eq('is_active', true).order('order_index');
    const { data: allQs } = await supabase.from('questions').select('id, instrument_id, condition').eq('is_active', true);
    const [{ data: resp }, { data: recs }] = await Promise.all([
      supabase.from('responses').select('question_id').eq('participant_id', participant.id),
      supabase.from('interview_recordings').select('question_id').eq('participant_id', participant.id),
    ]);
    const answered = new Set([...(resp || []), ...(recs || [])].map((r) => r.question_id));
    setSections((instruments || []).map((inst) => {
      const qs = (allQs || []).filter((q) => q.instrument_id === inst.id && isApplicable(q, participant.demographics));
      return { ...inst, total: qs.length, done: qs.filter((q) => answered.has(q.id)).length };
    }));
  }, [participant]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { // refresh progress when the participant returns to this tab
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  if (loading || !participant) return null;

  const total = (sections || []).reduce((n, s) => n + s.total, 0);
  const done = (sections || []).reduce((n, s) => n + s.done, 0);
  const pct = total ? Math.round((100 * done) / total) : 0;
  const next = (sections || []).find((s) => s.total > 0 && s.done < s.total);
  const hrefOf = (s) => (s.kind === 'audio_interview' ? '/interview' : `/survey/${s.slug}`);

  return (
    <Layout username={participant.username} progress={pct} onLogout={async () => { await logOut(); router.push('/login'); }}>
      <h1>வணக்கம், {participant.username}</h1>
      <p className="lead">
        {sections && !next && total > 0
          ? 'எல்லாம் முடிந்தது. நன்றி! / Everything is complete. Thank you!'
          : `உங்கள் முன்னேற்றம் / Your progress: ${pct}% — எப்போது வேண்டுமானாலும் நிறுத்தி தொடரலாம் / pause and resume any time.`}
      </p>

      {!sections && <p className="muted">ஏற்றுகிறது… / Loading…</p>}

      {next && (
        <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
          <p className="muted" style={{ margin: 0 }}>அடுத்தது / Up next</p>
          <h2 style={{ fontSize: '1.3rem', margin: '4px 0 12px' }}>{next.name_tamil} · {next.name_english}</h2>
          <Link className="btn block" href={hrefOf(next)}>{next.done > 0 ? 'தொடர் / Continue' : 'தொடங்கு / Start'} →</Link>
        </div>
      )}

      {(sections || []).map((s) => {
        const complete = s.total > 0 && s.done >= s.total;
        const started = s.done > 0;
        return (
          <div className="card" key={s.slug}>
            <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>{s.name_tamil}</h2>
                <p className="muted" style={{ margin: 0 }}>{s.name_english}{ESTIMATE[s.slug] ? ` · ~${ESTIMATE[s.slug]} நிமிடம் / min` : ''}</p>
              </div>
              <span className={`chip ${complete ? 'done' : started ? 'progress-chip' : ''}`}>
                {complete ? '✓ முடிந்தது / Done' : started ? 'நடைபெறுகிறது / In progress' : 'தொடங்கவில்லை / Not started'}
              </span>
            </div>
            <div className="progress" style={{ borderRadius: 4, margin: '14px 0 6px', overflow: 'hidden' }}>
              <div style={{ width: `${s.total ? (100 * s.done) / s.total : 0}%` }} />
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="status-text" style={{ margin: 0 }}>{s.done} / {s.total}</span>
              <Link className="btn secondary small" href={hrefOf(s)}>{complete ? 'மறுபார்வை / Review' : started ? 'தொடர் / Continue' : 'தொடங்கு / Start'}</Link>
            </div>
          </div>
        );
      })}
    </Layout>
  );
}
