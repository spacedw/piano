import React from 'react';
import { Close, Hand, Loop, Metronome } from '@/components/Icons';
import { Toggle, Slider } from '@/components/ui';
import { useT } from '@/i18n';
import styles from './index.module.css';

/**
 * PracticePanel: slide-out right panel with practice/coaching controls.
 *
 * @param {boolean} open - panel visible
 * @param {function} onClose
 * @param {Object} settings - { waitMode, hands, loop, loopStart, loopEnd, metro, bpm, countIn }
 * @param {function} setSettings - (newSettings) => void
 * @param {string} language - 'en' | 'es'
 * @param {boolean} isWaiting - currently paused in wait mode
 * @param {number} metronomeCurrentBeat - current beat index
 * @param {number} metronomeBeatsPerMeasure - beats per measure
 */
export default function PracticePanel({
    open = false,
    onClose,
    settings = {},
    setSettings,
    language = 'en',
    isWaiting = false,
    metronomeCurrentBeat = -1,
    metronomeBeatsPerMeasure = 4,
}) {
    const t = useT();

    const {
        waitMode = false,
        hands = 'both',
        loop = false,
        loopStart = 0,
        loopEnd = 0,
        metro = false,
        bpm = 120,
        countIn = 0,
    } = settings;

    const update = (patch) => setSettings?.({ ...settings, ...patch });

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    return (
        <div className={`${styles.practicePanel} ${open ? styles.practicePanelOpen : ''}`}>
            <div className={styles.practiceHeader}>
                <div>
                    <div className="t-eyebrow">{t('practice.coach')}</div>
                    <div className="t-display" style={{ fontSize: 18, marginTop: 2 }}>
                        {t('practice.title')}
                    </div>
                </div>
                <button className={styles.btnIcon} onClick={onClose}>
                    <Close size={14} />
                </button>
            </div>

            {/* Wait Mode */}
            <div className={styles.practiceSection}>
                <div className={styles.practiceRow}>
                    <div>
                        <div className="t-label" style={{ color: 'var(--ink-1)', fontWeight: 500 }}>
                            {t('practice.waitMode')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                            {t('practice.waitModeHint')}
                        </div>
                    </div>
                    <Toggle checked={waitMode} onChange={v => update({ waitMode: v })} />
                </div>
            </div>

            {/* Hands */}
            <div className={styles.practiceSection}>
                <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                    {t('practice.hands')}
                </div>
                <div className={styles.handToggle}>
                    {[
                        { id: 'both', label: t('practice.handBoth') },
                        { id: 'right', label: t('practice.handRight') },
                        { id: 'left', label: t('practice.handLeft') },
                    ].map(h => (
                        <button
                            key={h.id}
                            className={`${styles.handBtn} ${hands === h.id ? styles.handActive : ''}`}
                            onClick={() => update({ hands: h.id })}
                        >
                            <Hand size={14} />
                            <span>{h.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Loop A/B */}
            <div className={styles.practiceSection}>
                <div className={styles.practiceRow} style={{ marginBottom: 12 }}>
                    <div className="t-label" style={{ color: 'var(--ink-1)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Loop size={14} /> {t('practice.loop')}
                    </div>
                    <Toggle checked={loop} onChange={v => update({ loop: v })} />
                </div>
                {loop && (
                    <div className={styles.loopControls}>
                        <button className={styles.loopBtn} onClick={() => {
                            const currentTime = document.querySelector('audio')?.currentTime || 0;
                            update({ loopStart: currentTime });
                        }}>
                            A: {formatTime(loopStart)}
                        </button>
                        <span className="t-mono" style={{ color: 'var(--ink-4)' }}>&rarr;</span>
                        <button className={styles.loopBtn} onClick={() => {
                            const currentTime = document.querySelector('audio')?.currentTime || 0;
                            update({ loopEnd: currentTime });
                        }}>
                            B: {formatTime(loopEnd)}
                        </button>
                        <button
                            className={`${styles.loopBtn} ${styles.loopBtnGhost}`}
                            style={{ marginLeft: 'auto' }}
                            onClick={() => update({ loopStart: 0, loopEnd: 0, loop: false })}
                        >
                            {t('practice.loopClear')}
                        </button>
                    </div>
                )}
            </div>

            {/* Metronome */}
            <div className={styles.practiceSection}>
                <div className={styles.practiceRow} style={{ marginBottom: 12 }}>
                    <div className="t-label" style={{ color: 'var(--ink-1)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Metronome size={14} /> {t('practice.metronome')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`${styles.metroTick} ${metro ? styles.metroActive : ''}`} />
                        <Toggle checked={metro} onChange={v => update({ metro: v })} />
                    </div>
                </div>
                {metro && (
                    <Slider
                        value={bpm}
                        min={20}
                        max={300}
                        onChange={v => update({ bpm: v })}
                        suffix=" BPM"
                        label=""
                    />
                )}
                {metro && metronomeCurrentBeat >= 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {Array.from({ length: metronomeBeatsPerMeasure }, (_, i) => (
                            <div
                                key={i}
                                style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: metronomeCurrentBeat === i
                                        ? (i === 0 ? 'var(--gold)' : 'var(--gold-200)')
                                        : 'var(--ink-5)',
                                    transition: 'all 100ms',
                                    transform: metronomeCurrentBeat === i ? 'scale(1.3)' : 'scale(1)',
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Count-in */}
            <div className={styles.practiceSection}>
                <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                    {t('practice.countIn')}
                </div>
                <div className={styles.countInToggle}>
                    {[0, 1, 2, 4].map(c => (
                        <button
                            key={c}
                            className={`${styles.handBtn} ${countIn === c ? styles.handActive : ''}`}
                            onClick={() => update({ countIn: c })}
                            style={{ flex: 1 }}
                        >
                            <span className="t-mono">{c === 0 ? t('settings.off') : `${c}`}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
