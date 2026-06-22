import React, { useState } from 'react';
import * as I from '@/components/Icons';
import { Modal, Pill } from '@/components/ui';
import { useLocale } from '@/i18n';
import styles from './index.module.css';

const LS_MONTHLY_URL = import.meta.env.VITE_LS_MONTHLY_URL || '';
const LS_YEARLY_URL  = import.meta.env.VITE_LS_YEARLY_URL  || '';

/**
 * Pricing modal: Free vs Supporter comparison with monthly/annual toggle.
 *
 * Props:
 *  open       — boolean
 *  onClose    — () => void
 *  userId     — Supabase user UUID (injected as LemonSqueezy custom_data so the
 *               webhook knows which profile to upgrade)
 */
export default function PricingModal({ open, onClose, userId }) {
    const { locale: language } = useLocale();
    const t = (es, en) => language === 'es' ? es : en;
    const [billing, setBilling] = useState('annual');

    if (!open) return null;

    const features = [
        { f: t('Práctica local con MIDI', 'Local practice with MIDI'),         free: true,          pro: true },
        { f: t('Importar archivos MIDI', 'Import MIDI files'),                  free: true,          pro: true },
        { f: t('Estadísticas y heatmap', 'Stats & heatmap'),                   free: true,          pro: true },
        { f: t('Subidas a la comunidad', 'Community uploads'),                  free: '3 / ' + t('mes', 'mo'), pro: t('Ilimitadas', 'Unlimited') },
        { f: t('Sincronización en la nube', 'Cloud sync'),                      free: false,         pro: true },
        { f: t('Backup automático', 'Automatic backup'),                        free: false,         pro: true },
        { f: t('Múltiples instrumentos (próx.)', 'Multiple instruments (soon)'),free: false,         pro: true },
        { f: t('Badge exclusivo', 'Exclusive badge'),                           free: false,         pro: true },
    ];

    /**
     * Build the LemonSqueezy checkout URL.
     * Appends ?checkout[custom][user_id]=<uuid> so the webhook can identify
     * the buyer and upgrade their Supabase profile automatically.
     */
    function buildCheckoutUrl(base) {
        if (!base) return null;
        try {
            const url = new URL(base);
            if (userId) url.searchParams.set('checkout[custom][user_id]', userId);
            // Pre-fill email if available (optional UX improvement)
            return url.toString();
        } catch {
            return base;
        }
    }

    function handleSubscribe() {
        const base = billing === 'monthly' ? LS_MONTHLY_URL : LS_YEARLY_URL;
        const url  = buildCheckoutUrl(base);

        if (!url) {
            alert(t(
                'El pago aún no está configurado. Vuelve pronto.',
                'Payment not configured yet. Check back soon.'
            ));
            return;
        }

        // LemonSqueezy checkout opens in a new tab.
        // When the user finishes paying, LS redirects them back to
        // VITE_APP_URL/?lemon_success=1 (configure in LS dashboard).
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    return (
        <Modal open onClose={onClose} width={780}>
            <div className={styles.head}>
                <div>
                    <div className={styles.eyebrow}>PianoApp Supporter</div>
                    <h3 className={styles.title}>{t('Apoya el desarrollo, recibe más', 'Support development, get more')}</h3>
                </div>
                <button className={styles.closeBtn} onClick={onClose}><I.Close size={14} /></button>
            </div>

            <div className={styles.body}>
                {/* Billing toggle */}
                <div className={styles.billingToggle}>
                    <div className={styles.pillGroup}>
                        <button
                            className={`${styles.pill} ${billing === 'monthly' ? styles.pillActive : ''}`}
                            onClick={() => setBilling('monthly')}
                        >
                            {t('Mensual', 'Monthly')}
                        </button>
                        <button
                            className={`${styles.pill} ${billing === 'annual' ? styles.pillActive : ''}`}
                            onClick={() => setBilling('annual')}
                        >
                            {t('Anual', 'Annual')} <span className={styles.saveBadge}>{'−25%'}</span>
                        </button>
                    </div>
                </div>

                {/* Tier cards */}
                <div className={styles.tierGrid}>
                    {/* Free */}
                    <div className={styles.tierCard}>
                        <Pill>Free</Pill>
                        <div className={styles.tierPrice}>$0</div>
                        <div className={styles.tierSub}>{t('Para siempre', 'Forever')}</div>
                        <button className={styles.tierBtn} disabled>{t('Plan actual', 'Current plan')}</button>
                        <FeatureList features={features} which="free" />
                    </div>

                    {/* Supporter */}
                    <div className={`${styles.tierCard} ${styles.tierCardPro}`}>
                        <Pill tone="gold"><I.Crown size={10} /> Supporter</Pill>
                        <div className={styles.tierPrice}>
                            ${billing === 'monthly' ? '6' : '54'}
                            <span className={styles.tierPeriod}>
                                {' / '}{billing === 'monthly' ? t('mes', 'mo') : t('año', 'yr')}
                            </span>
                        </div>
                        <div className={styles.tierSubGold}>
                            {billing === 'annual'
                                ? t('Equivale a $4.50/mes', 'Works out to $4.50/mo')
                                : t('Cancela cuando quieras', 'Cancel anytime')}
                        </div>
                        <button className={styles.tierBtnGold} onClick={handleSubscribe}>
                            {t('Suscribirme', 'Subscribe')}
                        </button>
                        <FeatureList features={features} which="pro" />
                    </div>
                </div>

                <div className={styles.footer}>
                    {t('Pago seguro · IVA incluido · Factura por correo', 'Secure payment · Tax included · Invoice via email')}
                </div>
            </div>
        </Modal>
    );
}

/* ── Feature checklist ─────────────────────────── */
function FeatureList({ features, which }) {
    return (
        <div className={styles.featureList}>
            {features.map((f, i) => {
                const v = f[which];
                const has = v === true || (typeof v === 'string');
                return (
                    <div key={i} className={`${styles.featureItem} ${has ? '' : styles.featureDisabled}`}>
                        <span className={styles.featureCheck}>
                            {has ? <I.Check size={12} /> : <I.Close size={10} />}
                        </span>
                        <span className={styles.featureLabel}>{f.f}</span>
                        {typeof v === 'string' && <span className={styles.featureExtra}>{v}</span>}
                    </div>
                );
            })}
        </div>
    );
}
