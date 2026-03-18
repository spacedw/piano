import React, { useState, useEffect, useCallback } from 'react';
import { getProgressStats, getAllRecordings, deleteRecording, updateRecordingMeta } from '@/engine/Storage';
import styles from './index.module.css';

/**
 * Progress dashboard showing practice stats, heatmap, and session history.
 */
export default function ProgressDashboard({ isOpen, onClose, onPlayRecording, onSaveToLibrary }) {
    const [stats, setStats] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [activeTab, setActiveTab] = useState('stats');
    const [loading, setLoading] = useState(false);
    const [editingRecId, setEditingRecId] = useState(null);
    const [editRecName, setEditRecName] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        const [progressStats, recs] = await Promise.all([
            getProgressStats(),
            getAllRecordings(),
        ]);
        setStats(progressStats);
        setRecordings(recs.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
    }, []);

    useEffect(() => {
        if (isOpen) loadData();
    }, [isOpen, loadData]);

    const formatTime = (seconds) => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const formatDate = (ts) => {
        const d = new Date(ts);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleDeleteRecording = async (id) => {
        await deleteRecording(id);
        loadData();
    };

    const handleSaveRecName = async (id) => {
        const trimmed = editRecName.trim();
        if (trimmed) {
            await updateRecordingMeta(id, { songName: trimmed });
            loadData();
        }
        setEditingRecId(null);
    };

    if (!isOpen) return null;

    return (
        <div className={styles.progressOverlay} onClick={onClose}>
            <div className={styles.progressPanel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.progressHeader}>
                    <h2>Your Progress</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.progressTabs}>
                    <button
                        className={activeTab === 'stats' ? styles.active : ''}
                        onClick={() => setActiveTab('stats')}
                    >Statistics</button>
                    <button
                        className={activeTab === 'recordings' ? styles.active : ''}
                        onClick={() => setActiveTab('recordings')}
                    >Recordings</button>
                </div>

                <div className={styles.progressContent}>
                    {loading ? (
                        <div className={styles.progressEmpty}>Loading...</div>
                    ) : activeTab === 'stats' ? (
                        stats ? (
                            <>
                                <div className={styles.statCards}>
                                    <div className={styles.statCard}>
                                        <span className={styles.statValue}>{formatTime(stats.todayTime)}</span>
                                        <span className={styles.statLabel}>Today</span>
                                    </div>
                                    <div className={styles.statCard}>
                                        <span className={styles.statValue}>{formatTime(stats.weekTime)}</span>
                                        <span className={styles.statLabel}>This Week</span>
                                    </div>
                                    <div className={styles.statCard}>
                                        <span className={styles.statValue}>{formatTime(stats.totalTime)}</span>
                                        <span className={styles.statLabel}>Total</span>
                                    </div>
                                    <div className={`${styles.statCard} ${styles.accent}`}>
                                        <span className={styles.statValue}>{stats.streak}</span>
                                        <span className={styles.statLabel}>Day Streak 🔥</span>
                                    </div>
                                </div>

                                <div className={styles.statSection}>
                                    <h3>Performance</h3>
                                    <div className={styles.statRow}>
                                        <div className={styles.statMini}>
                                            <span className={styles.miniLabel}>Sessions</span>
                                            <span className={styles.miniValue}>{stats.totalSessions}</span>
                                        </div>
                                        <div className={styles.statMini}>
                                            <span className={styles.miniLabel}>Avg Score</span>
                                            <span className={styles.miniValue}>{stats.avgScore}%</span>
                                        </div>
                                        <div className={styles.statMini}>
                                            <span className={styles.miniLabel}>Best Score</span>
                                            <span className={`${styles.miniValue} ${styles.gold}`}>{stats.bestScore}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.statSection}>
                                    <h3>Activity (Last 90 days)</h3>
                                    <div className={styles.heatmap}>
                                        {Object.entries(stats.heatmap)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([date, seconds]) => {
                                                let level = 0;
                                                if (seconds > 0) level = 1;
                                                if (seconds > 300) level = 2;
                                                if (seconds > 900) level = 3;
                                                if (seconds > 1800) level = 4;
                                                return (
                                                    <div
                                                        key={date}
                                                        className={`${styles.heatmapCell} ${styles[`level${level}`]}`}
                                                        title={`${date}: ${formatTime(seconds)}`}
                                                    />
                                                );
                                            })}
                                    </div>
                                    <div className={styles.heatmapLegend}>
                                        <span>Less</span>
                                        <div className={`${styles.heatmapCell} ${styles.level0}`} />
                                        <div className={`${styles.heatmapCell} ${styles.level1}`} />
                                        <div className={`${styles.heatmapCell} ${styles.level2}`} />
                                        <div className={`${styles.heatmapCell} ${styles.level3}`} />
                                        <div className={`${styles.heatmapCell} ${styles.level4}`} />
                                        <span>More</span>
                                    </div>
                                </div>

                                <div className={styles.statSection}>
                                    <h3>Recent Sessions</h3>
                                    {stats.recentSessions.length === 0 ? (
                                        <div className={`${styles.progressEmpty} ${styles.small}`}>No sessions yet</div>
                                    ) : (
                                        <div className={styles.sessionList}>
                                            {stats.recentSessions.map(s => (
                                                <div key={s.id} className={styles.sessionItem}>
                                                    <div className={styles.sessionInfo}>
                                                        <span className={styles.sessionSong}>{s.songName || 'Free Play'}</span>
                                                        <span className={styles.sessionDate}>{formatDate(s.date)}</span>
                                                    </div>
                                                    <div className={styles.sessionStats}>
                                                        <span className={styles.sessionScore}>{s.score}%</span>
                                                        <span className={styles.sessionDuration}>{formatTime(s.duration)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className={styles.progressEmpty}>No data yet. Start practicing!</div>
                        )
                    ) : (
                        recordings.length === 0 ? (
                            <div className={styles.progressEmpty}>
                                <span>No recordings yet</span>
                                <span className={styles.emptyHint}>Press the record button while playing to capture your performance</span>
                            </div>
                        ) : (
                            <div className={styles.recordingList}>
                                {recordings.map(rec => (
                                    <div key={rec.id} className={styles.recordingItem}>
                                        <div className={styles.recordingInfo}>
                                            {editingRecId === rec.id ? (
                                                <input
                                                    className={styles.editRecInput}
                                                    value={editRecName}
                                                    onChange={e => setEditRecName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveRecName(rec.id);
                                                        if (e.key === 'Escape') setEditingRecId(null);
                                                    }}
                                                    onBlur={() => handleSaveRecName(rec.id)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span
                                                    className={styles.recordingName}
                                                    onClick={() => { setEditingRecId(rec.id); setEditRecName(rec.songName || ''); }}
                                                    title="Click to rename"
                                                >
                                                    {rec.songName}
                                                    <span className={styles.editHint}>✎</span>
                                                </span>
                                            )}
                                            <span className={styles.recordingDate}>{formatDate(rec.createdAt)}</span>
                                        </div>
                                        <div className={styles.recordingMeta}>
                                            <span>{formatTime(rec.duration)}</span>
                                            <span>{rec.events.length} events</span>
                                        </div>
                                        <div className={styles.recordingActions}>
                                            <button
                                                className={styles.recPlayBtn}
                                                onClick={() => onPlayRecording(rec)}
                                                title="Play recording"
                                            >▶</button>
                                            <button
                                                className={styles.recSaveBtn}
                                                onClick={() => onSaveToLibrary(rec)}
                                                title="Save to Library as MIDI"
                                            >📥</button>
                                            <button
                                                className={styles.recDeleteBtn}
                                                onClick={() => handleDeleteRecording(rec.id)}
                                                title="Delete"
                                            >🗑</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
