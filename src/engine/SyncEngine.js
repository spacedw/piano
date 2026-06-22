/**
 * SyncEngine — bidirectional sync between IndexedDB and Supabase.
 * Only runs for users with tier 'supporter' or 'admin'.
 *
 * Call initSync(user) when a qualifying user logs in (or null on logout).
 * Call syncAll() to perform a full bidirectional merge.
 */

import { supabase } from './SupabaseClient';
import { getAllSongs, saveSong, getAllSettings, saveSetting, registerSyncCallbacks } from './Storage';

let _currentUser = null;
let _syncing = false; // prevents re-upload of records just downloaded from cloud

// ── ArrayBuffer ↔ base64 ──────────────────────────────────────────────────────

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ── Single-record push helpers (used by background trigger) ──────────────────

export async function pushSong(song, userId) {
    if (!supabase) return;
    const { error } = await supabase
        .from('user_songs')
        .upsert({
            id: song.id,
            user_id: userId,
            name: song.name,
            artist: song.artist,
            genre: song.genre,
            difficulty: song.difficulty,
            bpm: song.bpm,
            total_duration: song.totalDuration,
            note_count: song.noteCount,
            track_count: song.trackCount,
            midi_data: song.midiData ? bufferToBase64(song.midiData) : null,
            added_at: song.addedAt,
            last_played_at: song.lastPlayedAt,
            play_count: song.playCount,
            best_score: song.bestScore,
            favorite: song.favorite,
            tags: song.tags || [],
            source: song.source,
            community_id: song.communityId,
            file_size_bytes: song.fileSizeBytes,
            updated_at: song.updatedAt || Date.now(),
        }, { onConflict: 'id' });
    if (error) console.error('[SyncEngine] pushSong error:', error);
}

export async function pushSetting(key, value, updatedAt, userId) {
    if (!supabase) return;
    const { error } = await supabase
        .from('user_settings')
        .upsert(
            { user_id: userId, key, value: JSON.stringify(value), updated_at: updatedAt || Date.now() },
            { onConflict: 'user_id,key' }
        );
    if (error) console.error('[SyncEngine] pushSetting error:', error);
}

// ── Full sync ─────────────────────────────────────────────────────────────────

async function syncSongs(userId) {
    const { data: cloudSongs, error } = await supabase
        .from('user_songs')
        .select('*')
        .eq('user_id', userId);

    if (error) { console.error('[SyncEngine] syncSongs fetch error:', error); return; }

    const localSongs = await getAllSongs();
    const localMap = new Map(localSongs.map(s => [s.id, s]));
    const cloudMap = new Map((cloudSongs || []).map(s => [s.id, s]));

    const toUpload = [];
    const toDownload = [];

    for (const local of localSongs) {
        const cloud = cloudMap.get(local.id);
        if (!cloud) {
            toUpload.push(local);
        } else {
            const localTime = local.updatedAt || local.addedAt || 0;
            const cloudTime = cloud.updated_at || 0;
            if (localTime > cloudTime) toUpload.push(local);
            else if (cloudTime > localTime) toDownload.push(cloud);
        }
    }

    for (const cloud of (cloudSongs || [])) {
        if (!localMap.has(cloud.id)) toDownload.push(cloud);
    }

    // Upload
    if (toUpload.length > 0) {
        const rows = toUpload.map(s => ({
            id: s.id,
            user_id: userId,
            name: s.name,
            artist: s.artist,
            genre: s.genre,
            difficulty: s.difficulty,
            bpm: s.bpm,
            total_duration: s.totalDuration,
            note_count: s.noteCount,
            track_count: s.trackCount,
            midi_data: s.midiData ? bufferToBase64(s.midiData) : null,
            added_at: s.addedAt,
            last_played_at: s.lastPlayedAt,
            play_count: s.playCount,
            best_score: s.bestScore,
            favorite: s.favorite,
            tags: s.tags || [],
            source: s.source,
            community_id: s.communityId,
            file_size_bytes: s.fileSizeBytes,
            updated_at: s.updatedAt || s.addedAt || Date.now(),
        }));
        const { error: upErr } = await supabase.from('user_songs').upsert(rows, { onConflict: 'id' });
        if (upErr) console.error('[SyncEngine] upload songs error:', upErr);
    }

    // Download (save locally; _syncing flag prevents re-upload)
    for (const cloud of toDownload) {
        await saveSong({
            id: cloud.id,
            name: cloud.name,
            artist: cloud.artist,
            genre: cloud.genre,
            difficulty: cloud.difficulty,
            bpm: cloud.bpm,
            totalDuration: cloud.total_duration,
            noteCount: cloud.note_count,
            trackCount: cloud.track_count,
            midiData: cloud.midi_data ? base64ToBuffer(cloud.midi_data) : null,
            addedAt: cloud.added_at,
            lastPlayedAt: cloud.last_played_at,
            playCount: cloud.play_count,
            bestScore: cloud.best_score,
            favorite: cloud.favorite,
            tags: cloud.tags || [],
            source: cloud.source,
            communityId: cloud.community_id,
            fileSizeBytes: cloud.file_size_bytes,
            updatedAt: cloud.updated_at,
        });
    }

    console.log(`[SyncEngine] Songs: ↑${toUpload.length} uploaded, ↓${toDownload.length} downloaded`);
}

