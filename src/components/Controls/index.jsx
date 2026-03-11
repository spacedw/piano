import React, { useRef } from 'react';
import { SPEED_OPTIONS } from '@/engine/constants';
import styles from './index.module.css';

/**
 * PlaybackBar handles song controls: file loading, play/pause, stop, speed, progress.
 */
export default function PlaybackBar({
    song,
    isPlaying,
    currentTime,
    progress,
    speed,
    loading: songLoading,
    onLoadFile,
    onTogglePlay,
    onStop,
    onSeek,
    onSpeedChange,
}) {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            onLoadFile(file);
            e.target.value = '';
        }
    };

    const handleProgressClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const normalized = x / rect.width;
        onSeek(Math.max(0, Math.min(1, normalized)));
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.controlsBar}>
            {/* File loader */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".mid,.midi"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="midi-file-input"
            />

            <button
                className={`${styles.controlBtn} ${styles.fileBtn}`}
                onClick={() => fileInputRef.current?.click()}
                title="Load MIDI file"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span className={styles.btnLabel}>Open</span>
            </button>

            <div className={styles.controlsDivider} />

            {/* Playback controls */}
            <button
                className={`${styles.controlBtn} ${styles.playBtn}`}
                onClick={onTogglePlay}
                disabled={!song}
                title={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                )}
            </button>

            <button
                className={styles.controlBtn}
                onClick={onStop}
                disabled={!song}
                title="Stop"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
            </button>

            <div className={styles.controlsDivider} />

            {/* Progress bar */}
            <div className={styles.progressSection}>
                <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
                <div className={styles.progressBar} onClick={handleProgressClick}>
                    <div className={styles.progressTrack} />
                    <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
                    <div
                        className={styles.progressThumb}
                        style={{ left: `${progress * 100}%` }}
                    />
                </div>
                <span className={styles.timeDisplay}>{formatTime(song?.totalDuration || 0)}</span>
            </div>

            <div className={styles.controlsDivider} />

            {/* Speed control */}
            <div className={styles.speedSection}>
                <span className={styles.speedLabel}>Speed</span>
                <select
                    className={styles.speedSelect}
                    value={speed}
                    onChange={(e) => onSpeedChange(Number(e.target.value))}
                    disabled={!song}
                >
                    {SPEED_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}x</option>
                    ))}
                </select>
            </div>

            {/* Song info */}
            {song && (
                <div className={styles.songInfo}>
                    <span className={styles.songName}>{song.name}</span>
                    <span className={styles.songMeta}>{Math.round(song.bpm)} BPM · {song.totalNotes} notes</span>
                </div>
            )}

            {songLoading && (
                <div className={styles.loadingIndicator}>
                    <div className={styles.spinner} />
                    <span>Loading...</span>
                </div>
            )}
        </div>
    );
}
