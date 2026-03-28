import React from 'react';
import { useT } from '@/i18n';
import styles from './index.module.css';

export default function UpgradeModal({ onClose }) {
    const t = useT();
    return (
        <div className={styles.upgradeOverlay} onClick={onClose}>
            <div className={styles.upgradePanel} onClick={e => e.stopPropagation()}>
                <button className={styles.upgradeClose} onClick={onClose}>✕</button>
                <h2>{t('upgrade.title')}</h2>
                <p className={styles.upgradeDesc}>{t('upgrade.desc')}</p>

                <div className={styles.pricingCards}>
                    <div className={styles.pricingCard}>
                        <h3>{t('upgrade.monthly')}</h3>
                        <div className={styles.price}>$2<span>{t('upgrade.perMonth')}</span></div>
                        <ul className={styles.pricingFeatures}>
                            <li><span>✓</span> {t('upgrade.featUnlimitedUploads')}</li>
                            <li><span>✓</span> {t('upgrade.featCloudBackup')}</li>
                            <li><span>✓</span> {t('upgrade.featProgressSync')}</li>
                            <li><span>✓</span> {t('upgrade.featBadge')}</li>
                        </ul>
                        <button className={styles.pricingAction} onClick={() => window.open('https://your-lemonsqueezy-store.com/buy/monthly-plan', '_blank')}>
                            {t('upgrade.subscribeMonthly')}
                        </button>
                    </div>
                    <div className={`${styles.pricingCard} ${styles.featured}`}>
                        <div className={styles.featuredBadge}>{t('upgrade.save25')}</div>
                        <h3>{t('upgrade.yearly')}</h3>
                        <div className={styles.price}>$18<span>{t('upgrade.perYear')}</span></div>
                        <ul className={styles.pricingFeatures}>
                            <li><span>✓</span> {t('upgrade.featUnlimitedUploads')}</li>
                            <li><span>✓</span> {t('upgrade.featCloudBackup')}</li>
                            <li><span>✓</span> {t('upgrade.featProgressSync')}</li>
                            <li><span>✓</span> {t('upgrade.featBadge')}</li>
                        </ul>
                        <button className={`${styles.pricingAction} ${styles.featured}`} onClick={() => window.open('https://your-lemonsqueezy-store.com/buy/yearly-plan', '_blank')}>
                            {t('upgrade.subscribeYearly')}
                        </button>
                    </div>
                </div>
                <div className={styles.upgradeFooter}>
                    {t('upgrade.footer')}
                </div>
            </div>
        </div>
    );
}
