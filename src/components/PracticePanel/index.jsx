import React, { useState } from 'react';
import { SPEED_OPTIONS } from '@/engine/constants';
import styles from './index.module.css';

/**
 * PracticePanel provides all practice "teacher" controls.
 */
export default function PracticePanel({
    song,
    waitMode, onWaitModeChange, isWaiting,
    handMode, onHandModeChange,
    speed, onSpeedChange,
    loopEnabled, loopStart, loopEnd,
    onLoopChange, onLoopPointsChange,
    currentTime, totalDuration,
    metronomeEnabled, metronomeBpm,
    metronomeCurrentBeat, metronomeBeatsPerMeasure,
    onMetronomeToggle, onMetronomeBpmChange,
    scoreStats,
}) {
    const [expanded, setExpanded] = useState(true);

    if (!song) return null;

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`${styles.practicePanel} ${expanded ? styles.expanded : styles.collapsed}`}>
            <button
                className={styles.panelToggle}
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Collapse' : 'Expand practice panel'}
            >
                <span className={styles.panelToggleLabel}>Practice Mode</span>
                <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
                >
                    <polyline points="6,9 12,15 18,9" />
                </svg>
            </button>

            {expanded && (
                <div className={styles.panelContent}>
                    {/* Wait Mode */}
                    <div className={styles.panelSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>⏸</span>
                            <span>Wait Mode</span>
                        </div>
                        <div className={styles.sectionBody}>
                            <label className={styles.toggleSwitch}>
                                <input
                                    type="checkbox"
                                    checked={waitMode}
                                    onChange={(e) => onWaitModeChange(e.target.checked)}
                                />
                                <span className={styles.toggleSlider} />
                                <span className={styles.toggleLabel}>
                                    {waitMode ? 'On' : 'Off'}
                                    {isWaiting && <span className={styles.waitingBadge}>Waiting...</span>}
                                </span>
                            </label>
                            <span className={styles.sectionHint}>Pauses until you play the correct note</span>
                        </div>
                    </div>

                    {/* Hand Separation */}
                    <div className={styles.panelSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>✋</span>
                            <span>Hands</span>
                        </div>
                        <div className={styles.sectionBody}>
                            <div className={styles.handButtons}>
                                {['both', 'right', 'left'].map(mode => (
                                    <button
                                        key={mode}
                                        className={`${styles.handBtn} ${handMode === mode ? styles.active : ''}`}
                                        onClick={() => onHandModeChange(mode)}
                                    >
                                        {mode === 'both' ? '🎹 Both' : mode === 'right' ? '👉 Right' : '👈 Left'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Speed */}
                    <div className={styles.panelSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>⚡</span>
                            <span>Speed</span>
                            <span className={styles.sectionValue}>{speed}x</span>
                        </div>
                        <div className={styles.sectionBody}>
                            <input
                                type="range"
                                className={styles.speedRange}
                                min="0.25" max="2" step="0.05"
                                value={speed}
                                onChange={(e) => onSpeedChange(Number(e.target.value))}
                            />
                            <div className={styles.speedPresets}>
                                {[0.25, 0.5, 0.75, 1].map(s => (
                                    <button
                                        key={s}
                                        className={`${styles.presetBtn} ${speed === s ? styles.active : ''}`}
                                        onClick={() => onSpeedChange(s)}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section Loop */}
                    <div className={styles.panelSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>🔁</span>
                            <span>Loop</span>
                        </div>
                        <div className={styles.sectionBody}>
                            <label className={styles.toggleSwitch}>
                                <input
                                    type="checkbox"
                                    checked={loopEnabled}
                                    onChange={(e) => onLoopChange(e.target.checked)}
                                />
                                <span className={styles.toggleSlider} />
                                <span className={styles.toggleLabel}>{loopEnabled ? 'On' : 'Off'}</span>
                            </label>
                            {loopEnabled && (
                                <div className={styles.loopControls}>
                                    <div className={styles.loopInputs}>
                                        <div className={styles.loopField}>
                                            <label>Start</label>
                                            <input
                                                type="range" min="0" max={totalDuration} step="0.5"
                                                value={loopStart}
                                                onChange={(e) => onLoopPointsChange(Number(e.target.value), loopEnd)}
                                            />
                                            <span className={styles.loopTime}>{formatTime(loopStart)}</span>
                                        </div>
                                        <div className={styles.loopField}>
                                            <label>End</label>
                                            <input
                                                type="range" min={loopStart + 1} max={totalDuration} step="0.5"
                                                value={loopEnd}
                                                onChange={(e) => onLoopPointsChange(loopStart, Number(e.target.value))}
                                            />
                                            <span className={styles.loopTime}>{formatTime(loopEnd)}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.presetBtn}
                                        onClick={() => onLoopPointsChange(
                                            Math.max(0, currentTime - 2),
                                            Math.min(totalDuration, currentTime + 8)
                                        )}
                                    >
                                        Loop from here (10s)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Metronome */}
                    <div className={styles.panelSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>🥁</span>
                            <span>Metronome</span>
                            <span className={styles.sectionValue}>{metronomeBpm} BPM</span>
                        </div>
                        <div className={styles.sectionBody}>
                            <div className={styles.metronomeRow}>
                                <label className={styles.toggleSwitch}>
                                    <input
                                        type="checkbox"
                                        checked={metronomeEnabled}
                                        onChange={onMetronomeToggle}
                                    />
                                    <span className={styles.toggleSlider} />
                                    <span className={styles.toggleLabel}>{metronomeEnabled ? 'On' : 'Off'}</span>
                                </label>
                                {metronomeEnabled && (
                                    <div className={styles.beatDots}>
                                        {Array.from({ length: metronomeBeatsPerMeasure }, (_, i) => (
                                            <div
                                                key={i}
                                                className={`${styles.beatDot} ${metronomeCurrentBeat === i ? styles.active : ''} ${i === 0 ? styles.accent : ''}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            {metronomeEnabled && (
                                <div className={styles.bpmControl}>
                                    <button className={styles.bpmBtn} onClick={() => onMetronomeBpmChange(metronomeBpm - 5)}>-5</button>
                                    <input
                                        type="range"
                                        className={styles.bpmSlider}
                                        min="30" max="240"
                                        value={metronomeBpm}
                                        onChange={(e) => onMetronomeBpmChange(Number(e.target.value))}
                                    />
                                    <button className={styles.bpmBtn} onClick={() => onMetronomeBpmChange(metronomeBpm + 5)}>+5</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Score */}
                    {scoreStats && scoreStats.totalNotes > 0 && (
                        <div className={`${styles.panelSection} ${styles.scoreSection}`}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionIcon}>🏆</span>
                                <span>Score</span>
                                <span className={styles.sectionValue} style={{ color: scoreStats.level.color }}>
                                    {scoreStats.totalScore}%
                                </span>
                            </div>
                            <div className={styles.sectionBody}>
                                <div className={styles.scoreGrid}>
                                    <div className={styles.scoreItem}>
                                        <span className={styles.scoreLabel}>Accuracy</span>
                                        <span className={styles.scoreValue}>{scoreStats.accuracy}%</span>
                                    </div>
                                    <div className={styles.scoreItem}>
                                        <span className={styles.scoreLabel}>Notes Hit</span>
                                        <span className={styles.scoreValue}>{scoreStats.notesHit}/{scoreStats.totalNotes}</span>
                                    </div>
                                    <div className={styles.scoreItem}>
                                        <span className={styles.scoreLabel}>Streak</span>
                                        <span className={styles.scoreValue}>{scoreStats.streak}</span>
                                    </div>
                                    <div className={styles.scoreItem}>
                                        <span className={styles.scoreLabel}>Best Streak</span>
                                        <span className={styles.scoreValue}>{scoreStats.maxStreak}</span>
                                    </div>
                                </div>
                                <div className={styles.scoreBar}>
                                    <div
                                        className={styles.scoreBarFill}
                                        style={{
                                            width: `${scoreStats.totalScore}%`,
                                            background: `linear-gradient(90deg, ${scoreStats.level.color}, ${scoreStats.level.glow})`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
