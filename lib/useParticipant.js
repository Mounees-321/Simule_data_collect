import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';
import { getParticipantRow } from './auth';

// Loads the signed-in user's participant row and (optionally) redirects
// to the right onboarding step if they haven't finished consent/demographics
// yet. Use `require: 'none'` on pages that just need *a* session (signup,
// login) and don't want redirects.
export function useParticipant({ requireOnboarding = true } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        if (active) {
          setLoading(false);
          router.replace('/login');
        }
        return;
      }

      const row = await getParticipantRow(user.id);
      if (!active) return;

      if (!row) {
        setLoading(false);
        router.replace('/login');
        return;
      }

      if (requireOnboarding) {
        if (!row.consented) {
          setLoading(false);
          router.replace('/consent');
          return;
        }
        if (!row.demographics_done) {
          setLoading(false);
          router.replace('/demographics');
          return;
        }
      }

      setParticipant(row);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loading, participant, setParticipant };
}
