import React, { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { getAllSongs, saveSong, deleteSong, updateSongMeta } from '@/engine/Storage';
import { getCommunityFeed, saveCommunityToLibrary, rateSong, reportSong, getUser } from '@/engine/SupabaseClient';
import { useUserTier } from '@/hooks/useUserTier';
import CommunityUploadModal from '@/components/CommunityUploadModal';
import * as I from '@/components/Icons';
import { Stars, Difficulty, Avatar, Tabs, Modal, SectionTitle, Pill } from '@/components/ui';
import { useT, useLocale } from '@/i18n';
import styles from './index.module.css';

/* ── Cover gradient colors ─────────────────────── */
const COVER_GRADIENTS = [
    ['#2A1F0E', '#1A1408'], ['#1A0E24', '#0E0A18'], ['#0E1A24', '#08121A'],
    ['#241A0E', '#180E08'], ['#0E240E', '#081A08'], ['#24120E', '#180A08'],
];
function coverGradient(title) {
    const idx = (title || '').charCodeAt(0) % COVER_GRADIENTS.length;
    const [a, b] = COVER_GRADIENTS[idx];
    return `linear-gradient(135deg, ${a}, ${b})`;
}

/**
 * Song library view with grid/list modes, search, filters, favorites,
 * drag-and-drop import, community tab with feed, detail modal, upload.
 */
export default function Library({ onSelectSong, currentSongId }) {
    const [songs, setSongs] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('addedAt');
    const [filterDiff, setFilterDiff] = useState(0);
    const [favOnly, setFavOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

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
    const [communityDetail, setCommunityDetail] = useState(null);
    const [communityRating, setCommunityRating] = useState(0);
    const [listMenuId, setListMenuId] = useState(null);
    const { isSupporter } = useUserTier();
    const t = useT();
    const { locale: language } = useLocale();
    const tl = (es, en) => language === 'es' ? es : en;
    const dropRef = useRef(null);

    useEffect(() => {
        getUser().then(setCurrentUser).catch(() => {});
    }, []);

    const showToast = useCallback((msg, type = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const loadSongs = useCallback(async () => {
        setLoading(true);
        try {
            const allSongs = await getAllSongs();
            setSongs(allSongs);
        } catch {
            setSongs([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (activeTab === 'personal') loadSongs();
    }, [activeTab, loadSongs]);

    const loadCommunity = useCallback(async () => {
        setLoadingCommunity(true);
        try {
            const results = await getCommunityFeed({ ...communityFilters, sortBy: communitySort });
            setCommunitySongs(results || []);
        } catch {
            setCommunitySongs([]);
        }
        setLoadingCommunity(false);
    }, [communityFilters, communitySort]);

    useEffect(() => {
        if (activeTab === 'community') loadCommunity();
    }, [activeTab, loadCommunity]);

    /* ── Import logic ──────────────────────────── */
    const processFiles = useCallback(async (files) => {
        for (const file of files) {
            if (!file.name.match(/\.(mid|midi)$/i)) continue;
            const buffer = await file.arrayBuffer();
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(buffer);
            await saveSong({
                name: midi.name || file.name.replace(/\.(mid|midi)$/i, ''),
                bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                totalDuration: midi.duration,
                noteCount: midi.tracks.reduce((sum, tr) => sum + tr.notes.length, 0),
                trackCount: midi.tracks.filter(tr => tr.notes.length > 0).length,
                midiData: buffer,
            });
        }
        loadSongs();
    }, [loadSongs]);

    const handleImport = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mid,.midi';
        input.multiple = true;
        input.onchange = (e) => processFiles(e.target.files);
        input.click();
    }, [processFiles]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
    }, [processFiles]);

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
                noteCount: midi.tracks.reduce((sum, tr) => sum + tr.notes.length, 0),
                trackCount: midi.tracks.filter(tr => tr.notes.length > 0).length,
                midiData: buffer, source: 'community', communityId: song.id,
            });
            showToast(t('library.savedToLibrary', { name: song.title }));
            loadSongs();
        } catch (err) {
            showToast(err.message || 'Error saving song', 'err');
        } finally {
            setSavingId(null);
        }
    }, [currentUser, savingId, showToast, loadSongs, t]);

    const handlePlayCommunity = useCallback(async (song) => {
        if (ratingFor) return;
        try {
            const existing = songs.find(s => s.communityId === song.id);
            if (existing) { onSelectSong(existing); return; }
            const { buffer } = await saveCommunityToLibrary(song.id);
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(buffer);
            const saved = await saveSong({
                name: song.title, artist: song.composer, genre: song.genre,
                difficulty: song.difficulty,
                bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
                totalDuration: midi.duration,
                noteCount: midi.tracks.reduce((sum, tr) => sum + tr.notes.length, 0),
                trackCount: midi.tracks.filter(tr => tr.notes.length > 0).length,
                midiData: buffer, source: 'community', communityId: song.id,
            });
            onSelectSong(saved);
        } catch (err) {
            showToast(err.message || 'Failed to load song', 'err');
        }
    }, [ratingFor, songs, onSelectSong, showToast]);

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
    }, [currentUser, showToast, loadCommunity, t]);

    const handleReport = useCallback(async (songId) => {
        if (!currentUser) { showToast(t('library.signInToRate'), 'err'); return; }
        try {
            await reportSong(songId, 'inappropriate');
            showToast(tl('Canción reportada', 'Song reported'));
        } catch (err) {
            showToast(err.message || 'Error', 'err');
        }
    }, [currentUser, showToast, tl, t]);

    /* ── Filtered + sorted songs ───────────────── */
    const filteredSongs = useMemo(() => {
        let list = songs.filter(s => {
            if (search) {
                const q = search.toLowerCase();
                if (!(s.name || '').toLowerCase().includes(q) && !(s.artist || '').toLowerCase().includes(q)) return false;
            }
            if (filterDiff > 0 && s.difficulty !== filterDiff) return false;
            if (favOnly && !s.favorite) return false;
            return true;
        });
        list.sort((a, b) => {
            switch (sortBy) {
                case 'name': return (a.name || '').localeCompare(b.name || '');
                case 'lastPlayedAt': return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
                case 'difficulty': return (b.difficulty || 0) - (a.difficulty || 0);
                case 'score': return (b.bestScore || 0) - (a.bestScore || 0);
                default: return (b.addedAt || 0) - (a.addedAt || 0);
            }
        });
        return list;
    }, [songs, search, sortBy, filterDiff, favOnly]);

    const formatDuration = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.libraryPage}>
            {/* Header */}
            <div className={styles.libraryHeader}>
                    <SectionTitle
                        eyebrow={tl(`Repertorio \u00b7 ${filteredSongs.length} piezas`, `Repertoire \u00b7 ${filteredSongs.length} pieces`)}
                        title={tl('Tu librer\u00eda', 'Your library')}
                        action={
                            <button className={styles.importBtn} onClick={handleImport}>
                                <I.Upload size={14} /> {tl('Importar MIDI', 'Import MIDI')}
                            </button>
                        }
                    />
                </div>

                {/* Tabs */}
                <div className={styles.tabsRow}>
                    <Tabs
                        value={activeTab}
                        onChange={setActiveTab}
                        tabs={[
                            { id: 'personal', label: tl('Mi librer\u00eda', 'My library'), icon: <I.Folder size={14} />, count: songs.length },
                            { id: 'community', label: tl('Comunidad', 'Community'), icon: <I.Users size={14} /> },
                        ]}
                    />
                </div>

                {/* Toolbar */}
                {activeTab === 'personal' && (
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <I.Search size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder={tl('Buscar por t\u00edtulo o compositor', 'Search by title or composer')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className={styles.pills}>
                            {[
                                { id: 0, label: tl('Todos', 'All') },
                                ...[1, 2, 3, 4, 5].map(d => ({ id: d, label: '\u2605'.repeat(d) })),
                            ].map(f => (
                                <button key={f.id} className={`${styles.pill} ${filterDiff === f.id ? styles.pillActive : ''}`} onClick={() => setFilterDiff(f.id)}>{f.label}</button>
                            ))}
                        </div>
                        <button
                            className={`${styles.favToggle} ${favOnly ? styles.favActive : ''}`}
                            onClick={() => setFavOnly(!favOnly)}
                        >
                            <I.Star size={14} /> {tl('Favoritos', 'Favorites')}
                        </button>
                        <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="addedAt">{tl('M\u00e1s recientes', 'Most recent')}</option>
                            <option value="name">{tl('Nombre', 'Name')}</option>
                            <option value="score">{tl('Mejor score', 'Top score')}</option>
                            <option value="difficulty">{tl('Dificultad', 'Difficulty')}</option>
                        </select>
                        <div className={styles.viewToggle}>
                            <button className={viewMode === 'grid' ? styles.active : ''} onClick={() => setViewMode('grid')}><I.Grid size={12} /></button>
                            <button className={viewMode === 'list' ? styles.active : ''} onClick={() => setViewMode('list')}><I.List size={12} /></button>
                        </div>
                    </div>
                )}

                {activeTab === 'community' && (
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <I.Search size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder={tl('Buscar en la comunidad', 'Search community')}
                                value={communityFilters.search}
                                onChange={(e) => setCommunityFilters(prev => ({ ...prev, search: e.target.value }))}
                            />
                        </div>
                        <div className={styles.pills}>
                            {['popular', 'recent', 'toprated'].map(s => (
                                <button key={s} className={`${styles.pill} ${communitySort === s ? styles.pillActive : ''}`} onClick={() => setCommunitySort(s)}>
                                    {s === 'popular' ? tl('Populares', 'Popular') : s === 'recent' ? tl('Recientes', 'Recent') : tl('Mejor rating', 'Top rated')}
                                </button>
                            ))}
                        </div>
                        <button className={styles.uploadBtn} onClick={() => setUploadingSong({})}>
                            <I.Upload size={14} /> {tl('Subir canci\u00f3n', 'Upload song')}
                        </button>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className={`${styles.toast} ${toast.type === 'err' ? styles.toastErr : styles.toastOk}`}>
                        {toast.type === 'ok' ? <I.Check size={12} /> : <I.Close size={12} />} {toast.msg}
                    </div>
                )}

                {/* Content */}
                <div className={styles.content}>
                    {activeTab === 'personal' ? (
                        <>
                            {/* Dropzone */}
                            <div
                                ref={dropRef}
                                className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={handleImport}
                            >
                                <div className={styles.dropzoneEyebrow}>{tl('Importa nuevas piezas', 'Import new pieces')}</div>
                                <div className={styles.dropzoneTitle}>{tl('Arrastra .mid o .midi aqu\u00ed', 'Drop .mid or .midi here')}</div>
                                <div className={styles.dropzoneSub}>{tl('o haz clic para seleccionar archivos', 'or click to select files')}</div>
                            </div>

                            {loading ? (
                                <div className={styles.empty}>{t('library.loading')}</div>
                            ) : filteredSongs.length === 0 ? (
                                <div className={styles.empty}>
                                    <div className={styles.emptyIcon}><I.Note size={32} /></div>
                                    <span>{t('library.noSongs')}</span>
                                    <span className={styles.emptyHint}>{t('library.noSongsHint')}</span>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className={styles.grid}>
                                    {filteredSongs.map(song => (
                                        <div
                                            key={song.id}
                                            className={`${styles.songCard} ${currentSongId === song.id ? styles.songCardActive : ''}`}
                                            onClick={() => { if (editingId !== song.id) onSelectSong(song); }}
                                        >
                                            {/* Cover */}
                                            <div className={styles.songCover} style={{ background: coverGradient(song.name) }}>
                                                <span className={styles.coverLetter}>{(song.name || 'U')[0]}</span>
                                                {song.favorite && <I.Star size={14} className={styles.songFav} stroke="none" fill="currentColor" />}
                                                <div className={styles.songPlayOverlay}>
                                                    <div className={styles.playBtn}><I.Play size={20} /></div>
                                                </div>
                                            </div>
                                            {/* Meta */}
                                            <div className={styles.songMeta}>
                                                {editingId === song.id ? (
                                                    <>
                                                        <input
                                                            className={styles.editInput}
                                                            value={editForm.name}
                                                            placeholder={t('library.placeholderTitle')}
                                                            onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                            onClick={e => e.stopPropagation()}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(song.id); if (e.key === 'Escape') setEditingId(null); }}
                                                            autoFocus
                                                        />
                                                        <input
                                                            className={`${styles.editInput} ${styles.editInputSmall}`}
                                                            value={editForm.artist}
                                                            placeholder={t('library.placeholderArtist')}
                                                            onChange={e => setEditForm(prev => ({ ...prev, artist: e.target.value }))}
                                                            onClick={e => e.stopPropagation()}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(song.id); if (e.key === 'Escape') setEditingId(null); }}
                                                        />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className={styles.songTitle} title={song.name}>{song.name || t('library.untitled')}</div>
                                                        <div className={styles.songArtist} title={song.artist}>
                                                            {song.artist || t('library.unknown')}
                                                            {song.source === 'community' && <span className={styles.sourceBadge}><I.Globe size={10} /></span>}
                                                        </div>
                                                    </>
                                                )}
                                                {/* Tags */}
                                                {song.tags && song.tags.length > 0 && (
                                                    <div className={styles.tagRow}>
                                                        {song.tags.slice(0, 2).map(tag => <span key={tag} className={styles.chip}>{tag}</span>)}
                                                    </div>
                                                )}
                                                {/* Footer */}
                                                <div className={styles.songFoot}>
                                                    <Difficulty value={song.difficulty || 0} />
                                                    <div className={styles.songFootRight}>
                                                        <span className={styles.songDuration}><I.Clock size={10} /> {formatDuration(song.totalDuration)}</span>
                                                        {song.bestScore > 0 && <span className={styles.songScore}>{song.bestScore}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Actions overlay */}
                                            <div className={styles.cardActions}>
                                                {editingId === song.id ? (
                                                    <button className={styles.actionBtn} onClick={e => { e.stopPropagation(); handleSaveEdit(song.id); }}><I.Check size={12} /></button>
                                                ) : (
                                                    <button className={styles.actionBtn} onClick={e => { e.stopPropagation(); setEditingId(song.id); setEditForm({ name: song.name || '', artist: song.artist || '' }); }}><I.Edit size={12} /></button>
                                                )}
                                                <button className={styles.actionBtn} onClick={e => { e.stopPropagation(); handleToggleFavorite(song.id, song.favorite); }}>
                                                    <I.Star size={12} stroke={song.favorite ? 'none' : 'currentColor'} fill={song.favorite ? 'var(--gold)' : 'none'} />
                                                </button>
                                                <button className={styles.actionBtn} onClick={e => { e.stopPropagation(); setUploadingSong(song); }}><I.Upload size={12} /></button>
                                                <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={e => { e.stopPropagation(); handleDelete(song.id); }}><I.Trash size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* List view */
                                <div className={styles.listWrap}>
                                    <table className={styles.listTable}>
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th>{tl('T\u00edtulo', 'Title')}</th>
                                                <th>{tl('Compositor', 'Composer')}</th>
                                                <th>{tl('Dif.', 'Diff.')}</th>
                                                <th>{tl('Duraci\u00f3n', 'Duration')}</th>
                                                <th>Score</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSongs.map(song => (
                                                <tr key={song.id} className={currentSongId === song.id ? styles.listRowActive : ''} onClick={() => onSelectSong(song)}>
                                                    <td>
                                                        {song.favorite ? <I.Star size={14} stroke="none" fill="var(--gold)" /> : <span style={{ width: 14, display: 'inline-block' }} />}
                                                    </td>
                                                    <td className={styles.listTitle}>{song.name || t('library.untitled')}</td>
                                                    <td className={styles.listArtist}>{song.artist || t('library.unknown')}</td>
                                                    <td><Difficulty value={song.difficulty || 0} /></td>
                                                    <td className={styles.listMono}>{formatDuration(song.totalDuration)}</td>
                                                    <td className={styles.listScore}>{song.bestScore || '--'}</td>
                                                    <td style={{ position: 'relative' }}>
                                                        <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setListMenuId(listMenuId === song.id ? null : song.id); }}>
                                                            <I.More size={14} />
                                                        </button>
                                                        {listMenuId === song.id && (
                                                            <div className={styles.contextMenu} onClick={(e) => e.stopPropagation()}>
                                                                <button onClick={() => { setEditingId(song.id); setEditForm({ name: song.name || '', artist: song.artist || '' }); setListMenuId(null); }}>
                                                                    <I.Edit size={12} /> {tl('Editar', 'Edit')}
                                                                </button>
                                                                <button onClick={() => { handleToggleFavorite(song.id, song.favorite); setListMenuId(null); }}>
                                                                    <I.Star size={12} /> {song.favorite ? tl('Quitar favorito', 'Unfavorite') : tl('Favorito', 'Favorite')}
                                                                </button>
                                                                <button onClick={() => { setUploadingSong(song); setListMenuId(null); }}>
                                                                    <I.Upload size={12} /> {tl('Compartir', 'Share')}
                                                                </button>
                                                                <button className={styles.contextDanger} onClick={() => { handleDelete(song.id); setListMenuId(null); }}>
                                                                    <I.Trash size={12} /> {tl('Eliminar', 'Delete')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Community tab */
                        loadingCommunity ? (
                            <div className={styles.empty}>{t('library.loadingCommunity')}</div>
                        ) : communitySongs.length === 0 ? (
                            <div className={styles.empty}>
                                <div className={styles.emptyIcon}><I.Users size={32} /></div>
                                <span>{t('library.noCommunity')}</span>
                            </div>
                        ) : (
                            <div className={styles.grid}>
                                {communitySongs.map(song => (
                                    <div key={song.id} className={styles.songCard} onClick={() => setCommunityDetail(song)}>
                                        <div className={styles.songCover} style={{ background: coverGradient(song.title) }}>
                                            <span className={styles.coverLetter}>{(song.title || 'U')[0]}</span>
                                            <div className={styles.songPlayOverlay}>
                                                <div className={styles.playBtn}><I.Play size={20} /></div>
                                            </div>
                                        </div>
                                        <div className={styles.songMeta}>
                                            <div className={styles.songTitle}>{song.title}</div>
                                            <div className={styles.songArtist}>{song.composer}</div>
                                            <div className={styles.uploaderRow}>
                                                <Avatar initial={(song.profiles?.display_name || '?')[0].toUpperCase()} size={20} />
                                                <span className={styles.uploaderName}>@{song.profiles?.display_name || 'anon'}</span>
                                            </div>
                                            <div className={styles.songFoot}>
                                                <Difficulty value={song.difficulty || 0} />
                                                <div className={styles.songFootRight}>
                                                    <span className={styles.ratingBadge}>
                                                        <I.Star size={11} stroke="none" fill="var(--gold)" />
                                                        <span className={styles.ratingVal}>{(song.rating_avg || 0).toFixed(1)}</span>
                                                    </span>
                                                    <span className={styles.downloadBadge}>
                                                        <I.Download size={11} />
                                                        <span className={styles.ratingVal}>{song.save_count >= 1000 ? `${(song.save_count / 1000).toFixed(1)}k` : song.save_count || 0}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <span>{activeTab === 'personal' ? tl(`${filteredSongs.length} piezas`, `${filteredSongs.length} pieces`) : tl(`${communitySongs.length} canciones`, `${communitySongs.length} songs`)}</span>
                </div>

            {/* Community detail modal */}
            {communityDetail && (
                <Modal open onClose={() => { setCommunityDetail(null); setCommunityRating(0); }} width={560}>
                    <div className={styles.modalHead}>
                        <div>
                            <div className={styles.modalEyebrow}>{tl('Comunidad', 'Community')}</div>
                            <h3 className={styles.modalTitle}>{communityDetail.title}</h3>
                        </div>
                        <button className={styles.modalClose} onClick={() => { setCommunityDetail(null); setCommunityRating(0); }}><I.Close size={14} /></button>
                    </div>
                    <div className={styles.modalBody}>
                        <div className={styles.detailGrid}>
                            <div className={styles.detailCover} style={{ background: coverGradient(communityDetail.title) }}>
                                <span className={styles.coverLetter} style={{ fontSize: 48 }}>{(communityDetail.title || 'U')[0]}</span>
                            </div>
                            <div>
                                <div className={styles.detailComposer}>{communityDetail.composer}</div>
                                <div className={styles.detailUploader}>
                                    <Avatar initial={(communityDetail.profiles?.display_name || '?')[0].toUpperCase()} size={24} />
                                    <span>{tl('Subido por', 'Uploaded by')} <strong>@{communityDetail.profiles?.display_name || 'anon'}</strong></span>
                                </div>
                                <div className={styles.detailStats}>
                                    <div className={styles.detailStat}>
                                        <div className={styles.detailStatHead}><I.Star size={14} /><span>Rating</span></div>
                                        <div className={styles.detailStatVal}>{(communityDetail.rating_avg || 0).toFixed(1)}</div>
                                    </div>
                                    <div className={styles.detailStat}>
                                        <div className={styles.detailStatHead}><I.Download size={14} /><span>{tl('Guardados', 'Saved')}</span></div>
                                        <div className={styles.detailStatVal}>{communityDetail.save_count >= 1000 ? `${(communityDetail.save_count / 1000).toFixed(1)}k` : communityDetail.save_count || 0}</div>
                                    </div>
                                    <div className={styles.detailStat}>
                                        <div className={styles.detailStatHead}><I.Note size={14} /><span>{tl('Dificultad', 'Difficulty')}</span></div>
                                        <div className={styles.detailStatVal}>{'★'.repeat(communityDetail.difficulty || 0)}</div>
                                    </div>
                                </div>
                                <div className={styles.ratingSection}>
                                    <div className={styles.modalEyebrow}>{tl('Tu valoraci\u00f3n', 'Your rating')}</div>
                                    <Stars value={communityRating} onChange={(v) => { setCommunityRating(v); handleRate(communityDetail.id, v); }} size={20} />
                                </div>
                                <div className={styles.detailActions}>
                                    <button className={styles.btnGold} onClick={() => { handleSaveCommunityToLibrary(communityDetail); setCommunityDetail(null); }}>
                                        <I.Plus size={14} /> {tl('Guardar en mi librer\u00eda', 'Save to library')}
                                    </button>
                                    <button className={styles.btnGhost} onClick={() => { handleReport(communityDetail.id); setCommunityDetail(null); }} title={tl('Reportar', 'Report')}>
                                        <I.Close size={14} /> {tl('Reportar', 'Report')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

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
