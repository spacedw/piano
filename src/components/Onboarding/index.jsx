import React, { useState } from 'react';
import * as I from '@/components/Icons';
import { useLocale } from '@/i18n';
import styles from './index.module.css';

/**
 * 4-step onboarding flow: Welcome, Connect MIDI, Import Song, Start Playing.
 * Left text + right illustration layout with progress dots.
 */
export default function Onboarding({ open, onComplete }) {
    const { locale: language } = useLocale();
    const t = (es, en) => language === 'es' ? es : en;
    const [step, setStep] = useState(0);

    if (!open) return null;

    const steps = [
        {
            eyebrow: t('Bienvenido', 'Welcome'),
            title: t('Te damos la bienvenida a PianoApp', 'Welcome to PianoApp'),
            desc: t(
                'Una herramienta de pr\u00e1ctica para pianistas serios. Conecta tu teclado MIDI, importa partituras y mide tu progreso.',
                'A practice tool for serious pianists. Connect MIDI, import scores, track progress.'
            ),
            illo: 'welcome',
        },
        {
            eyebrow: t('Paso 1 de 3', 'Step 1 of 3'),
            title: t('Conecta tu teclado MIDI', 'Connect your MIDI keyboard'),
            desc: t(
                'Detectaremos tu instrumento autom\u00e1ticamente. Si no tienes uno, puedes practicar con el teclado virtual.',
                'We auto-detect your instrument. No keyboard? Use the on-screen one.'
            ),
            illo: 'midi',
        },
        {
            eyebrow: t('Paso 2 de 3', 'Step 2 of 3'),
            title: t('Importa tu primera pieza', 'Import your first piece'),
            desc: t(
                'Arrastra un archivo .mid, o explora la comunidad para empezar a tocar de inmediato.',
                'Drop a .mid file, or browse community pieces to start playing right away.'
            ),
            illo: 'library',
        },
        {
            eyebrow: t('Listo', 'Ready'),
            title: t('A practicar', 'Time to play'),
            desc: t(
                'El waterfall te muestra qu\u00e9 tocar; las teclas se iluminan cuando aciertas. \u00a1Disfruta!',
                'The waterfall shows what to play; keys glow when you hit them. Enjoy.'
            ),
            illo: 'play',
        },
    ];

    const s = steps[step];

    return (
        <div className={styles.shell}>
            <div className={styles.card}>
                <button className={styles.skipBtn} onClick={onComplete}>{t('Saltar', 'Skip')}</button>
                <div className={styles.layout}>
                    {/* Left: text */}
                    <div className={styles.textSide}>
                        <div className={styles.eyebrow}>{s.eyebrow}</div>
                        <h2 className={styles.title}>{s.title}</h2>
                        <p className={styles.desc}>{s.desc}</p>

                        <div className={styles.controls}>
                            {step > 0 && (
                                <button className={styles.backBtn} onClick={() => setStep(step - 1)}>
                                    <I.ArrowLeft size={14} />
                                </button>
                            )}
                            <button className={styles.nextBtn} onClick={() => step === steps.length - 1 ? onComplete() : setStep(step + 1)}>
                                {step === steps.length - 1 ? t('Empezar a tocar', 'Start playing') : t('Continuar', 'Continue')}
                                <I.ArrowRight size={14} />
                            </button>
                            <div className={styles.dots}>
                                {steps.map((_, i) => (
                                    <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Right: illustration */}
                    <div className={styles.illoSide}>
                        <Illo type={s.illo} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Illustrations ─────────────────────────────── */
function Illo({ type }) {
    if (type === 'welcome') {
        return (
            <div className={styles.illoCenter}>
                <div className={styles.illoGlow} />
                <svg viewBox="0 0 200 200" width="200" height="200" className={styles.illoSvg}>
                    <circle cx="100" cy="100" r="60" fill="none" stroke="var(--gold, #C9A96E)" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(201,169,110,0.3)" strokeWidth="0.5" strokeDasharray="2 4" />
                    <text x="100" y="115" textAnchor="middle" fontFamily="var(--font-display)" fontSize="56" fontWeight="200" fill="var(--gold, #C9A96E)">P</text>
                </svg>
            </div>
        );
    }

    if (type === 'midi') {
        return (
            <div className={styles.illoCenter}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                    <I.Midi size={80} stroke="var(--gold, #C9A96E)" strokeWidth={0.8} />
                    <div style={{ display: 'flex', gap: 4 }}>
                        {[...Array(12)].map((_, i) => (
                            <div key={i} style={{
                                width: 8,
                                height: i % 3 === 1 ? 28 : 40,
                                background: i % 5 === 2 ? 'var(--gold, #C9A96E)' : 'rgba(255,255,255,0.08)',
                                borderRadius: 1,
                            }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'library') {
        return (
            <div className={styles.illoCenter} style={{ padding: 30 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 90px)', gap: 12 }}>
                    {['C', 'D', 'S', 'B'].map(letter => (
                        <div key={letter} className={styles.illoCard}>{letter}</div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'play') {
        return (
            <div className={styles.illoPlay}>
                <div className={styles.illoGlowLine} />
                <div className={styles.illoHitLine} />
                {/* Falling notes */}
                {[
                    { x: '20%', y: 40, w: 14, h: 60 },
                    { x: '40%', y: 100, w: 14, h: 40 },
                    { x: '55%', y: 20, w: 10, h: 80 },
                    { x: '70%', y: 80, w: 14, h: 50 },
                ].map((n, i) => (
                    <div key={i} style={{
                        position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
                        background: 'linear-gradient(180deg, var(--gold-50, #F6EAD0), var(--gold, #C9A96E))',
                        borderRadius: 4,
                        boxShadow: '0 0 12px rgba(201,169,110,0.35)',
                    }} />
                ))}
                {/* Mini keyboard */}
                <div className={styles.illoKeyboard}>
                    {[...Array(14)].map((_, i) => <div key={i} className={styles.illoKey} />)}
                </div>
            </div>
        );
    }

    return null;
}
