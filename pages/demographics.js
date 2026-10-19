import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useParticipant } from '../lib/useParticipant';
import Layout, { ActionBar } from '../components/Layout';
import Choices from '../components/Choices';

const fields = [
  {
    "id": "age_group",
    "label": "What is your age group?",
    "options": [
      "20–29",
      "30–39",
      "40–50"
    ]
  },
  {
    "id": "gender",
    "label": "What is your gender?",
    "options": [
      "Male",
      "Female",
      "Transgender",
      "Other"
    ]
  },
  {
    "id": "marital_status",
    "label": "What is your marital status?",
    "options": [
      "Married",
      "Widowed",
      "Divorced or separated",
      "Never married"
    ]
  },
  {
    "id": "education",
    "label": "What is your highest level of education?",
    "options": [
      "Below 10th",
      "10th",
      "12th",
      "Diploma",
      "Bachelor’s degree",
      "Master’s degree or above"
    ]
  },
  {
    "id": "children",
    "label": "How many children do you have?",
    "options": [
      "0",
      "1",
      "2",
      "3",
      "4 or more"
    ]
  },
  {
    "id": "religion",
    "label": "What is your religion?",
    "options": [
      "Hindu",
      "Muslim",
      "Christian",
      "Other",
      "No religion"
    ]
  },
  {
    "id": "work_status",
    "label": "What is your current work status?",
    "options": [
      "Employed full-time",
      "Employed part-time",
      "Self-employed",
      "Not working",
      "Homemaker",
      "Student"
    ]
  },
  {
    "id": "residence",
    "label": "Where do you live?",
    "options": [
      "Village",
      "Town",
      "City"
    ]
  }
];

export default function Demographics() {
  const router = useRouter();
  // requireOnboarding false: this page is itself an onboarding step.
  const { loading, participant } = useParticipant({ requireOnboarding: false });
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!participant) return;
    if (!participant.consented) router.replace('/consent');
    else if (participant.demographics_done) router.replace('/dashboard');
  }, [participant, router]);

  const answered = fields.filter((f) => values[f.id]).length;

  async function submit() {
    setSaving(true);
    setError('');
    const { error: dbError } = await supabase
      .from('participants')
      .update({ demographics: values, demographics_done: true })
      .eq('id', participant.id);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    router.push('/dashboard');
  }

  if (loading || !participant || !participant.consented || participant.demographics_done) return null;

  return (
    <Layout username={participant.username} progress={(100 * answered) / fields.length}
      bar={<ActionBar><button className="btn" disabled={saving || answered < fields.length} onClick={submit}>
        {saving ? 'சேமிக்கிறது… / Saving…' : answered < fields.length ? `${answered} / ${fields.length}` : 'அடுத்து / Next'}
      </button></ActionBar>}>
      <h1>அடிப்படை தகவல்கள்</h1>
      <p className="lead">A few basic questions (asked once). {answered} of {fields.length} answered.</p>
      {fields.map((f, i) => (
        <div className="card" key={f.id}>
          <p className="q-text" style={{ fontSize: '1.1rem' }}>{i + 1}. {f.label}</p>
          <Choices options={f.options} value={values[f.id]} onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} />
        </div>
      ))}
      {error && <div className="alert error" role="alert">{error}</div>}
    </Layout>
  );
}
