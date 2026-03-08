import React, { useRef, useCallback, useEffect } from 'react';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, COLORS } from '../../engine/constants';
import './Waterfall.css';

const TOTAL_WHITE_KEYS = 52;
const PIXELS_PER_SECOND = 150; // How many pixels represent 1 second

/**
 * Waterfall component renders falling notes on a Canvas.
 * Notes fall from top to bottom, reaching the piano at the bottom.
 */
export default function Waterfall({
    visibleNotes = [],
    currentTime = 0,
    width = 1200,
    height = 400,
    activeNotes = new Map(),
}) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);

    // Calculate key positions matching the Piano component
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

    // Draw waterfall
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, width, height);

        // Grid lines (subtle beat markers)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const beatInterval = PIXELS_PER_SECOND; // One line per second
        const timeOffset = currentTime % 1;
        for (let y = height + timeOffset * PIXELS_PER_SECOND; y > -PIXELS_PER_SECOND; y -= beatInterval) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Subtle vertical guides for every octave
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi += 12) {
            const x = getKeyX(midi);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw notes
        for (const note of visibleNotes) {
            const x = getKeyX(note.midi);
            const w = getKeyWidth(note.midi);
            const noteHeight = Math.max(note.duration * PIXELS_PER_SECOND, 4);

            // Note's Y position: bottom of canvas = currentTime, notes in future go up
            const y = height - (note.time - currentTime + note.duration) * PIXELS_PER_SECOND;

            // Choose colors based on hand/track
            const isRight = note.isRightHand !== false;
            const baseColor = isRight ? COLORS.waterfall.rightHand : COLORS.waterfall.leftHand;
            const borderColor = isRight ? COLORS.waterfall.rightHandBorder : COLORS.waterfall.leftHandBorder;

            // Check if note is currently active
            const isActive = note.time <= currentTime && note.time + note.duration > currentTime;

            // Draw note rectangle with rounded corners
            const radius = 3;
            ctx.beginPath();
            ctx.roundRect(x + 1, y, w - 2, noteHeight, radius);

            // Fill with gradient
            const grad = ctx.createLinearGradient(x, y, x, y + noteHeight);
            if (isActive) {
                // Active note: brighter
                grad.addColorStop(0, isRight ? 'rgba(232, 213, 168, 0.95)' : 'rgba(170, 185, 215, 0.95)');
                grad.addColorStop(1, baseColor);
            } else {
                grad.addColorStop(0, baseColor);
                grad.addColorStop(1, baseColor);
            }
            ctx.fillStyle = grad;
            ctx.fill();

            // Border
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Glow effect for active notes
            if (isActive) {
                ctx.shadowColor = isRight ? COLORS.accentGold : COLORS.leftHand;
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Hit line (where notes meet the piano)
        const hitLineY = height - 2;
        const hitGrad = ctx.createLinearGradient(0, hitLineY - 2, 0, hitLineY);
        hitGrad.addColorStop(0, 'rgba(201, 169, 110, 0)');
        hitGrad.addColorStop(1, 'rgba(201, 169, 110, 0.6)');
        ctx.fillStyle = hitGrad;
        ctx.fillRect(0, hitLineY - 2, width, 2);

        // Active key indicators (show what user is pressing)
        activeNotes.forEach((velocity, midi) => {
            const x = getKeyX(midi);
            const w = getKeyWidth(midi);
            // Small glow bar at the bottom
            const glowGrad = ctx.createLinearGradient(0, height - 20, 0, height);
            glowGrad.addColorStop(0, 'rgba(201, 169, 110, 0)');
            glowGrad.addColorStop(1, `rgba(201, 169, 110, ${velocity * 0.5})`);
            ctx.fillStyle = glowGrad;
            ctx.fillRect(x, height - 20, w, 20);
        });
    }, [visibleNotes, currentTime, width, height, activeNotes, getKeyX, getKeyWidth]);

    useEffect(() => {
        draw();
    }, [draw]);

    return (
        <div className="waterfall-container">
            <canvas
                ref={canvasRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                className="waterfall-canvas"
            />
        </div>
    );
}
