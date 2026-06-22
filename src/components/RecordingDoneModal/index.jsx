import React, { useState, useMemo } from 'react';
import * as I from '@/components/Icons';
import { Modal } from '@/components/ui';
import { useLocale } from '@/i18n';
import styles from './index.module.css';

/**
 * Recording post-session modal: mini waterfall preview, stats grid,
 * recording name input, save/export/discard buttons.
 */
export default function RecordingDoneModal({ open, onClose, onSave, onExport, recordingData }) {
    const { locale: language } = useLocale();
    const t = (es, en) => language === 'es' ? es : en;
    const [name, setName] = useState(() => {
        const now = new Date();
        const months = language === 'es'
            ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
            : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${t('Sesi\u00f3n espont\u00e1nea', 'Spontaneous session')} \u2014 ${months[now.getMonth()]} ${now.getDate()}`;
    });

    /* Waterfall bars (deterministic from data or random for demo) */
    const bars = useMemo(() => {
        return [...Array(40)].map((_, i) => ({
            h: 8 + Math.abs(Math.sin(i * 1.3)) * 50,
            accent: i % 4 === 0,
        }));
    }, []);

    /* Stats (from recordingData or mock) */
    const stats = useMemo(() => {
        if (recordingData) {
            const dur = recordingData.duration || 0;
            return {
                duration: `${Math.floor(dur / 60)}:${(Math.floor(dur % 60)).toString().padStart(2, '0')}`,
                notes: String(recordingData.noteCount || recordingData.events?.length || 0),
                score: String(recordingData.score || '--'),
                accuracy: recordingData.accuracy != null ? `${recordingData.accuracy}%` : '--',
            };
        }
        return { duration: '3:04', notes: '284', score: '92', accuracy: '96%' };
    }, [recordingData]);

    if (!open) return null;

    return (
        <Modal open onClose={onClose} width={560}>
            <div className={styles.head}>
                <div>
                    <div className={styles.recIndicator}>
                        <span className={styles.recDot} />
                        {t('Grabaci\u00f3n finalizada', 'Recording finished')}
                    </div>
                    <h3 className={styles.title}>{t('Tu performance', 'Your performance')}</h3>
                </div>
                <button className={styles.closeBtn} onClick={onClose}><I.Close size={14} /></button>
            </div>

            <div className={styles.body}>
                {/* Mini waterfall preview */}
                <div className={styles.waterfall}>
                    {bars.map((b, i) => (
                        <div
                            key={i}
                            className={`${styles.waterfallBar} ${b.accent ? styles.waterfallBarAccent : ''}`}
                            style={{ height: b.h }}
                        />
                    ))}
                    <div className={styles.waterfallLine} />
                </div>

                {/* Stats grid */}
                <div className={styles.statsGrid}>
                    <StatCard icon={<I.Clock size={14} />} label={t('Duraci\u00f3n', 'Duration')} value={stats.duration} />
                    <StatCard icon={<I.Note size={14} />} label={t('Notas', 'Notes')} value={stats.notes} />
                    <StatCard icon={<I.Trophy size={14} />} label="Score" value={stats.score} />
                    <StatCard icon={<I.Check size={14} />} label={t('Precisi\u00f3n', 'Accuracy')} value={stats.accuracy} />
                </div>

                {/* Name input */}
                <div className={styles.nameSection}>
                    <div className={styles.nameLabel}>{t('Nombre de la grabaci\u00f3n', 'Recording name')}</div>
                    <input className={styles.nameInput} value={name} onChange={e => setName(e.target.value)} />
                </div>

                {/* Action buttons */}
                <div className={styles.actions}>
                    <button className={styles.btnSave} onClick={() => onSave?.(name)}>
                        <I.Check size={14} /> {t('Guardar', 'Save')}
                    </button>
                    <button className={styles.btnExport} onClick={() => onExport?.(name)}>
                        <I.Download size={14} /> {t('Exportar MIDI', 'Export MIDI')}
                    </button>
                    <button className={styles.btnDiscard} onClick={onClose}>
                        {t('Descartar', 'Discard')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

/* ── StatCard ──────────────────────────────────── */
function StatCard({ icon, label, value }) {
    return (
        <div className={styles.statCard}>
            <div className={styles.statHead}>
                {icon}
                <span className={styles.statLabel}>{label}</span>
            </div>
            <div className={styles.statVal}>{value}</div>
        </div>
    );
}
