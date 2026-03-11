import React, { useState, useEffect, useCallback } from 'react';
import { getAllSongs, saveSong, deleteSong, updateSongMeta } from '../../engine/Storage';
import { getCommunityFeed, saveCommunityToLibrary, rateSong, reportSong, getUser } from '../../engine/SupabaseClient';
import { useUserTier } from '../../hooks/useUserTier';
import CommunityUploadModal from '../CommunityUploadModal';
import './Library.css';
import './Library-tabs.css';

/**
 * Song library view with grid/list modes, search, filters, and favorites.
 */
export default function Library({
    isOpen,
    onClose,
    onSelectSong,
    currentSongId,
}) {
    const [songs, setSongs] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('addedAt');
    const [loading, setLoading] = useState(false);

    // Editing state
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', artist: '' });

    // Community State
    const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'community'
    const [communitySongs, setCommunitySongs] = useState([]);
    const [communityFilters, setCommunityFilters] = useState({ search: '', sortBy: 'popular' });
    const [communitySort, setCommunitySort] = useState('popular');
    const [loadingCommunity, setLoadingCommunity] = useState(false);
    const [uploadingSong, setUploadingSong] = useState(null);
    const [toast, setToast] = useState(null); // { msg, type: 'ok' | 'err' }
    const [ratingFor, setRatingFor] = useState(null); // songId being rated
    const [currentUser, setCurrentUser] = useState(null);
    const [savingId, setSavingId] = useState(null); // community songId being saved

    // Quotas / Tier
    const { isSupporter, tier } = useUserTier();

    // Load current user
    useEffect(() => {
        getUser().then(setCurrentUser);
    }, [isOpen]);

    const showToast = useCallback((msg, type = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const loadSongs = useCallback(async () => {
        setLoading(true);
        const allSongs = await getAllSongs();
        setSongs(allSongs);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (isOpen && activeTab === 'personal') loadSongs();
    }, [isOpen, activeTab, loadSongs]);

    const loadCommunity = useCallback(async () => {
        setLoadingCommunity(true);
        const results = await getCommunityFeed({ ...communityFilters, sortBy: communitySort });
        setCommunitySongs(results);
        setLoadingCommunity(false);
    }, [communityFilters, communitySort]);

    useEffect(() => {
        if (isOpen && activeTab === 'community') loadCommunity();
    }, [isOpen, activeTab, loadCommunity]);

    // Import MIDI file to library
    const handleImport = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mid,.midi';
        input.multiple = true;
        input.onchange = async (e) => {
            for (const file of e.target.files) {
                const buffer = await file.arrayBuffer();
                const { Midi } = await import('@tonejs/midi');
                const midi = new Midi(buffer);

                await saveSong({
                    name: midi.name || file.name.replace(/\.(mid|midi)$/i, ''),
                    bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                    totalDuration: midi.duration,
                    noteCount: midi.tracks.reduce((sum, t) => sum + t.notes.length, 0),
                    trackCount: midi.tracks.filter(t => t.notes.length > 0).length,
                    midiData: buffer,
                });
            }
            loadSongs();
        };
        input.click();
    }, [loadSongs]);

    const handleToggleFavorite = useCallback(async (id, currentFav) => {
        await updateSongMeta(id, { favorite: !currentFav });
        loadSongs();
    }, [loadSongs]);

    const handleDelete = useCallback(async (id) => {
        await deleteSong(id);
        loadSongs();
    }, [loadSongs]);

    const handleSaveEdit = useCallback(async (id) => {
        await updateSongMeta(id, {
            name: editForm.name.trim() || 'Untitled',
            artist: editForm.artist.trim() || 'Unknown'
        });
        setEditingId(null);
        loadSongs();
    }, [editForm, loadSongs]);

    const handleSetDifficulty = useCallback(async (id, level) => {
        await updateSongMeta(id, { difficulty: level });
        loadSongs();
    }, [loadSongs]);

    // Save a community song to local library and load it
    const handleSaveCommunityToLibrary = useCallback(async (song) => {
        if (!currentUser) {
            showToast('Sign in to save songs to your library', 'err');
            return;
        }
        if (savingId === song.id) return;
        setSavingId(song.id);
        try {
            const { buffer } = await saveCommunityToLibrary(song.id);
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(buffer);
            await saveSong({
                name: song.title,
                artist: song.composer,
                genre: song.genre,
                difficulty: song.difficulty,
                bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                totalDuration: midi.duration,
                noteCount: midi.tracks.reduce((sum, t) => sum + t.notes.length, 0),
                trackCount: midi.tracks.filter(t => t.notes.length > 0).length,
                midiData: buffer,
                source: 'community',
                communityId: song.id,
            });
            showToast(`"${song.title}" saved to your Library!`);
            loadSongs();
        } catch (err) {
            showToast(err.message || 'Error saving song', 'err');
        } finally {
            setSavingId(null);
        }
    }, [currentUser, savingId, showToast, loadSongs]);

    // Click on community song card → download + load into player
    const handlePlayCommunity = useCallback(async (song) => {
        if (ratingFor) return; // ignore click when rating picker is open
        try {
            // Check if we already have this community song locally
            const existing = songs.find(s => s.communityId === song.id);
            if (existing) {
                onSelectSong(existing);
                onClose();
                return;
            }

            const { buffer } = await saveCommunityToLibrary(song.id);
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(buffer);
            const saved = await saveSong({
                name: song.title,
                artist: song.composer,
                genre: song.genre,
                difficulty: song.difficulty,
                bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                totalDuration: midi.duration,
                noteCount: midi.tracks.reduce((sum, t) => sum + t.notes.length, 0),
                trackCount: midi.tracks.filter(t => t.notes.length > 0).length,
                midiData: buffer,
                source: 'community',
                communityId: song.id,
            });
            onSelectSong(saved);
            onClose();
        } catch (err) {
            showToast(err.message || 'Failed to load song', 'err');
        }
    }, [ratingFor, songs, onSelectSong, onClose, showToast]);

    // Rate a community song
    const handleRate = useCallback(async (songId, stars) => {
        if (!currentUser) {
            showToast('Sign in to rate songs', 'err');
            setRatingFor(null);
            return;
        }
        try {
            await rateSong(songId, stars);
            showToast(`Rated ${stars} ⭐`);
            setRatingFor(null);
            loadCommunity();
        } catch (err) {
            showToast(err.message || 'Error submitting rating', 'err');
        }
    }, [currentUser, showToast, loadCommunity]);

    // Filter and sort (personal)
    const filteredSongs = songs
        .filter(s => {
            if (search) {
                const q = search.toLowerCase();
                return (s.name || '').toLowerCase().includes(q) ||
                    (s.artist || '').toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'name': return (a.name || '').localeCompare(b.name || '');
                case 'lastPlayedAt': return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
                case 'difficulty': return (a.difficulty || 0) - (b.difficulty || 0);
                default: return (b.addedAt || 0) - (a.addedAt || 0);
            }
        });

    const formatDuration = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const difficultyStars = (level) => {
        return '★'.repeat(level || 0) + '☆'.repeat(5 - (level || 0));
    };

    if (!isOpen) return null;

    return (
        <div className="library-overlay" onClick={onClose}>
            <div className="library-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="library-header">
                    <h2>Song Library</h2>
                    <div className="library-actions">
                        <button className="lib-btn import-btn" onClick={handleImport}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Import MIDI
                        </button>
                        <button className="lib-btn close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="library-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
                        onClick={() => setActiveTab('personal')}
                    >
                        My Library
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'community' ? 'active' : ''}`}
                        onClick={() => setActiveTab('community')}
                    >
                        Community
                    </button>
                </div>

                {/* Toolbar */}
                <div className="library-toolbar">
                    <div className="search-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder={activeTab === 'personal' ? "Search your songs..." : "Search community..."}
                            value={activeTab === 'personal' ? search : communityFilters.search}
                            onChange={(e) => {
                                if (activeTab === 'personal') {
                                    setSearch(e.target.value);
                                } else {
                                    setCommunityFilters(prev => ({ ...prev, search: e.target.value }));
                                }
                            }}
                        />
                    </div>

                    <div className="toolbar-group">
                        {activeTab === 'personal' ? (
                            <select
                                className="sort-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="addedAt">Recent</option>
                                <option value="name">Name</option>
                                <option value="lastPlayedAt">Last Played</option>
                                <option value="difficulty">Difficulty</option>
                            </select>
                        ) : (
                            <select
                                className="sort-select"
                                value={communitySort}
                                onChange={(e) => setCommunitySort(e.target.value)}
                            >
                                <option value="popular">Popular</option>
                                <option value="recent">Recent</option>
                            </select>
                        )}

                        <div className="view-toggle">
                            <button
                                className={viewMode === 'grid' ? 'active' : ''}
                                onClick={() => setViewMode('grid')}
                                title="Grid view"
                            >⊞</button>
                            <button
                                className={viewMode === 'list' ? 'active' : ''}
                                onClick={() => setViewMode('list')}
                                title="List view"
                            >☰</button>
                        </div>
                    </div>
                </div>

                {/* Hint */}
                <div className="library-hint">
                    {activeTab === 'personal'
                        ? '💡 Hover over a song and click ✎ to edit metadata'
                        : currentUser
                            ? '🌐 Click a song to play it · ↓ to save · ⭐ to rate'
                            : '🌐 Sign in to upload, rate, and save community songs'}
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`library-toast ${toast.type === 'err' ? 'toast-err' : 'toast-ok'}`}>
                        {toast.type === 'ok' ? '✓' : '✕'} {toast.msg}
                    </div>
                )}

                {/* Songs */}
                <div className={`library-content ${viewMode}`}>
                    {activeTab === 'personal' ? (
                        loading ? (
                            <div className="library-empty">Loading...</div>
                        ) : filteredSongs.length === 0 ? (
                            <div className="library-empty">
                                <span className="empty-icon">🎵</span>
                                <span>No songs yet</span>
                                <span className="empty-hint">Import MIDI files to build your library</span>
                            </div>
                        ) : (
                            filteredSongs.map(song => (
                                <div
                                    key={song.id}
                                    className={`song-card ${currentSongId === song.id ? 'active' : ''}`}
                                    onClick={() => {
                                        if (editingId !== song.id) {
                                            onSelectSong(song);
                                        }
                                    }}
                                >
                                    <div className="song-card-top">
                                        <div className="song-info">
                                            {editingId === song.id ? (
                                                <>
                                                    <input
                                                        className="editable-input song-name"
                                                        value={editForm.name}
                                                        placeholder="Song Title"
                                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveEdit(song.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <input
                                                        className="editable-input song-artist"
                                                        value={editForm.artist}
                                                        placeholder="Artist"
                                                        onChange={e => setEditForm(prev => ({ ...prev, artist: e.target.value }))}
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveEdit(song.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <span className="song-name" title={song.name}>{song.name || 'Untitled'}</span>
                                                    <span className="song-artist" title={song.artist}>
                                                        {song.artist || 'Unknown'}
                                                        {song.source === 'community' && <span className="source-badge">🌐</span>}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="song-actions-top">
                                            {editingId === song.id ? (
                                                <button
                                                    className="edit-action-btn save"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSaveEdit(song.id);
                                                    }}
                                                    title="Save"
                                                >
                                                    ✓
                                                </button>
                                            ) : (
                                                <button
                                                    className="edit-action-btn edit"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingId(song.id);
                                                        setEditForm({ name: song.name || '', artist: song.artist || '' });
                                                    }}
                                                    title="Edit Metadata"
                                                >
                                                    ✎
                                                </button>
                                            )}
                                            <button
                                                className={`fav-btn ${song.favorite ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleFavorite(song.id, song.favorite);
                                                }}
                                            >
                                                {song.favorite ? '★' : '☆'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="song-meta">
                                        <span>{formatDuration(song.totalDuration)}</span>
                                        <span>{Math.round(song.bpm)} BPM</span>
                                        <span>{song.noteCount} notes</span>
                                    </div>

                                    <div className="song-card-bottom">
                                        <div
                                            className="song-difficulty"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const next = ((song.difficulty || 0) % 5) + 1;
                                                handleSetDifficulty(song.id, next);
                                            }}
                                        >
                                            {difficultyStars(song.difficulty)}
                                        </div>
                                        {song.bestScore > 0 && (
                                            <span className="song-score">Best: {song.bestScore}%</span>
                                        )}
                                        <button
                                            className="cloud-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUploadingSong(song);
                                            }}
                                            title="Submit to Community"
                                        >
                                            ☁️
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(song.id);
                                            }}
                                            title="Remove from library"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M3 6.52381C3 6.12932 3.32671 5.80952 3.72973 5.80952H8.51787C8.52437 4.9683 8.61554 3.81504 9.45037 3.01668C10.1074 2.38839 11.0081 2 12 2C12.9919 2 13.8926 2.38839 14.5496 3.01668C15.3844 3.81504 15.4756 4.9683 15.4821 5.80952H20.2703C20.6733 5.80952 21 6.12932 21 6.52381C21 6.9183 20.6733 7.2381 20.2703 7.2381H3.72973C3.32671 7.2381 3 6.9183 3 6.52381Z" fill="currentColor" />
                                                <path fillRule="evenodd" clipRule="evenodd" d="M11.5956 22H12.4044C15.1871 22 16.5785 22 17.4831 21.1141C18.3878 20.2281 18.4803 18.7749 18.6654 15.8685L18.9321 11.6806C19.0326 10.1036 19.0828 9.31511 18.6289 8.81545C18.1751 8.31579 17.4087 8.31579 15.876 8.31579H8.12404C6.59127 8.31579 5.82488 8.31579 5.37105 8.81545C4.91722 9.31511 4.96744 10.1036 5.06788 11.6806L5.33459 15.8685C5.5197 18.7749 5.61225 20.2281 6.51689 21.1141C7.42153 22 8.81289 22 11.5956 22ZM10.2463 12.1885C10.2051 11.7546 9.83753 11.4381 9.42537 11.4815C9.01321 11.5249 8.71251 11.9117 8.75372 12.3456L9.25372 17.6087C9.29494 18.0426 9.66247 18.3591 10.0746 18.3157C10.4868 18.2724 10.7875 17.8855 10.7463 17.4516L10.2463 12.1885ZM14.5746 11.4815C14.9868 11.5249 15.2875 11.9117 15.2463 12.3456L14.7463 17.6087C14.7051 18.0426 14.3375 18.3591 13.9254 18.3157C13.5132 18.2724 13.2125 17.8855 13.2537 17.4516L13.7537 12.1885C13.7949 11.7546 14.1625 11.4381 14.5746 11.4815Z" fill="currentColor" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        /* Community Tab */
                        loadingCommunity ? (
                            <div className="library-empty">Loading community...</div>
                        ) : communitySongs.length === 0 ? (
                            <div className="library-empty">
                                <span className="empty-icon">🌐</span>
                                <span>No community songs found</span>
                            </div>
                        ) : (
                            communitySongs.map(song => (
                                <div
                                    key={song.id}
                                    className="song-card community-card"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handlePlayCommunity(song)}
                                >
                                    <div className="song-card-top">
                                        <div className="song-info">
                                            <span className="song-name" title={song.title}>{song.title}</span>
                                            <span className="song-artist" title={song.composer}>
                                                {song.composer}
                                                {song.profiles?.tier === 'supporter' && <span className="supporter-badge">♥</span>}
                                            </span>
                                        </div>
                                        <div className="song-actions-top">
                                            {/* Star rating picker */}
                                            {ratingFor === song.id ? (
                                                <div className="star-picker" onClick={e => e.stopPropagation()}>
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <button
                                                            key={n}
                                                            className="star-pick-btn"
                                                            onClick={() => handleRate(song.id, n)}
                                                            title={`${n} star${n > 1 ? 's' : ''}`}
                                                        >
                                                            ★
                                                        </button>
                                                    ))}
                                                    <button
                                                        className="star-pick-btn cancel"
                                                        onClick={() => setRatingFor(null)}
                                                        title="Cancel"
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="rate-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRatingFor(song.id);
                                                    }}
                                                    title="Rate this song"
                                                >
                                                    ★ {(song.rating_avg || 0).toFixed(1)}
                                                </button>
                                            )}
                                            <button
                                                className="cloud-btn save"
                                                disabled={savingId === song.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveCommunityToLibrary(song);
                                                }}
                                                title="Save to Library"
                                            >
                                                {savingId === song.id ? '…' : `↓ ${song.save_count || 0}`}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="song-meta">
                                        <span>{song.genre || 'Various'}</span>
                                        <span>Level: {song.difficulty || 0}</span>
                                    </div>

                                    <div className="song-card-bottom">
                                        <span className="song-score">▶ {song.play_count || 0} plays</span>
                                        <button
                                            className="report-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const reason = prompt("Reason for reporting?");
                                                if (reason) reportSong(song.id, reason);
                                            }}
                                            title="Report Flag"
                                        >
                                            ⚑
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="library-footer">
                    <span>{activeTab === 'personal' ? filteredSongs.length : communitySongs.length} songs</span>
                </div>
            </div>

            {uploadingSong && (
                <CommunityUploadModal
                    song={uploadingSong}
                    onClose={() => setUploadingSong(null)}
                    onSuccess={() => {
                        setUploadingSong(null);
                        setActiveTab('community');
                        loadCommunity();
                    }}
                />
            )}

        </div>
    );
}
