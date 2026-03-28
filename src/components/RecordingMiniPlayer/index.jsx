import React from 'react';
import { useT } from '@/i18n';
import styles from './index.module.css';

/**
 * Floating mini-player for recording playback.
 * Shows when a recording is playing/paused. Allows pause, resume, and stop.
 */
export default function RecordingMiniPlayer({
    name = 'Recording',
    progress = 0,
    currentTime = 0,
    duration = 0,
    isPlaying = false,
    isPaused = false,
    onPause,
    onResume,
    onStop,
}) {
    const t = useT();
    if (!isPlaying) return null;

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.miniPlayer}>
            {/* Animated progress bar */}
            <div className={styles.progressTrack}>
                <div
                    className={styles.progressFill}
                    style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
            </div>

            <div className={styles.content}>
                {/* Recording indicator */}
                <div className={styles.recIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
                    </svg>
                </div>

                {/* Song name + time */}
                <div className={styles.info}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.time}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>

                {/* Controls */}
                <div className={styles.controls}>
                    {/* Pause / Resume */}
                    <button
                        className={styles.controlBtn}
                        onClick={isPaused ? onResume : onPause}
                        title={isPaused ? t('miniPlayer.resume') : t('miniPlayer.pause')}
                    >
                        {isPaused ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="6,4 20,12 6,20" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="5" y="4" width="4" height="16" rx="1" />
                                <rect x="15" y="4" width="4" height="16" rx="1" />
                            </svg>
                        )}
                    </button>

                    {/* Stop / Close */}
                    <button
                        className={`${styles.controlBtn} ${styles.closeBtn}`}
                        onClick={onStop}
                        title={t('miniPlayer.stop')}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
