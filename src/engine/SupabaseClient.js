import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client configuration.
 * 
 * Set these in your .env file:
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export const isSupabaseConfigured = () => !!supabase;

/**
 * Auth helpers
 */
export async function signUp(email, password) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

export async function signIn(email, password) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signInWithGoogle() {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
}

export async function getUser() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
}

export async function getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
}

/**
 * Cloud sync helpers (sync local IndexedDB → Supabase)
 */
export async function syncProgress(sessions) {
    if (!supabase) return;
    const user = await getUser();
    if (!user) return;

    const { error } = await supabase
        .from('progress')
        .upsert(
            sessions.map(s => ({
                id: s.id,
                user_id: user.id,
                song_id: s.songId,
                song_name: s.songName,
                date: new Date(s.date).toISOString(),
                duration: s.duration,
                score: s.score,
                notes_hit: s.notesHit,
                notes_missed: s.notesMissed,
                accuracy: s.accuracy,
                max_streak: s.maxStreak,
                speed: s.speed,
                hand_mode: s.handMode,
            })),
            { onConflict: 'id' }
        );
    if (error) console.error('Sync error:', error);
}

export async function fetchCloudProgress() {
    if (!supabase) return [];
    const user = await getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error('Fetch error:', error);
        return [];
    }
    return data || [];
}

/**
 * SQL for creating the Supabase tables (run once in SQL Editor):
 * 
 * CREATE TABLE progress (
 *   id UUID PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users NOT NULL,
 *   song_id TEXT,
 *   song_name TEXT,
 *   date TIMESTAMPTZ DEFAULT NOW(),
 *   duration REAL DEFAULT 0,
 *   score INTEGER DEFAULT 0,
 *   notes_hit INTEGER DEFAULT 0,
 *   notes_missed INTEGER DEFAULT 0,
 *   accuracy INTEGER DEFAULT 0,
 *   max_streak INTEGER DEFAULT 0,
 *   speed REAL DEFAULT 1,
 *   hand_mode TEXT DEFAULT 'both'
 * );
 * 
 * ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users can manage own progress"
 *   ON progress FOR ALL USING (auth.uid() = user_id);
 */
