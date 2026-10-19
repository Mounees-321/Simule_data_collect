import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useParticipant } from '../lib/useParticipant';
import Layout, { ActionBar } from '../components/Layout';

export default function Consent() {
  const router = useRouter();
  const { loading, participant } = useParticipant({ requireOnboarding: false });
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (participant?.consented) router.replace(participant.demographics_done ? '/dashboard' : '/demographics');
  }, [participant, router]);

  async function submit() {
    setSaving(true);
    setError('');
    const { error: dbError } = await supabase
      .from('participants')
      .update({ consented: true, consented_at: new Date().toISOString() })
      .eq('id', participant.id);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    router.push('/demographics');
  }

  if (loading || !participant || participant.consented) return null;

  return (
    <Layout username={participant.username}
      bar={<ActionBar><button className="btn" disabled={!agreed || saving} onClick={submit}>{saving ? 'சேமிக்கிறது… / Saving…' : 'தொடர் / Continue'}</button></ActionBar>}>
      <h1>பங்கேற்பு ஒப்புதல்</h1>
      <p className="lead">Consent to take part</p>
      <div className="card">
        <h2>இந்த ஆய்வில் என்ன நடக்கும் / What will happen</h2>
        <ul className="clean">
          <li>ஒலிப்பேட்டு நேர்காணல்: 50 கேள்விகள், 5 தொகுதிகள் (ஒவ்வொன்றும் 15–60 விநாடி பதில்). / An audio interview: 50 questions in 5 batches, each answered in 15–60 seconds.</li>
          <li>கணக்கெடுப்புகள், ஆளுமை கேள்விகள், சிறிய பணப் பங்கீட்டு விளையாட்டுகள். / Surveys, personality questions and short money-sharing games.</li>
          <li>ஒரே அமர்வில் முடிக்க வேண்டியதில்லை; உள்நுழைந்து தொடரலாம். / You do not have to finish in one sitting; log in to continue.</li>
        </ul>
        <h2 style={{ marginTop: 18 }}>உங்கள் தரவு / Your data</h2>
        <ul className="clean">
          <li>உங்கள் குரல் பதிவுகளும் பதில்களும் பாதுகாப்பாகச் சேமிக்கப்படும்; கல்வி ஆராய்ச்சிக்காக மட்டுமே பயன்படும். / Your recordings and answers are stored securely and used for academic research only.</li>
          <li>உங்கள் பதில்களைக் கொண்டு, உங்கள் பதில்களை முன்கணிக்கும் AI மாதிரி உருவாக்கி சோதிக்கப்படும். / Your answers will be used to build and test an AI model that tries to predict how you would answer.</li>
          <li>இது தன்னார்வப் பங்கேற்பு; எந்த நேரத்திலும் நிறுத்தலாம், எந்தக் கேள்வியையும் தவிர்க்கலாம் (பதிவு தவிர). / Taking part is voluntary. You can stop at any time.</li>
        </ul>
      </div>
      <button type="button" className={`choice ${agreed ? 'selected' : ''}`} role="checkbox" aria-checked={agreed} onClick={() => setAgreed((v) => !v)}>
        <span className="dot" />
        <span>நான் படித்தேன், பங்கேற்க ஒப்புக்கொள்கிறேன் / I have read this and agree to take part</span>
      </button>
      {error && <div className="alert error" role="alert">{error}</div>}
    </Layout>
  );
}
