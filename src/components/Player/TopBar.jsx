import React from 'react';
import { Midi, Note, Settings as SettingsIcon } from '@/components/Icons';
import { useT } from '@/i18n';
import styles from './index.module.css';

/**
 * TopBar: now-playing song info + status bar.
 *
 * @param {Object} song - { name, artist, bpm, totalNotes, difficulty }
 * @param {boolean} midiConnected - MIDI device connected
 * @param {string} midiDeviceName - name of connected MIDI device
 * @param {boolean} sustain - sustain pedal active
 * @param {boolean} sostenuto - sostenuto pedal active
 * @param {boolean} soft - soft pedal active
 * @param {boolean} recording - recording in progress
 * @param {number} recordingTime - recording elapsed seconds
 * @param {boolean} practiceOpen - practice panel is open
 * @param {function} onPracticeToggle
 * @param {function} onMidiClick - callback when MIDI chip clicked
 * @param {boolean} micActive - microphone mode active
 * @param {function} onMicToggle - callback when mic chip clicked
 * @param {number} micClarity - microphone signal clarity 0-1
 */
export default function TopBar({
    song,
    midiConnected = false,
    midiDeviceName = '',
    sustain = false,
    sostenuto = false,
    soft = false,
    recording = false,
    recordingTime = 0,
    practiceOpen = false,
    onPracticeToggle,
    onMidiClick,
    micActive = false,
    onMicToggle,
    micClarity = 0,
    audioLoaded = true,
}) {
    const t = useT();

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    return (
        <div className={styles.topBar}>
            {/* Now Playing */}
            <div className={styles.nowPlaying}>
                <div className={styles.nowPlayingCover}>
                    {song ? (
                        <Note size={16} />
                    ) : (
                        <span style={{ opacity: 0.4 }}>&mdash;</span>
                    )}
                </div>
                <div className={styles.nowPlayingInfo}>
                    <div className={styles.nowPlayingTitle}>
                        {song?.name || t('player.noSong')}
                    </div>
                    {song?.artist && (
                        <div className={styles.nowPlayingArtist}>{song.artist}</div>
                    )}
                </div>
            </div>

            {/* Status Strip */}
            <div className={styles.statusStrip}>
                {/* MIDI status chip */}
                <button
                    className={`${styles.statusChip} ${midiConnected ? styles.statusOk : ''}`}
                    onClick={onMidiClick}
                >
                    <span className={`${styles.led} ${midiConnected ? styles.ledOk : ''}`} />
                    <Midi size={14} />
                    <span>
                        {midiConnected
                            ? `MIDI \u00B7 ${midiDeviceName || t('player.midiConnected')}`
                            : t('player.noMidi')
                        }
                    </span>
                </button>

                {/* Microphone status chip */}
                <button
                    className={`${styles.statusChip} ${micActive ? styles.statusOk : ''}`}
                    onClick={onMicToggle}
                    title={t('mic.tooltip')}
                >
                    <span className={`${styles.led} ${micActive ? styles.ledOk : ''}`} />
                    <span style={{ fontSize: 14 }}>🎙</span>
                    <span>
                        {micActive ? t('mic.active') : t('mic.inactive')}
                    </span>
                    {micActive && (
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'flex-end',
                                gap: 1,
                                marginLeft: 4,
                                height: 12,
                            }}
                            title={micClarity > 0.85 ? t('mic.signalGood') : micClarity < 0.3 ? t('mic.signalWeak') : ''}
                        >
                            <span style={{
                                width: 3,
                                height: 6,
                                borderRadius: 1,
                                background: micClarity > 0 ? (micClarity < 0.3 ? '#c44' : micClarity > 0.85 ? '#4e4' : '#aaa') : '#555',
                                opacity: micClarity > 0 ? 1 : 0.3,
                            }} />
                            <span style={{
                                width: 3,
                                height: 9,
                                borderRadius: 1,
                                background: micClarity > 0.4 ? (micClarity > 0.85 ? '#4e4' : '#dd4') : (micClarity < 0.3 && micClarity > 0 ? '#c44' : '#555'),
                                opacity: micClarity > 0.4 ? 1 : (micClarity > 0 ? 0.35 : 0.3),
                            }} />
                            <span style={{
                                width: 3,
                                height: 12,
                                borderRadius: 1,
                                background: micClarity > 0.7 ? (micClarity > 0.85 ? '#4e4' : '#6d6') : (micClarity < 0.3 && micClarity > 0 ? '#c44' : '#555'),
                                opacity: micClarity > 0.7 ? 1 : (micClarity > 0 ? 0.35 : 0.3),
                            }} />
                        </span>
                    )}
                </button>

                {/* Pedal indicators */}
                <div className={styles.pedalStack}>
                    <span className={`${styles.pedalDot} ${sustain ? styles.pedalOn : ''}`} title="Sustain">
                        Sus
                    </span>
                    <span className={`${styles.pedalDot} ${sostenuto ? styles.pedalOn : ''}`} title="Sostenuto">
                        Sost
                    </span>
                    <span className={`${styles.pedalDot} ${soft ? styles.pedalOn : ''}`} title="Una corda">
                        Soft
                    </span>
                </div>

                {/* Audio loading indicator */}
                {!audioLoaded && (
                    <div className={styles.statusChip} title="Cargando sonidos del piano…" style={{ color: '#C9A96E', borderColor: 'rgba(201,169,110,0.3)', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #C9A96E', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: 11 }}>Cargando piano…</span>
                    </div>
                )}

                {/* Recording badge */}
                {recording && (
                    <div className={styles.recBadge}>
                        <span className={styles.recPulse} />
                        <span>REC</span>
                        <span className="t-mono" style={{ marginLeft: 4 }}>
                            {formatTime(recordingTime)}
                        </span>
                    </div>
                )}

                {/* Practice panel toggle */}
                <button
                    className={`${styles.practiceFab} ${practiceOpen ? styles.practiceFabActive : ''}`}
                    onClick={onPracticeToggle}
                    title={t('practice.title')}
                >
                    <SettingsIcon size={16} />
                </button>
            </div>
        </div>
    );
}
