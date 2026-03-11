import React from 'react';
import styles from './index.module.css';

export default function UpgradeModal({ onClose }) {
    return (
        <div className={styles.upgradeOverlay} onClick={onClose}>
            <div className={styles.upgradePanel} onClick={e => e.stopPropagation()}>
                <button className={styles.upgradeClose} onClick={onClose}>✕</button>
                <h2>Become a Supporter ♥</h2>
                <p className={styles.upgradeDesc}>Support the development of PianoApp and unlock exclusive community features.</p>

                <div className={styles.pricingCards}>
                    <div className={styles.pricingCard}>
                        <h3>Monthly</h3>
                        <div className={styles.price}>$2<span>/mo</span></div>
                        <ul className={styles.pricingFeatures}>
                            <li><span>✓</span> Unlimited Community Uploads</li>
                            <li><span>✓</span> 500 MB Cloud Backup</li>
                            <li><span>✓</span> Cross-device Progress Sync</li>
                            <li><span>✓</span> Supporter Profile Badge</li>
                        </ul>
                        <button className={styles.pricingAction} onClick={() => window.open('https://your-lemonsqueezy-store.com/buy/monthly-plan', '_blank')}>
                            Subscribe Monthly
                        </button>
                    </div>
                    <div className={`${styles.pricingCard} ${styles.featured}`}>
                        <div className={styles.featuredBadge}>Save 25%</div>
                        <h3>Yearly</h3>
                        <div className={styles.price}>$18<span>/yr</span></div>
                        <ul className={styles.pricingFeatures}>
                            <li><span>✓</span> Unlimited Community Uploads</li>
                            <li><span>✓</span> 500 MB Cloud Backup</li>
                            <li><span>✓</span> Cross-device Progress Sync</li>
                            <li><span>✓</span> Supporter Profile Badge</li>
                        </ul>
                        <button className={`${styles.pricingAction} ${styles.featured}`} onClick={() => window.open('https://your-lemonsqueezy-store.com/buy/yearly-plan', '_blank')}>
                            Subscribe Yearly
                        </button>
                    </div>
                </div>
                <div className={styles.upgradeFooter}>
                    🔒 Payments securely processed by LemonSqueezy
                </div>
            </div>
        </div>
    );
}
