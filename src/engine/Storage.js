/**
 * IndexedDB storage layer for PianoApp.
 * Stores: songs (MIDI files + metadata), progress, recordings, settings.
 */

const DB_NAME = 'pianoapp';
const DB_VERSION = 1;

const STORES = {
    SONGS: 'songs',
    PROGRESS: 'progress',
    RECORDINGS: 'recordings',
    SETTINGS: 'settings',
};

let db = null;

/**
 * Open the database (creates stores on first run)
 */
function openDB() {
    if (db) return Promise.resolve(db);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Songs store
            if (!database.objectStoreNames.contains(STORES.SONGS)) {
                const songStore = database.createObjectStore(STORES.SONGS, { keyPath: 'id' });
                songStore.createIndex('name', 'name', { unique: false });
                songStore.createIndex('artist', 'artist', { unique: false });
                songStore.createIndex('difficulty', 'difficulty', { unique: false });
                songStore.createIndex('addedAt', 'addedAt', { unique: false });
                songStore.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
            }

            // Progress store
            if (!database.objectStoreNames.contains(STORES.PROGRESS)) {
                const progressStore = database.createObjectStore(STORES.PROGRESS, { keyPath: 'id' });
                progressStore.createIndex('songId', 'songId', { unique: false });
                progressStore.createIndex('date', 'date', { unique: false });
            }

            // Recordings store
            if (!database.objectStoreNames.contains(STORES.RECORDINGS)) {
                const recStore = database.createObjectStore(STORES.RECORDINGS, { keyPath: 'id' });
                recStore.createIndex('songId', 'songId', { unique: false });
                recStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Settings store
            if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
                database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Generic CRUD helpers
 */
async function getStore(storeName, mode = 'readonly') {
    const database = await openDB();
    const tx = database.transaction(storeName, mode);
    return tx.objectStore(storeName);
}

async function put(storeName, data) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function get(storeName, key) {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getAll(storeName) {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function remove(storeName, key) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getAllByIndex(storeName, indexName, value) {
    const store = await getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
        const req = index.getAll(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// =================== SONGS ===================

export async function saveSong(songData) {
    const song = {
        id: songData.id || crypto.randomUUID(),
        name: songData.name || 'Untitled',
        artist: songData.artist || 'Unknown',
        genre: songData.genre || '',
        difficulty: songData.difficulty || 0,
        bpm: songData.bpm || 120,
        totalDuration: songData.totalDuration || 0,
        noteCount: songData.noteCount || 0,
        trackCount: songData.trackCount || 0,
        midiData: songData.midiData, // Raw ArrayBuffer
        addedAt: songData.addedAt || Date.now(),
        lastPlayedAt: songData.lastPlayedAt || null,
        playCount: songData.playCount || 0,
        bestScore: songData.bestScore || 0,
        favorite: songData.favorite || false,
        tags: songData.tags || [],
        source: songData.source || 'local',
        communityId: songData.communityId || null,
        fileSizeBytes: songData.fileSizeBytes || (songData.midiData ? songData.midiData.byteLength : 0)
    };
    await put(STORES.SONGS, song);
    return song;
}

export async function getSong(id) {
    return get(STORES.SONGS, id);
}

export async function getAllSongs() {
    return getAll(STORES.SONGS);
}

export async function deleteSong(id) {
    return remove(STORES.SONGS, id);
}

export async function updateSongMeta(id, updates) {
    const song = await getSong(id);
    if (!song) return null;
    const updated = { ...song, ...updates };
    await put(STORES.SONGS, updated);
    return updated;
}

// =================== PROGRESS ===================

export async function saveSession(sessionData) {
    const session = {
        id: crypto.randomUUID(),
        songId: sessionData.songId,
        songName: sessionData.songName || '',
        date: Date.now(),
        duration: sessionData.duration || 0,       // seconds practiced
        score: sessionData.score || 0,
        notesHit: sessionData.notesHit || 0,
        notesMissed: sessionData.notesMissed || 0,
        accuracy: sessionData.accuracy || 0,
        maxStreak: sessionData.maxStreak || 0,
        speed: sessionData.speed || 1,
        handMode: sessionData.handMode || 'both',
    };
    await put(STORES.PROGRESS, session);
    return session;
}

export async function getSessionsForSong(songId) {
    return getAllByIndex(STORES.PROGRESS, 'songId', songId);
}

export async function getAllSessions() {
    return getAll(STORES.PROGRESS);
}

export async function getProgressStats() {
    const sessions = await getAllSessions();

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;

    const todaySessions = sessions.filter(s => s.date >= todayStart);
    const weekSessions = sessions.filter(s => s.date >= weekStart);
    const monthSessions = sessions.filter(s => s.date >= monthStart);

    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const todayTime = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const weekTime = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    // Daily streak calculation
    const daySet = new Set(sessions.map(s => new Date(s.date).toDateString()));
    let streak = 0;
    const day = new Date();
    while (daySet.has(day.toDateString())) {
        streak++;
        day.setDate(day.getDate() - 1);
    }

    // Activity heatmap (last 90 days)
    const heatmap = {};
    for (let i = 0; i < 90; i++) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        heatmap[key] = 0;
    }
    sessions.forEach(s => {
        const key = new Date(s.date).toISOString().split('T')[0];
        if (heatmap[key] !== undefined) {
            heatmap[key] += s.duration || 0;
        }
    });

    return {
        totalSessions: sessions.length,
        totalTime,
        todayTime,
        weekTime,
        streak,
        avgScore: sessions.length > 0
            ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length)
            : 0,
        bestScore: sessions.length > 0
            ? Math.max(...sessions.map(s => s.score || 0))
            : 0,
        heatmap,
        recentSessions: sessions.sort((a, b) => b.date - a.date).slice(0, 20),
    };
}

// =================== RECORDINGS ===================

export async function saveRecording(recordingData) {
    const recording = {
        id: crypto.randomUUID(),
        songId: recordingData.songId || null,
        songName: recordingData.songName || 'Free Play',
        createdAt: Date.now(),
        duration: recordingData.duration || 0,
        events: recordingData.events || [],  // Array of { time, type, midi, velocity }
        score: recordingData.score || 0,
    };
    await put(STORES.RECORDINGS, recording);
    return recording;
}

export async function getRecording(id) {
    return get(STORES.RECORDINGS, id);
}

export async function getAllRecordings() {
    return getAll(STORES.RECORDINGS);
}

export async function deleteRecording(id) {
    return remove(STORES.RECORDINGS, id);
}

export async function getRecordingsForSong(songId) {
    return getAllByIndex(STORES.RECORDINGS, 'songId', songId);
}

// =================== SETTINGS ===================

export async function saveSetting(key, value) {
    return put(STORES.SETTINGS, { key, value });
}

export async function getSetting(key, defaultValue = null) {
    const result = await get(STORES.SETTINGS, key);
    return result ? result.value : defaultValue;
}

export { STORES };
