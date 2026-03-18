import React, { useRef, useCallback, useEffect } from 'react';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, COLORS, FX_COLORS } from '@/engine/constants';
import { NoteHitFX } from '@/engine/NoteHitFX';
import styles from './index.module.css';

const TOTAL_WHITE_KEYS = 52;
const PIXELS_PER_SECOND = 150;

/**
 * Waterfall component renders falling notes on a Canvas,
 * with a separate FX overlay canvas for sparkle/glow effects.
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
}) {
    const canvasRef = useRef(null);
    const fxCanvasRef = useRef(null);
    const fxRef = useRef(new NoteHitFX());
    const prevActiveRef = useRef(new Set());
    const prevSongActiveRef = useRef(new Set());
    const lastFrameTimeRef = useRef(0);

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
        if (isBlackKey(midi)) {
            return whiteKeyWidth * 0.6;
        }
        return whiteKeyWidth - 1;
    }, [width]);

    // ── Main waterfall draw (unchanged logic) ──────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const beatInterval = PIXELS_PER_SECOND;
        const timeOffset = currentTime % 1;
        for (let y = height + timeOffset * PIXELS_PER_SECOND; y > -PIXELS_PER_SECOND; y -= beatInterval) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi += 12) {
            const x = getKeyX(midi);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (const note of visibleNotes) {
            const x = getKeyX(note.midi);
            const w = getKeyWidth(note.midi);
            const noteHeight = Math.max(note.duration * PIXELS_PER_SECOND, 4);
            const y = height - (note.time - currentTime + note.duration) * PIXELS_PER_SECOND;

            const isRight = note.isRightHand !== false;
            const isDimmed = note.dimmed === true;
            const baseColor = isRight ? COLORS.waterfall.rightHand : COLORS.waterfall.leftHand;
            const borderColor = isRight ? COLORS.waterfall.rightHandBorder : COLORS.waterfall.leftHandBorder;
            const isActive = note.time <= currentTime && note.time + note.duration > currentTime;

            if (isDimmed) ctx.globalAlpha = 0.2;

            const radius = 3;
            ctx.beginPath();
            ctx.roundRect(x + 1, y, w - 2, noteHeight, radius);

            const grad = ctx.createLinearGradient(x, y, x, y + noteHeight);
            if (isActive) {
                grad.addColorStop(0, isRight ? 'rgba(232, 213, 168, 0.95)' : 'rgba(170, 185, 215, 0.95)');
                grad.addColorStop(1, baseColor);
            } else {
                grad.addColorStop(0, baseColor);
                grad.addColorStop(1, baseColor);
            }
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            if (isActive && !isDimmed) {
                ctx.shadowColor = isRight ? COLORS.accentGold : COLORS.leftHand;
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.globalAlpha = 1.0;
        }

        const hitLineY = height - 2;
        const hitGrad = ctx.createLinearGradient(0, hitLineY - 2, 0, hitLineY);
        hitGrad.addColorStop(0, 'rgba(201, 169, 110, 0)');
        hitGrad.addColorStop(1, 'rgba(201, 169, 110, 0.6)');
        ctx.fillStyle = hitGrad;
        ctx.fillRect(0, hitLineY - 2, width, 2);

        activeNotes.forEach((velocity, midi) => {
            const x = getKeyX(midi);
            const w = getKeyWidth(midi);
            const glowGrad = ctx.createLinearGradient(0, height - 20, 0, height);
            glowGrad.addColorStop(0, 'rgba(201, 169, 110, 0)');
            glowGrad.addColorStop(1, `rgba(201, 169, 110, ${velocity * 0.5})`);
            ctx.fillStyle = glowGrad;
            ctx.fillRect(x, height - 20, w, 20);
        });

        if (loopEnabled && loopEnd > loopStart) {
            const loopStartY = height - (loopStart - currentTime) * PIXELS_PER_SECOND;
            const loopEndY = height - (loopEnd - currentTime) * PIXELS_PER_SECOND;
            if (loopStartY > 0 || loopEndY < height) {
                ctx.fillStyle = 'rgba(201, 169, 110, 0.04)';
                ctx.fillRect(0, Math.max(0, loopEndY), width, Math.min(height, loopStartY) - Math.max(0, loopEndY));
                ctx.strokeStyle = 'rgba(201, 169, 110, 0.3)';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                [loopStartY, loopEndY].forEach(lineY => {
                    if (lineY >= 0 && lineY <= height) {
                        ctx.beginPath();
                        ctx.moveTo(0, lineY);
                        ctx.lineTo(width, lineY);
                        ctx.stroke();
                    }
                });
                ctx.setLineDash([]);
            }
        }

        if (isWaiting) {
            ctx.fillStyle = 'rgba(201, 169, 110, 0.03)';
            ctx.fillRect(0, 0, width, height);
        }
    }, [visibleNotes, currentTime, width, height, activeNotes, loopEnabled, loopStart, loopEnd, isWaiting, getKeyX, getKeyWidth]);

    // ── FX: detect new note impacts & update glows ─────────────────────
    useEffect(() => {
        const fx = fxRef.current;
        const hitY = height - 2;

        // Build current set of active MIDI notes (from user input)
        const currentActive = new Set();
        activeNotes.forEach((_vel, midi) => currentActive.add(midi));

        // Build current set of song active notes
        const currentSongActive = new Set();
        if (songActiveNotes) {
            songActiveNotes.forEach(n => currentSongActive.add(n.midi));
        }

        // Detect NEW note-on from user (wasn't active last frame)
        activeNotes.forEach((velocity, midi) => {
            if (!prevActiveRef.current.has(midi)) {
                const x = getKeyX(midi);
                const w = getKeyWidth(midi);
                fx.emit(x, hitY, w, velocity, FX_COLORS.rightHand);
            }
        });

        // Detect NEW note-on from song playback
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

        // Update active glow list
        const glows = [];
        activeNotes.forEach((velocity, midi) => {
            glows.push({
                x: getKeyX(midi),
                y: hitY,
                w: getKeyWidth(midi),
                color: FX_COLORS.rightHand,
                velocity,
            });
        });
        if (songActiveNotes) {
            for (const note of songActiveNotes) {
                const isRight = note.isRightHand !== false;
                glows.push({
                    x: getKeyX(note.midi),
                    y: hitY,
                    w: getKeyWidth(note.midi),
                    color: isRight ? FX_COLORS.rightHand : FX_COLORS.leftHand,
                    velocity: note.velocity || 0.7,
                });
            }
        }
        fx.setActiveGlows(glows);
    }, [activeNotes, songActiveNotes, height, getKeyX, getKeyWidth]);

    // ── FX animation loop (independent rAF) ─────────────────────────
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

                // Only resize if dimensions changed
                const targetW = width * dpr;
                const targetH = height * dpr;
                if (fxCanvas.width !== targetW || fxCanvas.height !== targetH) {
                    fxCanvas.width = targetW;
                    fxCanvas.height = targetH;
                }

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                fx.draw(ctx, width, height);
            } else if (fxCanvas && !fx.isActive) {
                // Clear when no effects
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

    // ── Draw main waterfall ───────────────────────────────────────────
    useEffect(() => {
        draw();
    }, [draw]);

    return (
        <div className={styles.waterfallContainer}>
            <canvas
                ref={canvasRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={styles.waterfallCanvas}
            />
            <canvas
                ref={fxCanvasRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={styles.fxCanvas}
            />
        </div>
    );
}
