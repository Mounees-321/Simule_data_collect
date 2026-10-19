import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        router.replace('/dashboard');
      } else {
        router.replace('/signup');
      }
    });
  }, [router]);

  return (
    <main className="page">
      <p className="lead">ஏற்றுகிறது... / Loading...</p>
    </main>
  );
}
