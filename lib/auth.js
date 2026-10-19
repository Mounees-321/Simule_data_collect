import { supabase } from './supabaseClient';

// Supabase Auth requires an email. Participants only ever see/enter a
// plain username, so we map it to a fake local address behind the scenes.
const EMAIL_DOMAIN = 'tamilstudy.local';

export function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${clean}@${EMAIL_DOMAIN}`;
}

export async function signUp(username, password) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const result = await response.json();
  if (!response.ok) return { error: { message: result.error || 'பயனர் பதிவு தோல்வியடைந்தது.' } };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) return { error };
  return { user: data.user };
}

export async function logIn(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };
  return { user: data.user };
}

export async function logOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function getParticipantRow(userId) {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}
