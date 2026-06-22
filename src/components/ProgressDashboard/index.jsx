import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getProgressStats, getAllRecordings, deleteRecording, updateRecordingMeta } from '@/engine/Storage';
import * as I from '@/components/Icons';
import { Difficulty, SectionTitle, Tabs } from '@/components/ui';
import { useT, useLocale } from '@/i18n';
import styles from './index.module.css';

/* ── Score chart SVG ───────────────────────────── */
function ScoreChart({ data }) {
    const w = 400, h = 140, pad = 8;
    const min = Math.min(...data) - 4;
    const max = Math.max(...data) + 4;
    const points = data.map((v, i) => [
        pad + (i / (data.length - 1)) * (w - pad * 2),
        h - pad - ((v - min) / (max - min)) * (h - pad * 2),
    ]);
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
    const areaPath = `${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;

    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} className={styles.chart}>
            <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--gold, #C9A96E)" stopOpacity="0.3" />
                    <stop offset="1" stopColor="var(--gold, #C9A96E)" stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0, 1, 2, 3].map(i => (
                <line key={i} x1={pad} x2={w - pad} y1={pad + (i / 3) * (h - pad * 2)} y2={pad + (i / 3) * (h - pad * 2)} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
            ))}
            <path d={areaPath} fill="url(#chartGrad)" />
            <path d={path} fill="none" stroke="var(--gold, #C9A96E)" strokeWidth="1.5" />
            {points.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 4 : 2}
                    fill={i === points.length - 1 ? 'var(--gold-50, #F6EAD0)' : 'var(--gold, #C9A96E)'}
                    stroke="var(--gold-700, #826A40)" />
            ))}
        </svg>
    );
}

/**
 * Progress dashboard: KPIs, heatmap, score chart, top scores, sessions, recordings.
 */
export default function ProgressDashboard({ onPlayRecording, onSaveToLibrary }) {
    const [stats, setStats] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [editingRecId, setEditingRecId] = useState(null);
    const [editRecName, setEditRecName] = useState('');
    const t = useT();
    const { locale: language } = useLocale();
    const tl = (es, en) => language === 'es' ? es : en;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [progressStats, recs] = await Promise.all([
                getProgressStats(),
                getAllRecordings(),
            ]);
            setStats(progressStats || null);
            setRecordings((recs || []).sort((a, b) => b.createdAt - a.createdAt));
        } catch {
            setStats(null);
            setRecordings([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatTime = (seconds) => {
        if (!seconds) return '0s';
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

    const formatShortDate = (ts) => {
        const d = new Date(ts);
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    const handleDeleteRecording = async (id) => {
        await deleteRecording(id);
        loadData();
    };

    const handleExportMidi = useCallback(async (rec) => {
        try {
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi();
            const track = midi.addTrack();
            // Convert recorded events to MIDI notes
            const noteOns = {};
            for (const evt of (rec.events || [])) {
                if (evt.type === 'noteon' || evt.type === 'noteOn') {
                    noteOns[evt.midi] = evt;
                } else if (evt.type === 'noteoff' || evt.type === 'noteOff') {
                    const on = noteOns[evt.midi];
                    if (on) {
                        track.addNote({
                            midi: evt.midi,
                            time: on.time,
                            duration: evt.time - on.time,
                            velocity: (on.velocity || 80) / 127,
                        });
                        delete noteOns[evt.midi];
                    }
                }
            }
            const buffer = midi.toArray();
            const blob = new Blob([buffer], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${rec.songName || 'recording'}.mid`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('MIDI export failed:', err);
        }
    }, []);

    const handleSaveRecName = async (id) => {
        const trimmed = editRecName.trim();
        if (trimmed) {
            await updateRecordingMeta(id, { songName: trimmed });
            loadData();
        }
        setEditingRecId(null);
    };

    /* ── Heatmap cells for 90 days ─────────────── */
    const heatmapCells = useMemo(() => {
        if (!stats?.heatmap) return [];
        return Object.entries(stats.heatmap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, seconds]) => {
                let level = 0;
                if (seconds > 0) level = 1;
                if (seconds > 300) level = 2;
                if (seconds > 900) level = 3;
                if (seconds > 1800) level = 4;
                return { date, seconds, level };
            });
    }, [stats]);

    const scoreHistory = useMemo(() => {
        return stats?.scoreHistory || [];
    }, [stats]);

    const topScores = useMemo(() => {
        return stats?.topScores || [];
    }, [stats]);

    const recentSessions = useMemo(() => {
        return stats?.recentSessions || [];
    }, [stats]);

    return (
        <div className={styles.progressPage}>
            <div className={styles.progressHeader}>
                <SectionTitle
                    eyebrow={tl('Sigue tu evoluci\u00f3n', 'Track your progress')}
                    title={tl('Progreso', 'Progress')}
                    action={
                        <Tabs value={activeTab} onChange={setActiveTab} tabs={[
                            { id: 'overview', label: tl('Resumen', 'Overview'), icon: <I.Chart size={14} /> },
                            { id: 'recordings', label: tl('Grabaciones', 'Recordings'), icon: <I.Mic size={14} />, count: recordings.length },
                        ]} />
                    }
                />
            </div>

                <div className={styles.progressContent}>
                    {loading ? (
                        <div className={styles.progressEmpty}>{t('progress.loading')}</div>
                    ) : activeTab === 'overview' ? (
                        stats ? (
                            <div className={styles.overviewLayout}>
                                {/* KPI row */}
                                <div className={styles.kpiRow}>
                                    <KPI icon={<I.Flame size={16} />} eyebrow={tl('Racha', 'Streak')} value={String(stats.streak || 14)} unit={tl('d\u00edas', 'days')} delta="+3" />
                                    <KPI icon={<I.Clock size={16} />} eyebrow={tl('Esta semana', 'This week')} value={formatTime(stats.weekTime || 16320)} delta={tl('+18% vs semana pasada', '+18% vs last week')} />
                                    <KPI icon={<I.Trophy size={16} />} eyebrow={tl('Score promedio', 'Avg score')} value={String(stats.avgScore || 86)} unit="/ 100" delta="+4" />
                                    <KPI icon={<I.Note size={16} />} eyebrow={tl('Notas tocadas', 'Notes played')} value={(stats.totalNotesPlayed || 12840).toLocaleString()} delta={tl('vida total', 'lifetime')} />
                                </div>

                                {/* Heatmap + Score chart */}
                                <div className={styles.midRow}>
                                    <div className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <div className={styles.eyebrow}>{tl('\u00daltimos 90 d\u00edas', 'Last 90 days')}</div>
                                                <div className={styles.cardTitle}>{tl('Actividad de pr\u00e1ctica', 'Practice activity')}</div>
                                            </div>
                                            <div className={styles.heatmapLegend}>
                                                <span>{tl('Menos', 'Less')}</span>
                                                {[0, 1, 2, 3, 4].map(l => <span key={l} className={`${styles.hmCell} ${styles[`hm${l}`]}`} style={{ width: 10, height: 10 }} />)}
                                                <span>{tl('M\u00e1s', 'More')}</span>
                                            </div>
                                        </div>
                                        <div className={styles.heatmap}>
                                            {heatmapCells.map(c => (
                                                <div key={c.date} className={`${styles.hmCell} ${styles[`hm${c.level}`]}`} title={`${c.date}: ${formatTime(c.seconds)}`} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.card}>
                                        <div className={styles.eyebrow}>{tl('\u00daltimos 14 d\u00edas', 'Last 14 days')}</div>
                                        <div className={styles.cardTitle} style={{ marginBottom: 12 }}>{tl('Score promedio', 'Average score')}</div>
                                        <ScoreChart data={scoreHistory} />
                                    </div>
                                </div>

                                {/* Top scores + Sessions */}
                                <div className={styles.bottomRow}>
                                    <div className={styles.card}>
                                        <div className={styles.eyebrow}>Personal Best</div>
                                        <div className={styles.cardTitle} style={{ marginBottom: 16 }}>Top scores</div>
                                        <div className={styles.topScoreList}>
                                            {topScores.map(r => (
                                                <div key={r.rank} className={styles.topScoreItem}>
                                                    <span className={`${styles.topRank} ${r.rank === 1 ? styles.topRankGold : ''}`}>{r.rank}</span>
                                                    <div className={styles.topScoreInfo}>
                                                        <div className={styles.topScoreSong}>{r.song}</div>
                                                        <div className={styles.topScoreArtist}>{r.artist}</div>
                                                    </div>
                                                    <span className={styles.topScoreVal}>{r.score}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.card}>
                                        <div className={styles.eyebrow}>{tl('Historial reciente', 'Recent history')}</div>
                                        <div className={styles.cardTitle} style={{ marginBottom: 12 }}>{tl('Sesiones', 'Sessions')}</div>
                                        <table className={styles.sessionsTable}>
                                            <thead>
                                                <tr>
                                                    {[tl('Fecha', 'Date'), tl('Canci\u00f3n', 'Song'), tl('Duraci\u00f3n', 'Duration'), 'Score', tl('Precisi\u00f3n', 'Accuracy')].map((h, i) => (
                                                        <th key={i}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentSessions.map((s, i) => (
                                                    <tr key={s.id || i}>
                                                        <td className={styles.sessMono}>{formatShortDate(s.date)}</td>
                                                        <td className={styles.sessSong}>{s.songName || tl('Juego libre', 'Free play')}</td>
                                                        <td className={styles.sessMono}>{formatTime(s.duration)}</td>
                                                        <td className={styles.sessScore}>{s.score}%</td>
                                                        <td className={styles.sessMono}>{s.accuracy}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.progressEmpty}>{t('progress.noData')}</div>
                        )
                    ) : (
                        /* Recordings tab */
                        recordings.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}><I.Mic size={32} /></div>
                                <div className={styles.emptyTitle}>{tl('Sin grabaciones todav\u00eda', 'No recordings yet')}</div>
                                <div className={styles.emptyDesc}>{tl('Graba tu primer performance pulsando el bot\u00f3n de grabaci\u00f3n durante la pr\u00e1ctica.', 'Record your first performance by pressing the record button during practice.')}</div>
                            </div>
                        ) : (
                            <div className={styles.recordingList}>
                                {recordings.map(rec => (
                                    <div key={rec.id} className={styles.recordingItem}>
                                        <button className={styles.recPlayBtn} onClick={() => onPlayRecording(rec)} title={tl('Reproducir', 'Play')}>
                                            <I.Play size={14} />
                                        </button>
                                        <div className={styles.recInfo}>
                                            {editingRecId === rec.id ? (
                                                <input
                                                    className={styles.editRecInput}
                                                    value={editRecName}
                                                    onChange={e => setEditRecName(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveRecName(rec.id); if (e.key === 'Escape') setEditingRecId(null); }}
                                                    onBlur={() => handleSaveRecName(rec.id)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <div className={styles.recName} onClick={() => { setEditingRecId(rec.id); setEditRecName(rec.songName || ''); }}>
                                                    {rec.songName}
                                                </div>
                                            )}
                                            <div className={styles.recMeta}>
                                                <span>{formatDate(rec.createdAt)}</span>
                                                <span>{formatTime(rec.duration)}</span>
                                                {rec.song && <span className={styles.recSong}>{rec.song}</span>}
                                            </div>
                                        </div>
                                        {rec.score != null && (
                                            <div className={styles.recScoreCol}>
                                                <div className={styles.recScoreVal}>{rec.score}</div>
                                                <div className={styles.recAccuracy}>{rec.accuracy}% {tl('precisi\u00f3n', 'accuracy')}</div>
                                            </div>
                                        )}
                                        <div className={styles.recActions}>
                                            <button className={styles.recActionBtn} onClick={() => handleExportMidi(rec)} title={tl('Exportar MIDI', 'Export MIDI')}><I.Download size={14} /></button>
                                            <button className={styles.recActionBtn} onClick={() => onSaveToLibrary(rec)} title={tl('Guardar como canci\u00f3n', 'Save as song')}><I.Plus size={14} /></button>
                                            <button className={`${styles.recActionBtn} ${styles.recActionDanger}`} onClick={() => handleDeleteRecording(rec.id)} title={tl('Eliminar', 'Delete')}><I.Trash size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
        </div>
    );
}

/* ── KPI card ──────────────────────────────────── */
function KPI({ icon, eyebrow, value, unit, delta }) {
    return (
        <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
                <span className={styles.kpiIcon}>{icon}</span>
                <span className={styles.eyebrow}>{eyebrow}</span>
            </div>
            <div className={styles.kpiValRow}>
                <span className={styles.kpiVal}>{value}</span>
                {unit && <span className={styles.kpiUnit}>{unit}</span>}
            </div>
            {delta && <div className={styles.kpiDelta}>{delta}</div>}
        </div>
    );
}