async function syncSettings(userId) {
    const { data: cloudSettings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId);

    if (error) { console.error('[SyncEngine] syncSettings fetch error:', error); return; }

    const localSettings = await getAllSettings();
    const localMap = new Map(localSettings.map(s => [s.key, s]));
    const cloudMap = new Map((cloudSettings || []).map(s => [s.key, s]));

    const toUpload = [];
    const toDownload = [];

    for (const local of localSettings) {
        const cloud = cloudMap.get(local.key);
        if (!cloud) {
            toUpload.push(local);
        } else {
            const localTime = local.updatedAt || 0;
            const cloudTime = cloud.updated_at || 0;
            if (localTime > cloudTime) toUpload.push(local);
            else if (cloudTime > localTime) toDownload.push(cloud);
        }
    }

    for (const cloud of (cloudSettings || [])) {
        if (!localMap.has(cloud.key)) toDownload.push(cloud);
    }

    // Upload
    if (toUpload.length > 0) {
        const rows = toUpload.map(s => ({
            user_id: userId,
            key: s.key,
            value: JSON.stringify(s.value),
            updated_at: s.updatedAt || Date.now(),
        }));
        const { error: upErr } = await supabase
            .from('user_settings')
            .upsert(rows, { onConflict: 'user_id,key' });
        if (upErr) console.error('[SyncEngine] upload settings error:', upErr);
    }

    // Download
    for (const cloud of toDownload) {
        let value;
        try { value = JSON.parse(cloud.value); } catch { value = cloud.value; }
        await saveSetting(cloud.key, value, cloud.updated_at);
    }

    console.log(`[SyncEngine] Settings: ↑${toUpload.length} uploaded, ↓${toDownload.length} downloaded`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call when a supporter/admin logs in (pass user) or logs out (pass null).
 * Registers background-push callbacks in Storage so every local write is
 * immediately mirrored to Supabase while the user is online.
 */
export function initSync(user) {
    _currentUser = user;
    if (user) {
        registerSyncCallbacks({
            onSongSaved: (song) => {
                if (_currentUser && !_syncing) return pushSong(song, _currentUser.id);
                return Promise.resolve();
            },
            onSettingSaved: (key, value, updatedAt) => {
                if (_currentUser && !_syncing) return pushSetting(key, value, updatedAt, _currentUser.id);
                return Promise.resolve();
            },
        });
    } else {
        registerSyncCallbacks({ onSongSaved: null, onSettingSaved: null });
    }
}

/**
 * Full bidirectional merge: songs + settings.
 * Safe to call on app start after login — won't re-upload records it just downloaded.
 */
export async function syncAll() {
    if (!supabase || !_currentUser) return;
    _syncing = true;
    try {
        await Promise.all([
            syncSongs(_currentUser.id),
            syncSettings(_currentUser.id),
        ]);
        console.log('[SyncEngine] Sync complete');
    } catch (e) {
        console.error('[SyncEngine] syncAll failed:', e);
    } finally {
        _syncing = false;
    }
}

/**
 * SQL to run once in the Supabase SQL Editor:
 *
 * -- Songs table
 * CREATE TABLE user_songs (
 *   id TEXT PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users NOT NULL,
 *   name TEXT, artist TEXT, genre TEXT,
 *   difficulty INTEGER DEFAULT 0, bpm INTEGER DEFAULT 120,
 *   total_duration REAL DEFAULT 0, note_count INTEGER DEFAULT 0, track_count INTEGER DEFAULT 0,
 *   midi_data TEXT,  -- base64-encoded MIDI bytes
 *   added_at BIGINT, last_played_at BIGINT,
 *   play_count INTEGER DEFAULT 0, best_score INTEGER DEFAULT 0,
 *   favorite BOOLEAN DEFAULT FALSE, tags TEXT[] DEFAULT '{}',
 *   source TEXT DEFAULT 'local', community_id TEXT,
 *   file_size_bytes INTEGER DEFAULT 0,
 *   updated_at BIGINT NOT NULL
 * );
 * ALTER TABLE user_songs ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own songs" ON user_songs FOR ALL USING (auth.uid() = user_id);
 *
 * -- Settings table
 * CREATE TABLE user_settings (
 *   user_id UUID REFERENCES auth.users NOT NULL,
 *   key TEXT NOT NULL,
 *   value TEXT NOT NULL,  -- JSON-serialised
 *   updated_at BIGINT NOT NULL,
 *   PRIMARY KEY (user_id, key)
 * );
 * ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
 */
