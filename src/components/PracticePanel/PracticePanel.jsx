import React, { useState } from 'react';
import { SPEED_OPTIONS } from '../../engine/constants';
import './PracticePanel.css';

/**
 * PracticePanel provides all Phase 2 "teacher" controls:
 * - Wait mode toggle
 * - Hand separation (both/right/left)
 * - Speed control
 * - Section loop with markers
 * - Metronome with BPM
 * - Score display
 */
export default function PracticePanel({
    song,
    // Wait mode
    waitMode,
    onWaitModeChange,
    isWaiting,
    // Hand mode
    handMode,
    onHandModeChange,
    // Speed
    speed,
    onSpeedChange,
    // Loop
    loopEnabled,
    loopStart,
    loopEnd,
    onLoopChange,
    onLoopPointsChange,
    currentTime,
    totalDuration,
    // Metronome
    metronomeEnabled,
    metronomeBpm,
    metronomeCurrentBeat,
    metronomeBeatsPerMeasure,
    onMetronomeToggle,
    onMetronomeBpmChange,
    // Score
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
        <div className={`practice-panel ${expanded ? 'expanded' : 'collapsed'}`}>
            <button
                className="panel-toggle"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Collapse' : 'Expand practice panel'}
            >
                <span className="panel-toggle-label">Practice Mode</span>
                <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
                >
                    <polyline points="6,9 12,15 18,9" />
                </svg>
            </button>

            {expanded && (
                <div className="panel-content">
                    {/* Wait Mode */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-icon">⏸</span>
                            <span>Wait Mode</span>
                        </div>
                        <div className="section-body">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={waitMode}
                                    onChange={(e) => onWaitModeChange(e.target.checked)}
                                />
                                <span className="toggle-slider" />
                                <span className="toggle-label">
                                    {waitMode ? 'On' : 'Off'}
                                    {isWaiting && <span className="waiting-badge">Waiting...</span>}
                                </span>
                            </label>
                            <span className="section-hint">Pauses until you play the correct note</span>
                        </div>
                    </div>

                    {/* Hand Separation */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-icon">✋</span>
                            <span>Hands</span>
                        </div>
                        <div className="section-body">
                            <div className="hand-buttons">
                                {['both', 'right', 'left'].map(mode => (
                                    <button
                                        key={mode}
                                        className={`hand-btn ${handMode === mode ? 'active' : ''}`}
                                        onClick={() => onHandModeChange(mode)}
                                    >
                                        {mode === 'both' ? '🎹 Both' : mode === 'right' ? '👉 Right' : '👈 Left'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Speed */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-icon">⚡</span>
                            <span>Speed</span>
                            <span className="section-value">{speed}x</span>
                        </div>
                        <div className="section-body">
                            <input
                                type="range"
                                className="speed-range"
                                min="0.25"
                                max="2"
                                step="0.05"
                                value={speed}
                                onChange={(e) => onSpeedChange(Number(e.target.value))}
                            />
                            <div className="speed-presets">
                                {[0.25, 0.5, 0.75, 1].map(s => (
                                    <button
                                        key={s}
                                        className={`preset-btn ${speed === s ? 'active' : ''}`}
                                        onClick={() => onSpeedChange(s)}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section Loop */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-icon">🔁</span>
                            <span>Loop</span>
                        </div>
                        <div className="section-body">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={loopEnabled}
                                    onChange={(e) => onLoopChange(e.target.checked)}
                                />
                                <span className="toggle-slider" />
                                <span className="toggle-label">{loopEnabled ? 'On' : 'Off'}</span>
                            </label>
                            {loopEnabled && (
                                <div className="loop-controls">
                                    <div className="loop-inputs">
                                        <div className="loop-field">
                                            <label>Start</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max={totalDuration}
                                                step="0.5"
                                                value={loopStart}
                                                onChange={(e) => onLoopPointsChange(Number(e.target.value), loopEnd)}
                                            />
                                            <span className="loop-time">{formatTime(loopStart)}</span>
                                        </div>
                                        <div className="loop-field">
                                            <label>End</label>
                                            <input
                                                type="range"
                                                min={loopStart + 1}
                                                max={totalDuration}
                                                step="0.5"
                                                value={loopEnd}
                                                onChange={(e) => onLoopPointsChange(loopStart, Number(e.target.value))}
                                            />
                                            <span className="loop-time">{formatTime(loopEnd)}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="preset-btn"
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
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-icon">🥁</span>
                            <span>Metronome</span>
                            <span className="section-value">{metronomeBpm} BPM</span>
                        </div>
                        <div className="section-body">
                            <div className="metronome-row">
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={metronomeEnabled}
                                        onChange={onMetronomeToggle}
                                    />
                                    <span className="toggle-slider" />
                                    <span className="toggle-label">{metronomeEnabled ? 'On' : 'Off'}</span>
                                </label>
                                {metronomeEnabled && (
                                    <div className="beat-dots">
                                        {Array.from({ length: metronomeBeatsPerMeasure }, (_, i) => (
                                            <div
                                                key={i}
                                                className={`beat-dot ${metronomeCurrentBeat === i ? 'active' : ''} ${i === 0 ? 'accent' : ''}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            {metronomeEnabled && (
                                <div className="bpm-control">
                                    <button className="bpm-btn" onClick={() => onMetronomeBpmChange(metronomeBpm - 5)}>-5</button>
                                    <input
                                        type="range"
                                        className="bpm-slider"
                                        min="30"
                                        max="240"
                                        value={metronomeBpm}
                                        onChange={(e) => onMetronomeBpmChange(Number(e.target.value))}
                                    />
                                    <button className="bpm-btn" onClick={() => onMetronomeBpmChange(metronomeBpm + 5)}>+5</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Score */}
                    {scoreStats && scoreStats.totalNotes > 0 && (
                        <div className="panel-section score-section">
                            <div className="section-header">
                                <span className="section-icon">🏆</span>
                                <span>Score</span>
                                <span className="section-value" style={{ color: scoreStats.level.color }}>
                                    {scoreStats.totalScore}%
                                </span>
                            </div>
                            <div className="section-body">
                                <div className="score-grid">
                                    <div className="score-item">
                                        <span className="score-label">Accuracy</span>
                                        <span className="score-value">{scoreStats.accuracy}%</span>
                                    </div>
                                    <div className="score-item">
                                        <span className="score-label">Notes Hit</span>
                                        <span className="score-value">{scoreStats.notesHit}/{scoreStats.totalNotes}</span>
                                    </div>
                                    <div className="score-item">
                                        <span className="score-label">Streak</span>
                                        <span className="score-value">{scoreStats.streak}</span>
                                    </div>
                                    <div className="score-item">
                                        <span className="score-label">Best Streak</span>
                                        <span className="score-value">{scoreStats.maxStreak}</span>
                                    </div>
                                </div>
                                <div className="score-bar">
                                    <div
                                        className="score-bar-fill"
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
