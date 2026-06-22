import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, FX_COLORS } from '@/engine/constants';
import { NoteHitFX } from '@/engine/NoteHitFX';
import styles from './index.module.css';

const TOTAL_WHITE_KEYS = 52;
const PIXELS_PER_SECOND = 150;

/**
 * Waterfall component renders falling notes as styled DOM elements
 * with a separate FX overlay canvas for sparkle/glow effects.
 *
 * @param {Array} visibleNotes - notes to render
 * @param {number} currentTime - current playback time in seconds
 * @param {number} width - container width
 * @param {number} height - container height
 * @param {Map} activeNotes - Map<midi, velocity> from user input
 * @param {Array} songActiveNotes - active song notes
 * @param {boolean} loopEnabled - loop mode on/off
 * @param {number} loopStart - loop start time
 * @param {number} loopEnd - loop end time
 * @param {boolean} isWaiting - wait mode active (paused for user)
 * @param {string} handMode - 'both' | 'right' | 'left'
 * @param {string} language - 'en' | 'es'
 */
export default function Waterfall({
    visibleNotes = [],
    currentTime = 0,
    width = 1200,
    height = 400,
    activeNotes = new Map(),
    songActiveNotes = [],
    loopEnabled = false,
    loopStart = 0,
    loopEnd = 0,
    isWaiting = false,
    handMode = 'both',
    language = 'en',
}) {
    const fxCanvasRef = useRef(null);
    const fxRef = useRef(new NoteHitFX());
    const prevActiveRef = useRef(new Set());
    const prevSongActiveRef = useRef(new Set());
    const lastFrameTimeRef = useRef(0);

    const SECONDS_VISIBLE = height / PIXELS_PER_SECOND;

    // Position helper: get left% and width for a midi note
    const positionForMidi = useCallback((midi) => {
        const isBlk = isBlackKey(midi);
        let whitesBefore = 0;
        for (let m = FIRST_NOTE; m < midi; m++) {
            if (!isBlackKey(m)) whitesBefore++;
        }
        if (!isBlk) {
            const left = (whitesBefore / TOTAL_WHITE_KEYS) * 100;
            return { left: `${left}%`, width: `calc(${100 / TOTAL_WHITE_KEYS}% - 2px)`, isBlk: false };
        } else {
            const left = ((whitesBefore + 1) / TOTAL_WHITE_KEYS) * 100;
            return {
                left: `calc(${left}% - ${100 / TOTAL_WHITE_KEYS}% * 0.32)`,
                width: `calc(${100 / TOTAL_WHITE_KEYS}% * 0.62)`,
                isBlk: true,
            };
        }
    }, []);

    // Pixel position helpers for FX canvas
    const getKeyX = useCallback((midi) => {
        const whiteKeyWidth = width / TOTAL_WHITE_KEYS;
        const blackKeyWidth = whiteKeyWidth * 0.6;
        let whiteIndex = 0;
        for (let i = FIRST_NOTE; i < midi; i++) {
            if (!isBlackKey(i)) whiteIndex++;
        }
        if (isBlackKey(midi)) {
            return whiteIndex * whiteKeyWidth - blackKeyWidth / 2;
        }
        return whiteIndex * whiteKeyWidth;
    }, [width]);

    const getKeyWidth = useCallback((midi) => {
        const whiteKeyWidth = width / TOTAL_WHITE_KEYS;
        if (isBlackKey(midi)) return whiteKeyWidth * 0.6;
        return whiteKeyWidth - 1;
    }, [width]);

    // FX: detect new note impacts & update glows
    useEffect(() => {
        const fx = fxRef.current;
        const hitY = height - 2;

        const currentActive = new Set();
        activeNotes.forEach((_vel, midi) => currentActive.add(midi));

        const currentSongActive = new Set();
        if (songActiveNotes) {
            songActiveNotes.forEach(n => currentSongActive.add(n.midi));
        }

        activeNotes.forEach((velocity, midi) => {
            if (!prevActiveRef.current.has(midi)) {
                const x = getKeyX(midi);
                const w = getKeyWidth(midi);
                fx.emit(x, hitY, w, velocity, FX_COLORS.rightHand);
            }
        });

        if (songActiveNotes) {
            for (const note of songActiveNotes) {
                if (!prevSongActiveRef.current.has(note.midi)) {
                    const x = getKeyX(note.midi);
                    const w = getKeyWidth(note.midi);
                    const isRight = note.isRightHand !== false;
                    fx.emit(x, hitY, w, note.velocity || 0.7, isRight ? FX_COLORS.rightHand : FX_COLORS.leftHand);
                }
            }
        }

        prevActiveRef.current = currentActive;
        prevSongActiveRef.current = currentSongActive;

        const glows = [];
        activeNotes.forEach((velocity, midi) => {
            glows.push({
                x: getKeyX(midi), y: hitY, w: getKeyWidth(midi),
                color: FX_COLORS.rightHand, velocity,
            });
        });
        if (songActiveNotes) {
            for (const note of songActiveNotes) {
                const isRight = note.isRightHand !== false;
                glows.push({
                    x: getKeyX(note.midi), y: hitY, w: getKeyWidth(note.midi),
                    color: isRight ? FX_COLORS.rightHand : FX_COLORS.leftHand,
                    velocity: note.velocity || 0.7,
                });
            }
        }
        fx.setActiveGlows(glows);
    }, [activeNotes, songActiveNotes, height, getKeyX, getKeyWidth]);

    // FX animation loop (independent rAF)
    useEffect(() => {
        const fx = fxRef.current;
        let rafId;

        const loop = (timestamp) => {
            const dt = lastFrameTimeRef.current ? (timestamp - lastFrameTimeRef.current) / 1000 : 0.016;
            lastFrameTimeRef.current = timestamp;

            fx.update(dt);

            const fxCanvas = fxCanvasRef.current;
            if (fxCanvas && fx.isActive) {
                const ctx = fxCanvas.getContext('2d');
                const dpr = window.devicePixelRatio || 1;

                const targetW = width * dpr;
                const targetH = height * dpr;
                if (fxCanvas.width !== targetW || fxCanvas.height !== targetH) {
                    fxCanvas.width = targetW;
                    fxCanvas.height = targetH;
                }

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                fx.draw(ctx, width, height);
            } else if (fxCanvas && !fx.isActive) {
                const ctx = fxCanvas.getContext('2d');
                ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
            }

            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafId);
            lastFrameTimeRef.current = 0;
        };
    }, [width, height]);

    // Build grid lines
    const gridLines = useMemo(() => {
        const lines = [];
        for (let i = 0; i <= TOTAL_WHITE_KEYS; i++) {
            const x = (i / TOTAL_WHITE_KEYS) * 100;
            const isC = ((i + 5) % 7 === 0);
            lines.push({ i, x, isC });
        }
        return lines;
    }, []);

    // Loop region positions
    const loopRegion = useMemo(() => {
        if (!loopEnabled || loopEnd <= loopStart) return null;
        const startY = ((SECONDS_VISIBLE - (loopStart - currentTime)) / SECONDS_VISIBLE) * 100;
        const endY = ((SECONDS_VISIBLE - (loopEnd - currentTime)) / SECONDS_VISIBLE) * 100;
        return { startY, endY };
    }, [loopEnabled, loopStart, loopEnd, currentTime, SECONDS_VISIBLE]);

    return (
        <div className={styles.waterfall}>
            {/* Vertical reference grid */}
            <div className={styles.wfGrid}>
                {gridLines.map(({ i, x, isC }) => (
                    <div
                        key={i}
                        className={`${styles.wfGridLine} ${isC ? styles.wfGridC : ''}`}
                        style={{ left: `${x}%` }}
                    />
                ))}
            </div>

            {/* Horizontal beat lines */}
            <div className={styles.wfBeats}>
                {[...Array(8)].map((_, i) => (
                    <div
                        key={i}
                        className={styles.wfBeatLine}
                        style={{ top: `${(i / 8) * 100}%` }}
                    />
                ))}
            </div>

            {/* Notes */}
            <div className={styles.wfNotes}>
                {visibleNotes.map((note, idx) => {
                    const dt = note.time - currentTime;
                    const noteEnd = note.time + note.duration;
                    if (noteEnd < currentTime - 0.5) return null;
                    if (dt > SECONDS_VISIBLE + 0.5) return null;

                    const pos = positionForMidi(note.midi);
                    const topPct = ((SECONDS_VISIBLE - dt) / SECONDS_VISIBLE) * 100;
                    const heightPct = (note.duration / SECONDS_VISIBLE) * 100;
                    const playingNow = currentTime >= note.time && currentTime <= noteEnd;

                    const isRight = note.isRightHand !== false;
                    const isDimmed = note.dimmed === true;

                    let noteClass = styles.wfNote;
                    noteClass += isRight ? ` ${styles.wfNoteR}` : ` ${styles.wfNoteL}`;
                    if (pos.isBlk) noteClass += ` ${styles.wfNoteBlk}`;
                    if (playingNow && !isDimmed) noteClass += ` ${styles.wfNoteNow}`;

                    return (
                        <div
                            key={idx}
                            className={noteClass}
                            style={{
                                left: pos.left,
                                width: pos.width,
                                top: `calc(${topPct}% - ${heightPct}%)`,
                                height: `${heightPct}%`,
                                opacity: isDimmed ? 0.2 : 1,
                            }}
                        >
                            {note.duration > 0.5 && playingNow && !isDimmed && (
                                <span className={styles.wfNoteGlow} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Strike line + glow */}
            <div className={styles.wfStrike}>
                <div className={styles.wfStrikeLine} />
                <div className={styles.wfStrikeFade} />
            </div>

            {/* Loop region overlay */}
            {loopRegion && (
                <>
                    {loopRegion.endY >= 0 && loopRegion.startY <= 100 && (
                        <div
                            className={styles.wfLoopRegion}
                            style={{
                                top: `${Math.max(0, loopRegion.endY)}%`,
                                height: `${Math.min(100, loopRegion.startY) - Math.max(0, loopRegion.endY)}%`,
                            }}
                        />
                    )}
                    {loopRegion.startY >= 0 && loopRegion.startY <= 100 && (
                        <div className={styles.wfLoopLine} style={{ top: `${loopRegion.startY}%` }} />
                    )}
                    {loopRegion.endY >= 0 && loopRegion.endY <= 100 && (
                        <div className={styles.wfLoopLine} style={{ top: `${loopRegion.endY}%` }} />
                    )}
                </>
            )}

            {/* Waiting overlay */}
            {isWaiting && <div className={styles.wfWaiting} />}

            {/* FX overlay canvas */}
            <canvas
                ref={fxCanvasRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={styles.fxCanvas}
            />
        </div>
    );
}
