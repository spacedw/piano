import React from 'react';
import styles from './index.module.css';

/**
 * Floating minimap showing the state of 3 piano pedals.
 * Dual-layer: shows both real-time MIDI input (cyan) and
 * song/recording playback (amber) pedal states.
 *
 * Props:
 *   liveSustain, liveSostenuto, liveSoft       — boolean, real-time MIDI
 *   playbackSustain, playbackSostenuto, playbackSoft — boolean, playback
 */
export default function PedalMinimap({
    liveSustain = false,
    liveSostenuto = false,
    liveSoft = false,
    playbackSustain = false,
    playbackSostenuto = false,
    playbackSoft = false,
}) {
    const pedals = [
        {
            key: 'soft',
            label: 'SOFT',
            live: liveSoft,
            playback: playbackSoft,
        },
        {
            key: 'sostenuto',
            label: 'SOS',
            live: liveSostenuto,
            playback: playbackSostenuto,
        },
        {
            key: 'sustain',
            label: 'SUS',
            live: liveSustain,
            playback: playbackSustain,
        },
    ];

    // Only show if at least one pedal has ever been pressed
    // (always visible for now — can auto-hide later if desired)

    return (
        <div className={styles.pedalMinimap}>
            {pedals.map(({ key, label, live, playback }) => {
                const anyActive = live || playback;
                const both = live && playback;

                const bodyClasses = [
                    styles.pedalBody,
                    anyActive && styles.pressed,
                    both ? styles.bothGlow
                        : live ? styles.liveGlow
                        : playback ? styles.playbackGlow
                        : null,
                ].filter(Boolean).join(' ');

                const labelClasses = [
                    styles.pedalLabel,
                    both ? styles.bothActive
                        : live ? styles.liveActive
                        : playback ? styles.playbackActive
                        : null,
                ].filter(Boolean).join(' ');

                return (
                    <div key={key} className={styles.pedal}>
                        <div className={bodyClasses}>
                            {/* Playback layer (bottom) */}
                            <div className={`${styles.playbackIndicator} ${playback ? styles.active : ''}`} />
                            {/* Live layer (top, composites over playback) */}
                            <div className={`${styles.liveIndicator} ${live ? styles.active : ''}`} />
                        </div>
                        <span className={labelClasses}>{label}</span>
                    </div>
                );
            })}

            {/* Legend */}
            <div className={styles.legend}>
                <div className={styles.legendItem}>
                    <div className={`${styles.legendDot} ${styles.legendDotLive}`} />
                    <span className={styles.legendText}>Live</span>
                </div>
                <div className={styles.legendItem}>
                    <div className={`${styles.legendDot} ${styles.legendDotPlayback}`} />
                    <span className={styles.legendText}>Song</span>
                </div>
            </div>
        </div>
    );
}
