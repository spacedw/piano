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
        options: { redirectTo: import.meta.env.VITE_APP_URL || window.location.origin },
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

/**
 * Phase 2: Community & Supporter helpers
 */

export async function getUserProfile() {
    if (!supabase) return null;
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    return data;
}

export async function updateProfile(updates) {
    if (!supabase) return null;
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
    if (error) {
        return null;
    }
    return data;
}

export async function uploadMidi(buffer, path) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.storage
        .from('user-midi')
        .upload(path, buffer, {
            contentType: 'audio/midi',
            upsert: false
        });
    if (error) throw error;
    return data;
}

export async function deleteMidi(path) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.storage
        .from('user-midi')
        .remove([path]);
    if (error) throw error;
    return data;
}

export async function getCommunityFeed(filters = {}) {
    if (!supabase) return [];
    let query = supabase
        .from('community_songs')
        .select(`
            *,
            profiles(tier)
        `);

    if (filters.genre) query = query.eq('genre', filters.genre);
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    
    if (filters.sortBy === 'popular') {
        query = query.order('rating_avg', { ascending: false }).order('save_count', { ascending: false });
    } else {
        // Order by id descending (most recently inserted first)
        query = query.order('id', { ascending: false });
    }

    const { data, error } = await query.limit(50);
    if (error) {
        console.error('Error fetching community feed:', error);
        return [];
    }
    return data;
}

export async function getCommunityById(id) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('community_songs')
        .select(`
            *,
            profiles(tier)
        `)
        .eq('id', id)
        .single();
    if (error) {
        console.error('Error fetching community song:', error);
        return null;
    }
    return data;
}

export async function submitCommunityUpload(metadata, buffer, fileHash) {
    if (!supabase) throw new Error('Supabase not configured');
    const user = await getUser();
    if (!user) throw new Error('Not logged in');

    // 1. Hash deduplication check
    const { data: existing } = await supabase
        .from('community_songs')
        .select('id')
        .eq('file_hash', fileHash)
        .maybeSingle();

    if (existing) {
        throw new Error('This MIDI already exists in the community library.');
    }

    // 2. Upload to storage
    // Clean string to avoid illegal chars in path
    const titleClean = metadata.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `${user.id}/${Date.now()}_${titleClean}.mid`;
    await uploadMidi(buffer, path);

    // 3. Insert into community_songs
    const { data, error } = await supabase
        .from('community_songs')
        .insert({
            uploader_id: user.id,
            title: metadata.title,
            composer: metadata.composer || 'Unknown',
            genre: metadata.genre,
            difficulty: metadata.difficulty,
            storage_path: path,
            file_hash: fileHash,
            rating_avg: 0,
            save_count: 0,
            play_count: 0
        })
        .select()
        .single();
        
    if (error) {
        await deleteMidi(path); // Rollback
        throw error;
    }

    // Increment the monthly upload counter for free-tier tracking
    try {
        const profile = await getUserProfile();
        if (profile) {
            await updateProfile({
                uploads_this_month: (profile.uploads_this_month || 0) + 1,
            });
        }
    } catch (_) {
        // Non-fatal — quota tracking best-effort
    }

    return data;
}

export async function rateSong(songId, rating) {
    if (!supabase) throw new Error('Supabase not configured');
    const user = await getUser();
    if (!user) throw new Error('Not logged in');

    const { error } = await supabase
        .from('community_ratings')
        .upsert({ song_id: songId, user_id: user.id, rating }, { onConflict: 'song_id,user_id' });
        
    if (error) throw error;
    return true; 
}

export async function reportSong(songId, reason) {
    if (!supabase) throw new Error('Supabase not configured');
    const user = await getUser();
    if (!user) throw new Error('Not logged in');

    const { error } = await supabase
        .from('community_reports')
        .insert({ song_id: songId, reporter_id: user.id, reason });
        
    if (error) throw error;
    return true;
}

export async function saveCommunityToLibrary(songId) {
    if (!supabase) throw new Error('Supabase not configured');

    const song = await getCommunityById(songId);
    if (!song) throw new Error('Song not found');

    // Increment save_count directly
    try {
        await supabase
            .from('community_songs')
            .update({ save_count: (song.save_count || 0) + 1 })
            .eq('id', songId);
    } catch (e) {
        // Non-fatal — proceed with download
    }

    const { data: fileData, error: downloadError } = await supabase.storage
        .from('user-midi')
        .download(song.storage_path);
        
    if (downloadError) throw downloadError;
    const buffer = await fileData.arrayBuffer();

    return { song, buffer };
}

