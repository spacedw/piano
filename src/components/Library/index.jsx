import React, { useState, useEffect, useCallback } from 'react';
import { getAllSongs, saveSong, deleteSong, updateSongMeta } from '@/engine/Storage';
import { getCommunityFeed, saveCommunityToLibrary, rateSong, reportSong, getUser } from '@/engine/SupabaseClient';
import { useUserTier } from '@/hooks/useUserTier';
import CommunityUploadModal from '@/components/CommunityUploadModal';
import { useT } from '@/i18n';
import styles from './index.module.css';

/**
 * Song library view with grid/list modes, search, filters, and favorites.
 */
export default function Library({ isOpen, onClose, onSelectSong, currentSongId }) {
    const [songs, setSongs] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('addedAt');
    const [loading, setLoading] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', artist: '' });

    const [activeTab, setActiveTab] = useState('personal');
    const [communitySongs, setCommunitySongs] = useState([]);
    const [communityFilters, setCommunityFilters] = useState({ search: '', sortBy: 'popular' });
    const [communitySort, setCommunitySort] = useState('popular');
    const [loadingCommunity, setLoadingCommunity] = useState(false);
    const [uploadingSong, setUploadingSong] = useState(null);
    const [toast, setToast] = useState(null);
    const [ratingFor, setRatingFor] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const { isSupporter } = useUserTier();
    const t = useT();

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
            artist: editForm.artist.trim() || 'Unknown',
        });
        setEditingId(null);
        loadSongs();
    }, [editForm, loadSongs]);

    const handleSetDifficulty = useCallback(async (id, level) => {
        await updateSongMeta(id, { difficulty: level });
        loadSongs();
    }, [loadSongs]);

    const handleSaveCommunityToLibrary = useCallback(async (song) => {
        if (!currentUser) { showToast(t('library.signInToSave'), 'err'); return; }
        if (savingId === song.id) return;
        setSavingId(song.id);
        try {
            const { buffer } = await saveCommunityToLibrary(song.id);
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(buffer);
            await saveSong({
                name: song.title, artist: song.composer, genre: song.genre,
                difficulty: song.difficulty,
                bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                totalDuration: midi.duration,
                noteCount: midi.tracks.reduce((sum, t) => sum + t.notes.length, 0),
                trackCount: midi.tracks.filter(t => t.notes.length > 0).length,
                midiData: buffer, source: 'community', communityId: song.id,
            });
            showToast(t('library.savedToLibrary', { name: song.title }));
            loadSongs();
        } catch (err) {
            showToast(err.message || 'Error saving song', 'err');
        } finally {
            setSavingId(null);
        }
    }, [currentUser, savingId, showToast, loadSongs]);

    const handlePlayCommunity = useCallback(async (song) => {
        if (ratingFor) return;
        try {
            const existing = songs.find(s => s.communityId === song.id);
            if (existing) { onSelectSong(existing); onClose(); return; }
            const { buffer } = await saveCommunityToLibrary(song.id);
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(buffer);
            const saved = await saveSong({
                name: song.title, artist: song.composer, genre: song.genre,
                difficulty: song.difficulty,
                bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                totalDuration: midi.duration,
                noteCount: midi.tracks.reduce((sum, t) => sum + t.notes.length, 0),
                trackCount: midi.tracks.filter(t => t.notes.length > 0).length,
                midiData: buffer, source: 'community', communityId: song.id,
            });
            onSelectSong(saved);
            onClose();
        } catch (err) {
            showToast(err.message || 'Failed to load song', 'err');
        }
    }, [ratingFor, songs, onSelectSong, onClose, showToast]);

    const handleRate = useCallback(async (songId, stars) => {
        if (!currentUser) { showToast(t('library.signInToRate'), 'err'); setRatingFor(null); return; }
        try {
            await rateSong(songId, stars);
            showToast(t('library.rated', { stars }));
            setRatingFor(null);
            loadCommunity();
        } catch (err) {
            showToast(err.message || 'Error submitting rating', 'err');
        }
    }, [currentUser, showToast, loadCommunity]);

    const filteredSongs = songs
        .filter(s => {
            if (search) {
                const q = search.toLowerCase();
                return (s.name || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q);
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

    const difficultyStars = (level) => '★'.repeat(level || 0) + '☆'.repeat(5 - (level || 0));

    if (!isOpen) return null;

    return (
        <div className={styles.libraryOverlay} onClick={onClose}>
            <div className={styles.libraryPanel} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.libraryHeader}>
                    <h2>{t('library.title')}</h2>
                    <div className={styles.libraryActions}>
                        <button className={`${styles.libBtn} ${styles.importBtn}`} onClick={handleImport}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            {t('library.importMidi')}
                        </button>
                        <button className={`${styles.libBtn} ${styles.closeBtn}`} onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className={styles.libraryTabs}>
                    <button className={`${styles.tabBtn} ${activeTab === 'personal' ? styles.active : ''}`} onClick={() => setActiveTab('personal')}>{t('library.myLibrary')}</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'community' ? styles.active : ''}`} onClick={() => setActiveTab('community')}>{t('library.community')}</button>
                </div>

                {/* Toolbar */}
                <div className={styles.libraryToolbar}>
                    <div className={styles.searchBox}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder={activeTab === 'personal' ? t('library.searchPersonal') : t('library.searchCommunity')}
                            value={activeTab === 'personal' ? search : communityFilters.search}
                            onChange={(e) => {
                                if (activeTab === 'personal') setSearch(e.target.value);
                                else setCommunityFilters(prev => ({ ...prev, search: e.target.value }));
                            }}
                        />
                    </div>
                    <div className={styles.toolbarGroup}>
                        {activeTab === 'personal' ? (
                            <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                <option value="addedAt">{t('library.sortRecent')}</option>
                                <option value="name">{t('library.sortName')}</option>
                                <option value="lastPlayedAt">{t('library.sortLastPlayed')}</option>
                                <option value="difficulty">{t('library.sortDifficulty')}</option>
                            </select>
                        ) : (
                            <select className={styles.sortSelect} value={communitySort} onChange={(e) => setCommunitySort(e.target.value)}>
                                <option value="popular">{t('library.sortPopular')}</option>
                                <option value="recent">{t('library.sortRecent')}</option>
                            </select>
                        )}
                        <div className={styles.viewToggle}>
                            <button className={viewMode === 'grid' ? styles.active : ''} onClick={() => setViewMode('grid')}>⊞</button>
                            <button className={viewMode === 'list' ? styles.active : ''} onClick={() => setViewMode('list')}>☰</button>
                        </div>
                    </div>
                </div>

                {/* Hint */}
                <div className={styles.libraryHint}>
                    {activeTab === 'personal'
                        ? t('library.hintPersonal')
                        : currentUser
                            ? t('library.hintCommunity')
                            : t('library.hintSignIn')}
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`${styles.libraryToast} ${toast.type === 'err' ? styles.toastErr : styles.toastOk}`}>
                        {toast.type === 'ok' ? '✓' : '✕'} {toast.msg}
                    </div>
                )}

                {/* Songs */}
                <div className={`${styles.libraryContent} ${viewMode === 'grid' ? styles.grid : styles.list}`}>
                    {activeTab === 'personal' ? (
                        loading ? (
                            <div className={styles.libraryEmpty}>{t('library.loading')}</div>
                        ) : filteredSongs.length === 0 ? (
                            <div className={styles.libraryEmpty}>
                                <span className={styles.emptyIcon}>🎵</span>
                                <span>{t('library.noSongs')}</span>
                                <span className={styles.emptyHint}>{t('library.noSongsHint')}</span>
                            </div>
                        ) : (
                            filteredSongs.map(song => (
                                <div
                                    key={song.id}
                                    className={`${styles.songCard} ${currentSongId === song.id ? styles.active : ''}`}
                                    onClick={() => { if (editingId !== song.id) onSelectSong(song); }}
                                >
                                    <div className={styles.songCardTop}>
                                        <div className={styles.songInfo}>
                                            {editingId === song.id ? (
                                                <>
                                                    <input
                                                        className={`${styles.editableInput} ${styles.songName}`}
                                                        value={editForm.name} placeholder={t('library.placeholderTitle')}
                                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveEdit(song.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <input
                                                        className={`${styles.editableInput} ${styles.songArtist}`}
                                                        value={editForm.artist} placeholder={t('library.placeholderArtist')}
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
                                                    <span className={styles.songName} title={song.name}>{song.name || t('library.untitled')}</span>
                                                    <span className={styles.songArtist} title={song.artist}>
                                                        {song.artist || t('library.unknown')}
                                                        {song.source === 'community' && <span className={styles.sourceBadge}>🌐</span>}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className={styles.songActionsTop}>
                                            {editingId === song.id ? (
                                                <button className={`${styles.editActionBtn} ${styles.save}`} onClick={e => { e.stopPropagation(); handleSaveEdit(song.id); }}>✓</button>
                                            ) : (
                                                <button className={styles.editActionBtn} onClick={e => {
                                                    e.stopPropagation();
                                                    setEditingId(song.id);
                                                    setEditForm({ name: song.name || '', artist: song.artist || '' });
                                                }}>✎</button>
                                            )}
                                            <button
                                                className={`${styles.favBtn} ${song.favorite ? styles.active : ''}`}
                                                onClick={e => { e.stopPropagation(); handleToggleFavorite(song.id, song.favorite); }}
                                            >
                                                {song.favorite ? '★' : '☆'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.songMeta}>
                                        <span>{formatDuration(song.totalDuration)}</span>
                                        <span>{Math.round(song.bpm)} BPM</span>
                                        <span>{t('library.notes', { count: song.noteCount })}</span>
                                    </div>

                                    <div className={styles.songCardBottom}>
                                        <div
                                            className={styles.songDifficulty}
                                            onClick={e => {
                                                e.stopPropagation();
                                                handleSetDifficulty(song.id, ((song.difficulty || 0) % 5) + 1);
                                            }}
                                        >
                                            {difficultyStars(song.difficulty)}
                                        </div>
                                        {song.bestScore > 0 && <span className={styles.songScore}>{t('library.best', { score: song.bestScore })}</span>}
                                        <button className={styles.cloudBtn} onClick={e => { e.stopPropagation(); setUploadingSong(song); }} title={t('library.submitToCommunity')}>☁️</button>
                                        <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); handleDelete(song.id); }} title={t('library.removeFromLibrary')}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M3 6.52381C3 6.12932 3.32671 5.80952 3.72973 5.80952H8.51787C8.52437 4.9683 8.61554 3.81504 9.45037 3.01668C10.1074 2.38839 11.0081 2 12 2C12.9919 2 13.8926 2.38839 14.5496 3.01668C15.3844 3.81504 15.4756 4.9683 15.4821 5.80952H20.2703C20.6733 5.80952 21 6.12932 21 6.52381C21 6.9183 20.6733 7.2381 20.2703 7.2381H3.72973C3.32671 7.2381 3 6.9183 3 6.52381Z" fill="currentColor" />
                                                <path fillRule="evenodd" clipRule="evenodd" d="M11.5956 22H12.4044C15.1871 22 16.5785 22 17.4831 21.1141C18.3878 20.2281 18.4803 18.7749 18.6654 15.8685L18.9321 11.6806C19.0326 10.1036 19.0828 9.31511 18.6289 8.81545C18.1751 8.31579 17.4087 8.31579 15.876 8.31579H8.12404C6.59127 8.31579 5.82488 8.31579 5.37105 8.81545C4.91722 9.31511 4.96744 10.1036 5.06788 11.6806L5.33459 15.8685C5.5197 18.7749 5.61225 20.2281 6.51689 21.1141C7.42153 22 8.81289 22 11.5956 22Z" fill="currentColor" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        loadingCommunity ? (
                            <div className={styles.libraryEmpty}>{t('library.loadingCommunity')}</div>
                        ) : communitySongs.length === 0 ? (
                            <div className={styles.libraryEmpty}>
                                <span className={styles.emptyIcon}>🌐</span>
                                <span>{t('library.noCommunity')}</span>
                            </div>
                        ) : (
                            communitySongs.map(song => (
                                <div key={song.id} className={`${styles.songCard} ${styles.communityCard}`} onClick={() => handlePlayCommunity(song)}>
                                    <div className={styles.songCardTop}>
                                        <div className={styles.songInfo}>
                                            <span className={styles.songName} title={song.title}>{song.title}</span>
                                            <span className={styles.songArtist}>
                                                {song.composer}
                                                {song.profiles?.tier === 'supporter' && <span className={styles.supporterBadge}>♥</span>}
                                            </span>
                                        </div>
                                        <div className={styles.songActionsTop}>
                                            {ratingFor === song.id ? (
                                                <div className={styles.starPicker} onClick={e => e.stopPropagation()}>
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <button key={n} className={styles.starPickBtn} onClick={() => handleRate(song.id, n)}>★</button>
                                                    ))}
                                                    <button className={`${styles.starPickBtn} ${styles.cancel}`} onClick={() => setRatingFor(null)}>✕</button>
                                                </div>
                                            ) : (
                                                <button className={styles.rateBtn} onClick={e => { e.stopPropagation(); setRatingFor(song.id); }}>
                                                    ★ {(song.rating_avg || 0).toFixed(1)}
                                                </button>
                                            )}
                                            <button
                                                className={`${styles.cloudBtn} ${styles.save}`}
                                                disabled={savingId === song.id}
                                                onClick={e => { e.stopPropagation(); handleSaveCommunityToLibrary(song); }}
                                            >
                                                {savingId === song.id ? '…' : `↓ ${song.save_count || 0}`}
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.songMeta}>
                                        <span>{song.genre || t('library.various')}</span>
                                        <span>{t('library.levelLabel', { level: song.difficulty || 0 })}</span>
                                    </div>
                                    <div className={styles.songCardBottom}>
                                        <span className={styles.songScore}>{t('library.plays', { count: song.play_count || 0 })}</span>
                                        <button className={styles.reportBtn} onClick={e => {
                                            e.stopPropagation();
                                            const reason = prompt(t('library.reportReason'));
                                            if (reason) reportSong(song.id, reason);
                                        }}>⚑</button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* Footer */}
                <div className={styles.libraryFooter}>
                    <span>{activeTab === 'personal' ? t('library.songCount', { count: filteredSongs.length }) : t('library.songCount', { count: communitySongs.length })}</span>
                </div>
            </div>

            {uploadingSong && (
                <CommunityUploadModal
                    song={uploadingSong}
                    onClose={() => setUploadingSong(null)}
                    onSuccess={() => { setUploadingSong(null); setActiveTab('community'); loadCommunity(); }}
                />
            )}
        </div>
    );
}
