import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, midiToNoteName, COLORS } from '@/engine/constants';
import styles from './index.module.css';

const TOTAL_WHITE_KEYS = 52;

/**
 * Piano component renders an 88-key piano using Canvas.
 * Highlights keys based on active MIDI input and song playback notes.
 */
export default function Piano({ activeNotes = new Map(), songActiveNotes = [], width = 1200, height = 160 }) {
    const canvasRef = useRef(null);

    // Build key layout
    const keys = useMemo(() => {
        const whiteKeyWidth = width / TOTAL_WHITE_KEYS;
        const blackKeyWidth = whiteKeyWidth * 0.6;
        const blackKeyHeight = height * 0.62;
        const keyList = [];
        let whiteIndex = 0;

        for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
            const black = isBlackKey(midi);
            if (black) {
                const x = whiteIndex * whiteKeyWidth - blackKeyWidth / 2;
                keyList.push({
                    midi,
                    isBlack: true,
                    x,
                    y: 0,
                    width: blackKeyWidth,
                    height: blackKeyHeight,
                    name: midiToNoteName(midi),
                });
            } else {
                keyList.push({
                    midi,
                    isBlack: false,
                    x: whiteIndex * whiteKeyWidth,
                    y: 0,
                    width: whiteKeyWidth - 1,
                    height: height,
                    name: midiToNoteName(midi),
                });
                whiteIndex++;
            }
        }
        return keyList;
    }, [width, height]);

    const activeSet = useMemo(() => {
        const set = new Map();
        activeNotes.forEach((velocity, midi) => {
            set.set(midi, { velocity, source: 'user' });
        });
        songActiveNotes.forEach(note => {
            if (!set.has(note.midi)) {
                set.set(note.midi, { velocity: note.velocity, source: 'song', isRightHand: note.isRightHand });
            }
        });
        return set;
    }, [activeNotes, songActiveNotes]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        for (const key of keys) {
            if (key.isBlack) continue;
            const active = activeSet.get(key.midi);

            if (active) {
                const isRight = active.source === 'user' || active.isRightHand;
                if (active.source === 'user') {
                    ctx.fillStyle = COLORS.accentLight;
                } else {
                    ctx.fillStyle = isRight ? COLORS.accentGold : COLORS.leftHand;
                }
                // Glow flash on active white keys
                ctx.shadowColor  = isRight ? COLORS.accentGold : COLORS.leftHand;
                ctx.shadowBlur   = 14;
            } else {
                ctx.fillStyle  = COLORS.whiteKey;
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(key.x, key.y, key.width, key.height);
            ctx.shadowBlur = 0;   // reset after fill so stroke isn't affected

            ctx.strokeStyle = '#D0D0D0';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(key.x, key.y, key.width, key.height);

            if (key.name.startsWith('C') && !key.name.includes('#')) {
                ctx.fillStyle = active ? '#0A0A0B' : COLORS.textSecondary;
                ctx.font = '9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(key.name, key.x + key.width / 2, key.height - 6);
            }
        }

        for (const key of keys) {
            if (!key.isBlack) continue;
            const active = activeSet.get(key.midi);

            if (active) {
                const isRight = active.source === 'user' || active.isRightHand;
                if (active.source === 'user') {
                    ctx.fillStyle = COLORS.accentGold;
                } else {
                    ctx.fillStyle = isRight
                        ? 'rgba(201, 169, 110, 0.9)'
                        : 'rgba(139, 157, 195, 0.9)';
                }
                // Glow flash on active black keys
                ctx.shadowColor = isRight ? COLORS.accentGold : COLORS.leftHand;
                ctx.shadowBlur  = 16;
            } else {
                const grad = ctx.createLinearGradient(key.x, 0, key.x, key.height);
                grad.addColorStop(0, '#2A2A2E');
                grad.addColorStop(1, '#0A0A0B');
                ctx.fillStyle  = grad;
                ctx.shadowBlur = 0;
            }

            const r = 2;
            ctx.beginPath();
            ctx.moveTo(key.x + r, key.y);
            ctx.lineTo(key.x + key.width - r, key.y);
            ctx.quadraticCurveTo(key.x + key.width, key.y, key.x + key.width, key.y + r);
            ctx.lineTo(key.x + key.width, key.height);
            ctx.lineTo(key.x, key.height);
            ctx.lineTo(key.x, key.y + r);
            ctx.quadraticCurveTo(key.x, key.y, key.x + r, key.y);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;  // reset so shine overlay has no glow

            if (!active) {
                const shine = ctx.createLinearGradient(key.x, 0, key.x, key.height * 0.3);
                shine.addColorStop(0, 'rgba(255,255,255,0.08)');
                shine.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = shine;
                ctx.fill();
            }
        }

        const shadowGrad = ctx.createLinearGradient(0, height - 4, 0, height);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(0, height - 4, width, 4);
    }, [keys, activeSet, width, height]);

    useEffect(() => {
        draw();
    }, [draw]);

    return (
        <div className={styles.pianoContainer}>
            <canvas
                ref={canvasRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={styles.pianoCanvas}
            />
        </div>
    );
}
