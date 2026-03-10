import React from 'react';
import './UpgradeModal.css';

export default function UpgradeModal({ onClose }) {
    return (
        <div className="upgrade-overlay" onClick={onClose}>
            <div className="upgrade-panel" onClick={e => e.stopPropagation()}>
                <button className="upgrade-close" onClick={onClose}>✕</button>
                <h2>Become a Supporter ♥</h2>
                <p className="upgrade-desc">Support the development of PianoApp and unlock exclusive community features.</p>
                
                <div className="pricing-cards">
                    <div className="pricing-card">
                        <h3>Monthly</h3>
                        <div className="price">$2<span>/mo</span></div>
                        <ul className="pricing-features">
                            <li><span>✓</span> Unlimited Community Uploads</li>
                            <li><span>✓</span> 500 MB Cloud Backup</li>
                            <li><span>✓</span> Cross-device Progress Sync</li>
                            <li><span>✓</span> Supporter Profile Badge</li>
                        </ul>
                        <button className="pricing-action" onClick={() => window.open('https://your-lemonsqueezy-store.com/buy/monthly-plan', '_blank')}>
                            Subscribe Monthly
                        </button>
                    </div>
                    <div className="pricing-card featured">
                        <div className="featured-badge">Save 25%</div>
                        <h3>Yearly</h3>
                        <div className="price">$18<span>/yr</span></div>
                        <ul className="pricing-features">
                            <li><span>✓</span> Unlimited Community Uploads</li>
                            <li><span>✓</span> 500 MB Cloud Backup</li>
                            <li><span>✓</span> Cross-device Progress Sync</li>
                            <li><span>✓</span> Supporter Profile Badge</li>
                        </ul>
                        <button className="pricing-action featured" onClick={() => window.open('https://your-lemonsqueezy-store.com/buy/yearly-plan', '_blank')}>
                            Subscribe Yearly
                        </button>
                    </div>
                </div>
                <div className="upgrade-footer">
                    🔒 Payments securely processed by LemonSqueezy
                </div>
            </div>
        </div>
    );
}
