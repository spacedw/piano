import React from 'react';
import { SPEED_OPTIONS } from '@/engine/constants';
import { Play, Pause, Stop, Record } from '@/components/Icons';
import { useT } from '@/i18n';
import styles from './index.module.css';

/**
 * Transport bar: playback controls, seek bar, speed selector, time display.
 *
 * @param {boolean} isPlaying
 * @param {function} onTogglePlay
 * @param {function} onStop
 * @param {function} onRecord
 * @param {boolean} recording
 * @param {number} currentTime - seconds elapsed
 * @param {number} duration - total song duration
 * @param {number} progress - 0..1
 * @param {number} speed - current speed multiplier
 * @param {function} onSpeedChange - (speed) => void
 * @param {function} onSeek - (normalizedPosition) => void
 * @param {boolean} loopEnabled
 * @param {number} loopStart
 * @param {number} loopEnd
 * @param {boolean} disabled - true when no song loaded
 */
export default function Transport({
    isPlaying = false,
    onTogglePlay,
    onStop,
    onRecord,
    recording = false,
    currentTime = 0,
    duration = 0,
    progress = 0,
    speed = 1,
    onSpeedChange,
    onSeek,
    loopEnabled = false,
    loopStart = 0,
    loopEnd = 0,
    disabled = false,
}) {
    const t = useT();

    const fmt = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

    const handleScrubberClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const normalized = x / rect.width;
        onSeek?.(Math.max(0, Math.min(1, normalized)));
    };

    // Loop region as percentages of duration
    const loopLeftPct = duration > 0 ? (loopStart / duration) * 100 : 0;
    const loopWidthPct = duration > 0 ? ((loopEnd - loopStart) / duration) * 100 : 0;

    const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5];

    return (
        <div className={styles.transport}>
            {/* Left: transport buttons */}
            <div className={styles.transportLeft}>
                <button
                    className={styles.btnIcon}
                    title={t('controls.stop')}
                    onClick={onStop}
                    disabled={disabled}
                >
                    <Stop size={14} />
                </button>
                <button
                    className={styles.playBtn}
                    onClick={onTogglePlay}
                    disabled={disabled}
                    aria-label={isPlaying ? t('controls.pause') : t('controls.play')}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                    className={`${styles.btnIcon} ${recording ? styles.recordingOn : ''}`}
                    title={t('controls.record')}
                    onClick={onRecord}
                    style={{ color: recording ? '#D9B4B4' : undefined }}
                >
                    <Record size={12} />
                </button>
            </div>

            {/* Center: time + scrubber */}
            <div className={styles.transportCenter}>
                <span className={`${styles.timeDisplay} ${styles.timeDisplayCurrent}`}>
                    {fmt(currentTime)}
                </span>
                <div className={styles.scrubber} onClick={handleScrubberClick}>
                    <div className={styles.scrubTrack} />
                    {loopEnabled && loopEnd > loopStart && (
                        <div
                            className={styles.scrubLoop}
                            style={{ left: `${loopLeftPct}%`, width: `${loopWidthPct}%` }}
                        />
                    )}
                    <div className={styles.scrubFill} style={{ width: `${pct}%` }} />
                    <div className={styles.scrubThumb} style={{ left: `${pct}%` }} />
                </div>
                <span className={`${styles.timeDisplay} ${styles.timeDisplayTotal}`}>
                    {fmt(duration)}
                </span>
            </div>

            {/* Right: speed */}
            <div className={styles.transportRight}>
                <span className={styles.speedLabel}>{t('controls.speed')}</span>
                <div className={styles.speedPills}>
                    {speedOptions.map(s => (
                        <button
                            key={s}
                            className={`${styles.speedPill} ${speed === s ? styles.speedActive : ''}`}
                            onClick={() => onSpeedChange?.(s)}
                            disabled={disabled}
                        >
                            {s}&times;
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
