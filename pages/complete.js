import Link from 'next/link';
import Layout from '../components/Layout';

export default function Complete() {
  return (
    <Layout progress={100}>
      <h1>நன்றி!</h1>
      <p className="lead">Thank you for taking part in the study.</p>
      <div className="card">
        <p>உங்கள் பதில்களும் நேர்காணலும் பாதுகாப்பாகச் சேமிக்கப்பட்டன.</p>
        <p className="muted">Your answers and recordings have been saved securely.</p>
      </div>
      <Link className="btn secondary" href="/dashboard">டாஷ்போர்டு / Back to dashboard</Link>
    </Layout>
  );
}
