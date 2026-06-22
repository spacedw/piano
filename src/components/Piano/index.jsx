import React, { useMemo } from 'react';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, midiToNoteName } from '@/engine/constants';
import styles from './index.module.css';

const TOTAL_WHITE_KEYS = 52;

const NOTE_NAMES_ES = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const NOTE_NAMES_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const ALL_KEYS = Array.from({ length: LAST_NOTE - FIRST_NOTE + 1 }, (_, i) => FIRST_NOTE + i);
const WHITE_KEYS = ALL_KEYS.filter(m => !isBlackKey(m));
const BLACK_KEYS = ALL_KEYS.filter(m => isBlackKey(m));

function noteShort(midi, notation = 'solfege') {
    const n = notation === 'letters' ? NOTE_NAMES_EN[midi % 12] : NOTE_NAMES_ES[midi % 12];
    return n.replace('#', '\u266F');
}

/**
 * Piano component renders an 88-key piano using semantic HTML (DOM).
 * Highlights keys based on active MIDI input and song playback notes.
 *
 * @param {Map} activeNotes - Map<midi, velocity> from user input
 * @param {Array} songActiveNotes - Array of {midi, velocity, isRightHand} from song playback
 * @param {function} onNoteOn - callback(midi, velocity)
 * @param {function} onNoteOff - callback(midi)
 * @param {number} width - (unused, fills container)
 * @param {number} height - piano height in px
 * @param {Set|Map} ghostNotes - Set/Map of midi numbers to show as ghost (upcoming)
 * @param {boolean} showLabels - show note labels on keys
 * @param {Object} fingerGuides - map of midi -> finger number
 * @param {string} language - 'en' or 'es'
 */
export default function Piano({
    activeNotes = new Map(),
    songActiveNotes = [],
    onNoteOn,
    onNoteOff,
    width,
    height = 140,
    ghostNotes,
    showLabels = false,
    fingerGuides,
    language = 'en',
    notation = 'solfege',
}) {
    // Build active set combining user + song notes
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

    const ghostSet = useMemo(() => {
        if (!ghostNotes) return new Set();
        if (ghostNotes instanceof Set) return ghostNotes;
        if (ghostNotes instanceof Map) return new Set(ghostNotes.keys());
        return new Set();
    }, [ghostNotes]);

    const handlePress = (midi, down) => {
        if (down) {
            onNoteOn?.(midi, 0.8);
        } else {
            onNoteOff?.(midi);
        }
    };

    return (
        <div
            className={styles.piano}
            style={{ '--piano-h': `${height}px`, '--white-count': TOTAL_WHITE_KEYS }}
        >
            <div className={styles.pianoFelt} />
            <div className={styles.pianoWhites}>
                {WHITE_KEYS.map((midi) => {
                    const active = activeSet.get(midi);
                    const ghost = ghostSet.has(midi);
                    const isC = midi % 12 === 0;
                    const showThisLabel = showLabels || isC;

                    let keyClass = `${styles.pkey} ${styles.pkeyWhite}`;
                    if (active) {
                        const isRight = active.source === 'user' || active.isRightHand !== false;
                        keyClass += isRight
                            ? ` ${styles.pkeyWhiteActive}`
                            : ` ${styles.pkeyWhiteActiveLeft}`;
                    }
                    if (ghost) keyClass += ` ${styles.pkeyWhiteGhost}`;

                    return (
                        <button
                            key={midi}
                            className={keyClass}
                            onMouseDown={() => handlePress(midi, true)}
                            onMouseUp={() => handlePress(midi, false)}
                            onMouseLeave={() => handlePress(midi, false)}
                        >
                            {showThisLabel && (
                                <span className={styles.pkeyLabel}>
                                    {showLabels
                                        ? noteShort(midi, notation)
                                        : `${notation === 'letters' ? 'C' : 'Do'}${Math.floor(midi / 12) - 1}`
                                    }
                                </span>
                            )}
                            {fingerGuides?.[midi] && (
                                <span className={styles.pkeyFinger}>{fingerGuides[midi]}</span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className={styles.pianoBlacks}>
                {BLACK_KEYS.map((midi) => {
                    const active = activeSet.get(midi);
                    const ghost = ghostSet.has(midi);

                    // Position: between the white key before and after
                    const whiteBefore = WHITE_KEYS.filter(w => w < midi).length - 1;
                    const left = `calc(${whiteBefore + 1} * (100% / var(--white-count)) - (100% / var(--white-count)) * 0.32)`;

                    let keyClass = `${styles.pkey} ${styles.pkeyBlack}`;
                    if (active) {
                        const isRight = active.source === 'user' || active.isRightHand !== false;
                        keyClass += isRight
                            ? ` ${styles.pkeyBlackActive}`
                            : ` ${styles.pkeyBlackActiveLeft}`;
                    }
                    if (ghost) keyClass += ` ${styles.pkeyBlackGhost}`;

                    return (
                        <button
                            key={midi}
                            className={keyClass}
                            style={{ left }}
                            onMouseDown={() => handlePress(midi, true)}
                            onMouseUp={() => handlePress(midi, false)}
                            onMouseLeave={() => handlePress(midi, false)}
                        >
                            {fingerGuides?.[midi] && (
                                <span className={styles.pkeyFinger}>{fingerGuides[midi]}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
