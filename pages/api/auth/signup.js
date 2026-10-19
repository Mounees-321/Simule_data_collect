import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${clean}@tamilstudy.local`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Invalid username or password.' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });

  if (userError) return res.status(400).json({ error: userError.message });

  const { error: participantError } = await supabaseAdmin.from('participants').insert({
    id: userData.user.id,
    username,
  });

  if (participantError) {
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    return res.status(400).json({ error: participantError.message });
  }

  return res.status(200).json({ user: userData.user });
}
