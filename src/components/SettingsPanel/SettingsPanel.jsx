import React, { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured, signIn, signUp, signInWithGoogle, signOut, getUser } from '../../engine/SupabaseClient';
import { getSetting, saveSetting } from '../../engine/Storage';
import './SettingsPanel.css';

/**
 * Settings panel with Supabase auth, cloud sync, and app preferences.
 */
export default function SettingsPanel({ isOpen, onClose }) {
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [message, setMessage] = useState('');
    const [settings, setSettings] = useState({
        waterfallSpeed: 150,
        showBeatLines: true,
        autoPlayAudio: true,
        timingTolerance: 200,
    });

    const supabaseReady = isSupabaseConfigured();

    useEffect(() => {
        if (isOpen) {
            loadUser();
            loadSettings();
        }
    }, [isOpen]);

    const loadUser = async () => {
        const u = await getUser();
        setUser(u);
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
                setMessage('Check your email to verify your account');
            } else {
                await signIn(email, password);
                await loadUser();
                setMessage('Signed in successfully!');
            }
        } catch (err) {
            setAuthError(err.message || 'Authentication failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        try {
            await signInWithGoogle();
        } catch (err) {
            setAuthError(err.message || 'Google auth failed');
        }
    };

    const handleSignOut = async () => {
        await signOut();
        setUser(null);
        setMessage('Signed out');
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="settings-content">
                    {/* Account */}
                    <div className="settings-section">
                        <h3>Account</h3>
                        {supabaseReady ? (
                            user ? (
                                <div className="account-info">
                                    <div className="user-badge">
                                        <div className="user-avatar">{user.email?.[0]?.toUpperCase() || '?'}</div>
                                        <div>
                                            <span className="user-email">{user.email}</span>
                                            <span className="user-status">Cloud sync enabled</span>
                                        </div>
                                    </div>
                                    <button className="settings-btn" onClick={handleSignOut}>Sign Out</button>
                                </div>
                            ) : (
                                <form className="auth-form" onSubmit={handleAuth}>
                                    <div className="auth-tabs">
                                        <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
                                        <button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Sign Up</button>
                                    </div>
                                    <input
                                        type="email" placeholder="Email"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                    <input
                                        type="password" placeholder="Password" minLength="6"
                                        value={password} onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button type="submit" className="settings-btn primary" disabled={authLoading}>
                                        {authLoading ? 'Loading...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                                    </button>
                                    <button type="button" className="settings-btn google-btn" onClick={handleGoogleAuth}>
                                        Continue with Google
                                    </button>
                                    {authError && <div className="auth-error">{authError}</div>}
                                    {message && <div className="auth-message">{message}</div>}
                                </form>
                            )
                        ) : (
                            <div className="setup-hint">
                                <p>To enable cloud sync, add your Supabase credentials:</p>
                                <code>
                                    VITE_SUPABASE_URL=...<br />
                                    VITE_SUPABASE_ANON_KEY=...
                                </code>
                                <p className="hint-sub">Add these to a <code>.env</code> file in the project root</p>
                            </div>
                        )}
                    </div>

                    {/* Practice preferences */}
                    <div className="settings-section">
                        <h3>Practice</h3>
                        <div className="setting-row">
                            <span>Timing Tolerance</span>
                            <select
                                value={settings.timingTolerance}
                                onChange={(e) => handleSaveSetting('timingTolerance', Number(e.target.value))}
                            >
                                <option value={100}>Strict (±100ms)</option>
                                <option value={200}>Normal (±200ms)</option>
                                <option value={400}>Relaxed (±400ms)</option>
                            </select>
                        </div>
                        <div className="setting-row">
                            <span>Auto-play Song Audio</span>
                            <label className="toggle-switch small">
                                <input
                                    type="checkbox"
                                    checked={settings.autoPlayAudio}
                                    onChange={(e) => handleSaveSetting('autoPlayAudio', e.target.checked)}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>
                    </div>

                    {/* Display */}
                    <div className="settings-section">
                        <h3>Display</h3>
                        <div className="setting-row">
                            <span>Waterfall Speed</span>
                            <div className="speed-input">
                                <input
                                    type="range"
                                    min="80"
                                    max="300"
                                    value={settings.waterfallSpeed}
                                    onChange={(e) => handleSaveSetting('waterfallSpeed', Number(e.target.value))}
                                />
                                <span>{settings.waterfallSpeed} px/s</span>
                            </div>
                        </div>
                        <div className="setting-row">
                            <span>Show Beat Lines</span>
                            <label className="toggle-switch small">
                                <input
                                    type="checkbox"
                                    checked={settings.showBeatLines}
                                    onChange={(e) => handleSaveSetting('showBeatLines', e.target.checked)}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>
                    </div>

                    {/* About */}
                    <div className="settings-section about">
                        <h3>About</h3>
                        <div className="about-info">
                            <span className="about-name">PianoApp</span>
                            <span className="about-version">v1.0.0</span>
                            <span className="about-desc">Learn piano your way. Made with ❤️</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
