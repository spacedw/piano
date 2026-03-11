import React, { useRef, useCallback, useEffect } from 'react';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, COLORS } from '@/engine/constants';
import styles from './index.module.css';

const TOTAL_WHITE_KEYS = 52;
const PIXELS_PER_SECOND = 150;

/**
 * Waterfall component renders falling notes on a Canvas.
 */
export default function Waterfall({
    visibleNotes = [],
    currentTime = 0,
    width = 1200,
    height = 400,
    activeNotes = new Map(),
    loopEnabled = false,
    loopStart = 0,
    loopEnd = 0,
    isWaiting = false,
}) {
    const canvasRef = useRef(null);

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
        </div>
    );
}
