import React, { useState, useEffect, useCallback } from 'react';
import { getProgressStats, getAllRecordings, deleteRecording } from '../../engine/Storage';
import './ProgressDashboard.css';

/**
 * Progress dashboard showing practice stats, heatmap, and session history.
 */
export default function ProgressDashboard({ isOpen, onClose, onPlayRecording }) {
    const [stats, setStats] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'recordings'
    const [loading, setLoading] = useState(false);

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

    if (!isOpen) return null;

    return (
        <div className="progress-overlay" onClick={onClose}>
            <div className="progress-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="progress-header">
                    <h2>Your Progress</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div className="progress-tabs">
                    <button
                        className={activeTab === 'stats' ? 'active' : ''}
                        onClick={() => setActiveTab('stats')}
                    >Statistics</button>
                    <button
                        className={activeTab === 'recordings' ? 'active' : ''}
                        onClick={() => setActiveTab('recordings')}
                    >Recordings</button>
                </div>

                <div className="progress-content">
                    {loading ? (
                        <div className="progress-empty">Loading...</div>
                    ) : activeTab === 'stats' ? (
                        stats ? (
                            <>
                                {/* Stat cards */}
                                <div className="stat-cards">
                                    <div className="stat-card">
                                        <span className="stat-value">{formatTime(stats.todayTime)}</span>
                                        <span className="stat-label">Today</span>
                                    </div>
                                    <div className="stat-card">
                                        <span className="stat-value">{formatTime(stats.weekTime)}</span>
                                        <span className="stat-label">This Week</span>
                                    </div>
                                    <div className="stat-card">
                                        <span className="stat-value">{formatTime(stats.totalTime)}</span>
                                        <span className="stat-label">Total</span>
                                    </div>
                                    <div className="stat-card accent">
                                        <span className="stat-value">{stats.streak}</span>
                                        <span className="stat-label">Day Streak 🔥</span>
                                    </div>
                                </div>

                                {/* Performance */}
                                <div className="stat-section">
                                    <h3>Performance</h3>
                                    <div className="stat-row">
                                        <div className="stat-mini">
                                            <span className="mini-label">Sessions</span>
                                            <span className="mini-value">{stats.totalSessions}</span>
                                        </div>
                                        <div className="stat-mini">
                                            <span className="mini-label">Avg Score</span>
                                            <span className="mini-value">{stats.avgScore}%</span>
                                        </div>
                                        <div className="stat-mini">
                                            <span className="mini-label">Best Score</span>
                                            <span className="mini-value gold">{stats.bestScore}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Heatmap */}
                                <div className="stat-section">
                                    <h3>Activity (Last 90 days)</h3>
                                    <div className="heatmap">
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
                                                        className={`heatmap-cell level-${level}`}
                                                        title={`${date}: ${formatTime(seconds)}`}
                                                    />
                                                );
                                            })}
                                    </div>
                                    <div className="heatmap-legend">
                                        <span>Less</span>
                                        <div className="heatmap-cell level-0" />
                                        <div className="heatmap-cell level-1" />
                                        <div className="heatmap-cell level-2" />
                                        <div className="heatmap-cell level-3" />
                                        <div className="heatmap-cell level-4" />
                                        <span>More</span>
                                    </div>
                                </div>

                                {/* Recent sessions */}
                                <div className="stat-section">
                                    <h3>Recent Sessions</h3>
                                    {stats.recentSessions.length === 0 ? (
                                        <div className="progress-empty small">No sessions yet</div>
                                    ) : (
                                        <div className="session-list">
                                            {stats.recentSessions.map(s => (
                                                <div key={s.id} className="session-item">
                                                    <div className="session-info">
                                                        <span className="session-song">{s.songName || 'Free Play'}</span>
                                                        <span className="session-date">{formatDate(s.date)}</span>
                                                    </div>
                                                    <div className="session-stats">
                                                        <span className="session-score">{s.score}%</span>
                                                        <span className="session-duration">{formatTime(s.duration)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="progress-empty">No data yet. Start practicing!</div>
                        )
                    ) : (
                        /* Recordings tab */
                        recordings.length === 0 ? (
                            <div className="progress-empty">
                                <span>No recordings yet</span>
                                <span className="empty-hint">Press the record button while playing to capture your performance</span>
                            </div>
                        ) : (
                            <div className="recording-list">
                                {recordings.map(rec => (
                                    <div key={rec.id} className="recording-item">
                                        <div className="recording-info">
                                            <span className="recording-name">{rec.songName}</span>
                                            <span className="recording-date">{formatDate(rec.createdAt)}</span>
                                        </div>
                                        <div className="recording-meta">
                                            <span>{formatTime(rec.duration)}</span>
                                            <span>{rec.events.length} events</span>
                                        </div>
                                        <div className="recording-actions">
                                            <button
                                                className="rec-play-btn"
                                                onClick={() => onPlayRecording(rec)}
                                                title="Play recording"
                                            >▶</button>
                                            <button
                                                className="rec-delete-btn"
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
