import React, { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured, signIn, signUp, signInWithGoogle, signOut, getUser } from '@/engine/SupabaseClient';
import { getSetting, saveSetting } from '@/engine/Storage';
import { useUserTier } from '@/hooks/useUserTier';
import UpgradeModal from '@/components/UpgradeModal';
import { useT, useLocale, AVAILABLE_LOCALES } from '@/i18n';
import styles from './index.module.css';

/**
 * Settings panel with Supabase auth, cloud sync, and app preferences.
 */
export default function SettingsPanel({ isOpen, onClose, user: userProp, onUserChange }) {
    const [user, setUser] = useState(null);
    const updateUser = (u) => { setUser(u); onUserChange?.(u); };
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [message, setMessage] = useState('');
    const [settings, setSettings] = useState({
        waterfallSpeed: 150,
        showBeatLines: true,
        autoPlayAudio: true,
        timingTolerance: 200,
    });
    const [showUpgrade, setShowUpgrade] = useState(false);

    const supabaseReady = isSupabaseConfigured();
    const { tier, isSupporter, uploadsThisMonth, cloudUsedBytes, cloudMaxBytes, refreshProfile } = useUserTier();
    const t = useT();
    const { locale, setLocale } = useLocale();

    useEffect(() => {
        if (userProp !== undefined) setUser(userProp);
    }, [userProp]);

    useEffect(() => {
        if (isOpen) {
            if (userProp === undefined) loadUser();
            loadSettings();
            refreshProfile();
        }
    }, [isOpen]);

    const loadUser = async () => {
        const u = await getUser();
        updateUser(u);
    };

    const loadSettings = async () => {
        const speed = await getSetting('waterfallSpeed', 150);
        const beat = await getSetting('showBeatLines', true);
        const autoPlay = await getSetting('autoPlayAudio', true);
        const tolerance = await getSetting('timingTolerance', 200);
        setSettings({ waterfallSpeed: speed, showBeatLines: beat, autoPlayAudio: autoPlay, timingTolerance: tolerance });
    };

    const handleSaveSetting = async (key, value) => {
        await saveSetting(key, value);
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');
        setMessage('');
        try {
            if (authMode === 'signup') {
                await signUp(email, password);
                setMessage(t('settings.verifyEmail'));
            } else {
                await signIn(email, password);
                const u = await getUser();
                updateUser(u);
                setMessage(t('settings.signedIn'));
            }
        } catch (err) {
            setAuthError(err.message || t('settings.authFailed'));
        } finally {
            setAuthLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        try {
            await signInWithGoogle();
        } catch (err) {
            setAuthError(err.message || t('settings.googleFailed'));
        }
    };

    const handleSignOut = async () => {
        await signOut();
        updateUser(null);
        setMessage(t('settings.signedOut'));
    };

    if (!isOpen) return null;

    return (
        <div className={styles.settingsOverlay} onClick={onClose}>
            <div className={styles.settingsPanel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.settingsHeader}>
                    <h2>{t('settings.title')}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.settingsContent}>
                    {/* Account */}
                    <div className={styles.settingsSection}>
                        <h3>{t('settings.account')}</h3>
                        {supabaseReady ? (
                            user ? (
                                <div className={styles.accountInfoContainer}>
                                    <div className={styles.accountInfo}>
                                        <div className={styles.userBadge}>
                                            <div className={styles.userAvatar}>{user.email?.[0]?.toUpperCase() || '?'}</div>
                                            <div>
                                                <span className={styles.userEmail}>{user.email}</span>
                                                <span className={`${styles.userTier} ${isSupporter ? styles.supporter : styles.free}`}>
                                                    {isSupporter ? t('settings.supporterBadge') : t('settings.freeTier')}
                                                </span>
                                            </div>
                                        </div>
                                        <button className={styles.settingsBtn} onClick={handleSignOut}>{t('settings.signOut')}</button>
                                    </div>

                                    <div className={styles.tierStats}>
                                        {isSupporter ? (
                                            <>
                                                <div className={styles.usageText}>
                                                    <span>{t('settings.cloudStorage')}</span>
                                                    <span>{(cloudUsedBytes / 1024 / 1024).toFixed(1)} MB / {(cloudMaxBytes / 1024 / 1024).toFixed(0)} MB</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div className={styles.progressFill} style={{ width: `${Math.min(100, (cloudUsedBytes / Math.max(1, cloudMaxBytes)) * 100)}%` }} />
                                                </div>
                                                <button className={styles.settingsBtn} style={{ marginTop: '10px' }} onClick={() => window.open('https://lemonsqueezy.com/customer-portal', '_blank')}>
                                                    {t('settings.manageSubscription')}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className={styles.usageText}>
                                                    <span>{t('settings.communityUploads')}</span>
                                                    <span>{t('settings.uploadsThisMonth', { count: uploadsThisMonth })}</span>
                                                </div>
                                                <div className={styles.upgradeBtn}>
                                                    <button className={`${styles.settingsBtn} ${styles.primary}`} onClick={() => setShowUpgrade(true)}>
                                                        {t('settings.becomeSupporter')}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <form className={styles.authForm} onSubmit={handleAuth}>
                                    <div className={styles.authTabs}>
                                        <button type="button" className={authMode === 'login' ? styles.active : ''} onClick={() => setAuthMode('login')}>{t('settings.login')}</button>
                                        <button type="button" className={authMode === 'signup' ? styles.active : ''} onClick={() => setAuthMode('signup')}>{t('settings.signUp')}</button>
                                    </div>
                                    <input
                                        type="email" placeholder={t('settings.emailPlaceholder')}
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email" required
                                    />
                                    <input
                                        type="password" placeholder={t('settings.passwordPlaceholder')} minLength="6"
                                        value={password} onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password" required
                                    />
                                    <button type="submit" className={`${styles.settingsBtn} ${styles.primary}`} disabled={authLoading}>
                                        {authLoading ? t('settings.loading') : authMode === 'login' ? t('settings.signIn') : t('settings.createAccount')}
                                    </button>
                                    <button type="button" className={`${styles.settingsBtn} ${styles.googleBtn}`} onClick={handleGoogleAuth}>
                                        {t('settings.continueWithGoogle')}
                                    </button>
                                    {authError && <div className={styles.authError}>{authError}</div>}
                                    {message && <div className={styles.authMessage}>{message}</div>}
                                </form>
                            )
                        ) : (
                            <div className={styles.setupHint}>
                                <p>{t('settings.supabaseHint')}</p>
                                <code>
                                    VITE_SUPABASE_URL=...<br />
                                    VITE_SUPABASE_ANON_KEY=...
                                </code>
                                <p className={styles.hintSub}>{t('settings.supabaseHintSub')}</p>
                            </div>
                        )}
                    </div>

                    {/* Language */}
                    <div className={styles.settingsSection}>
                        <h3>{t('settings.language')}</h3>
                        <div className={styles.settingRow}>
                            <div className={styles.langToggle}>
                                {AVAILABLE_LOCALES.map(loc => (
                                    <button
                                        key={loc.code}
                                        className={`${styles.langBtn} ${locale === loc.code ? styles.active : ''}`}
                                        onClick={() => setLocale(loc.code)}
                                    >
                                        <span>{loc.flag}</span>
                                        <span>{loc.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Practice preferences */}
                    <div className={styles.settingsSection}>
                        <h3>{t('settings.practice')}</h3>
                        <div className={styles.settingRow}>
                            <span>{t('settings.timingTolerance')}</span>
                            <select
                                value={settings.timingTolerance}
                                onChange={(e) => handleSaveSetting('timingTolerance', Number(e.target.value))}
                            >
                                <option value={100}>{t('settings.timingStrict')}</option>
                                <option value={200}>{t('settings.timingNormal')}</option>
                                <option value={400}>{t('settings.timingRelaxed')}</option>
                            </select>
                        </div>
                        <div className={styles.settingRow}>
                            <span>{t('settings.autoPlayAudio')}</span>
                            <label className={`${styles.toggleSwitch} ${styles.small}`}>
                                <input
                                    type="checkbox"
                                    checked={settings.autoPlayAudio}
                                    onChange={(e) => handleSaveSetting('autoPlayAudio', e.target.checked)}
                                />
                                <span className={styles.toggleSlider} />
                            </label>
                        </div>
                    </div>

                    {/* Display */}
                    <div className={styles.settingsSection}>
                        <h3>{t('settings.display')}</h3>
                        <div className={styles.settingRow}>
                            <span>{t('settings.waterfallSpeed')}</span>
                            <div className={styles.speedInput}>
                                <input
                                    type="range" min="80" max="300"
                                    value={settings.waterfallSpeed}
                                    onChange={(e) => handleSaveSetting('waterfallSpeed', Number(e.target.value))}
                                />
                                <span>{t('settings.waterfallSpeedUnit', { speed: settings.waterfallSpeed })}</span>
                            </div>
                        </div>
                        <div className={styles.settingRow}>
                            <span>{t('settings.showBeatLines')}</span>
                            <label className={`${styles.toggleSwitch} ${styles.small}`}>
                                <input
                                    type="checkbox"
                                    checked={settings.showBeatLines}
                                    onChange={(e) => handleSaveSetting('showBeatLines', e.target.checked)}
                                />
                                <span className={styles.toggleSlider} />
                            </label>
                        </div>
                    </div>

                    {/* About */}
                    <div className={styles.settingsSection}>
                        <h3>{t('settings.about')}</h3>
                        <div className={styles.aboutInfo}>
                            <span className={styles.aboutName}>PianoApp</span>
                            <span className={styles.aboutVersion}>v{__APP_VERSION__}</span>
                            <span className={styles.aboutDesc}>{t('settings.aboutDesc')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {showUpgrade && (
                <UpgradeModal onClose={() => setShowUpgrade(false)} />
            )}
        </div>
    );
}
