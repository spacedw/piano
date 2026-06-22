import React, { useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured, signIn, signUp, signInWithGoogle, signOut, getUser, updateProfile } from '@/engine/SupabaseClient';
import { getSetting, saveSetting, getAllSongs, getAllSessions, getAllRecordings, getAllSettings, saveSong } from '@/engine/Storage';
import { useUserTier } from '@/hooks/useUserTier';
import { useMidi } from '@/hooks/useMidi';
import UpgradeModal from '@/components/UpgradeModal';
import PianoSelector from '@/components/PianoSelector';
import * as I from '@/components/Icons';
import { Toggle, Avatar, Slider, SectionTitle, Pill } from '@/components/ui';
import { useT, useLocale, AVAILABLE_LOCALES } from '@/i18n';
import styles from './index.module.css';

/**
 * Settings panel with 6-section navigation, account, audio, MIDI, display, language, data.
 */
export default function SettingsPanel({ isOpen, onClose, user: userProp, onUserChange, audioPresetId, onAudioPresetChange }) {
    const [user, setUser] = useState(null);
    const updateUser = (u) => { setUser(u); onUserChange?.(u); };
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [message, setMessage] = useState('');
    const [section, setSection] = useState('account');
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [eraseConfirm, setEraseConfirm] = useState(0);

    const [settings, setSettings] = useState({
        waterfallSpeed: 150,
        showBeatLines: true,
        autoPlayAudio: true,
        timingTolerance: 200,
        volume: 80,
        mute: false,
        showLabels: true,
        fingerGuides: false,
        density: 100,
        notation: 'solfege',
    });

    const supabaseReady = isSupabaseConfigured();
    const { tier, isSupporter, uploadsThisMonth, cloudUsedBytes, cloudMaxBytes, refreshProfile } = useUserTier();
    const t = useT();
    const { locale, setLocale } = useLocale();
    const tl = (es, en) => locale === 'es' ? es : en;

    /* Real MIDI state */
    const midi = useMidi();
    const midiConnected = midi.enabled && midi.inputs.length > 0;
    const midiNote = midi.activeNotes.length > 0
        ? { note: midi.activeNotes[0].name || 'C4', midi: midi.activeNotes[0].number || 60, vel: midi.activeNotes[0].velocity || 0 }
        : { note: '--', midi: '--', vel: '--' };
    const importFileRef = useRef(null);

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
        try {
            const u = await getUser();
            updateUser(u);
        } catch { /* ignore */ }
    };

    const loadSettings = async () => {
        try {
            const speed = await getSetting('waterfallSpeed', 150);
            const beat = await getSetting('showBeatLines', true);
            const autoPlay = await getSetting('autoPlayAudio', true);
            const tolerance = await getSetting('timingTolerance', 200);
            const volume = await getSetting('volume', 80);
            const mute = await getSetting('mute', false);
            const showLabels = await getSetting('showLabels', true);
            const fingerGuides = await getSetting('fingerGuides', false);
            const density = await getSetting('density', 100);
            const notation = await getSetting('notation', 'solfege');
            setSettings({ waterfallSpeed: speed, showBeatLines: beat, autoPlayAudio: autoPlay, timingTolerance: tolerance, volume, mute, showLabels, fingerGuides, density, notation });
        } catch { /* use defaults */ }
    };

    const handleSaveSetting = async (key, value) => {
        try { await saveSetting(key, value); } catch { /* ignore */ }
        setSettings(prev => ({ ...prev, [key]: value }));
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key, value } }));
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
        try { await signInWithGoogle(); } catch (err) { setAuthError(err.message || t('settings.googleFailed')); }
    };

    const handleSignOut = async () => {
        await signOut();
        updateUser(null);
        setMessage(t('settings.signedOut'));
    };

    const handleEraseAll = async () => {
        if (eraseConfirm < 1) { setEraseConfirm(1); return; }
        // Double confirmation passed — delete all IndexedDB data
        try {
            const database = await new Promise((resolve, reject) => {
                const req = indexedDB.open('pianoapp', 1);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            const storeNames = ['songs', 'progress', 'recordings', 'settings'];
            const tx = database.transaction(storeNames, 'readwrite');
            storeNames.forEach(name => tx.objectStore(name).clear());
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            setMessage(tl('Todos los datos han sido borrados.', 'All data has been erased.'));
        } catch (err) {
            setAuthError(tl('Error al borrar datos.', 'Failed to erase data.'));
        }
        setEraseConfirm(0);
    };

    const handleChangePassword = async () => {
        if (!supabaseReady) return;
        try {
            const { supabase } = await import('@/engine/SupabaseClient');
            await supabase.auth.resetPasswordForEmail(user?.email, {
                redirectTo: window.location.origin,
            });
            setMessage(tl('Enlace de cambio de contraseña enviado a tu email.', 'Password reset link sent to your email.'));
        } catch (err) {
            setAuthError(err.message || tl('Error al enviar enlace.', 'Failed to send link.'));
        }
    };

    const handleUpdateName = async (newName) => {
        if (!user || !supabaseReady) return;
        try {
            await updateProfile({ display_name: newName });
            const u = await getUser();
            updateUser(u);
        } catch { /* ignore */ }
    };

    const handleUpdateEmail = async (newEmail) => {
        if (!user || !supabaseReady) return;
        try {
            const { supabase } = await import('@/engine/SupabaseClient');
            await supabase.auth.updateUser({ email: newEmail });
            setMessage(tl('Revisa tu correo para confirmar el cambio.', 'Check your email to confirm the change.'));
        } catch (err) {
            setAuthError(err.message || tl('Error al actualizar email.', 'Failed to update email.'));
        }
    };

    const handleExportData = async () => {
        try {
            const [songs, sessions, recordings, settings] = await Promise.all([
                getAllSongs(), getAllSessions(), getAllRecordings(), getAllSettings(),
            ]);
            // Convert ArrayBuffers in songs to base64 for JSON serialization
            const songsExport = songs.map(s => ({
                ...s,
                midiData: s.midiData ? btoa(String.fromCharCode(...new Uint8Array(s.midiData))) : null,
            }));
            const data = { version: 1, exportedAt: new Date().toISOString(), songs: songsExport, sessions, recordings, settings };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pianoapp-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setMessage(tl('Datos exportados correctamente.', 'Data exported successfully.'));
        } catch (err) {
            setAuthError(tl('Error al exportar datos.', 'Failed to export data.'));
        }
    };

    const handleImportData = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.version || !data.songs) throw new Error('Invalid backup file');
            const database = await new Promise((resolve, reject) => {
                const req = indexedDB.open('pianoapp', 1);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            const tx = database.transaction(['songs', 'progress', 'recordings', 'settings'], 'readwrite');
            // Import songs (convert base64 back to ArrayBuffer)
            for (const s of data.songs || []) {
                if (s.midiData && typeof s.midiData === 'string') {
                    const binary = atob(s.midiData);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    s.midiData = bytes.buffer;
                }
                tx.objectStore('songs').put(s);
            }
            for (const s of data.sessions || []) tx.objectStore('progress').put(s);
            for (const r of data.recordings || []) tx.objectStore('recordings').put(r);
            for (const s of data.settings || []) tx.objectStore('settings').put(s);
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            setMessage(tl('Datos importados correctamente.', 'Data imported successfully.'));
            loadSettings();
        } catch (err) {
            setAuthError(tl('Error al importar: archivo inválido.', 'Import error: invalid file.'));
        }
        e.target.value = '';
    };

    const handleMidiReconnect = async () => {
        try {
            if (navigator.requestMIDIAccess) {
                await navigator.requestMIDIAccess();
                setMessage(tl('MIDI reconectado.', 'MIDI reconnected.'));
            }
        } catch {
            setAuthError(tl('No se pudo reconectar MIDI.', 'Failed to reconnect MIDI.'));
        }
    };

    const sections = [
        { id: 'account', label: tl('Cuenta', 'Account'), icon: <I.Users size={14} /> },
        { id: 'audio', label: 'Audio', icon: <I.Volume size={14} /> },
        { id: 'midi', label: 'MIDI', icon: <I.Midi size={14} /> },
        { id: 'display', label: tl('Pantalla', 'Display'), icon: <I.Eye size={14} /> },
        { id: 'language', label: tl('Idioma', 'Language'), icon: <I.Globe size={14} /> },
        { id: 'data', label: tl('Datos', 'Data'), icon: <I.Folder size={14} /> },
    ];

    if (!isOpen) return null;

    return (
        <div className={styles.settingsOverlay} onClick={onClose}>
            <div className={styles.settingsPanel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.settingsHeader}>
                    <SectionTitle eyebrow={tl('Personaliza tu app', 'Personalize your app')} title={tl('Configuraci\u00f3n', 'Settings')} />
                    <button className={styles.closeBtn} onClick={onClose}><I.Close size={14} /></button>
                </div>

                <div className={styles.settingsGrid}>
                    {/* Navigation */}
                    <nav className={styles.settingsNav}>
                        {sections.map(s => (
                            <button
                                key={s.id}
                                className={`${styles.navItem} ${section === s.id ? styles.navItemActive : ''}`}
                                onClick={() => setSection(s.id)}
                            >
                                {s.icon}<span>{s.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Content */}
                    <div className={styles.settingsContent}>
                        {section === 'account' && (
                            <div>
                                {/* ── Usuario logueado ── */}
                                {user ? (
                                    <>
                                        <div className={styles.userCard}>
                                            <Avatar initial={user.email?.[0]?.toUpperCase() || '?'} size={56} gold={isSupporter} />
                                            <div className={styles.userCardInfo}>
                                                <div className={styles.userCardNameRow}>
                                                    <span className={styles.userCardName}>{user.user_metadata?.display_name || user.email?.split('@')[0]}</span>
                                                    {isSupporter
                                                        ? <Pill tone="gold"><I.Crown size={10} /> Supporter</Pill>
                                                        : <Pill>Free</Pill>
                                                    }
                                                </div>
                                                <div className={styles.userCardEmail}>{user.email}</div>
                                            </div>
                                            {!isSupporter && (
                                                <button className={styles.btnGold} onClick={() => setShowUpgrade(true)}>
                                                    <I.Crown size={14} /> Upgrade
                                                </button>
                                            )}
                                        </div>

                                        <SettingRow name={tl('Nombre', 'Name')} desc={tl('Visible en la comunidad', 'Visible in community')}>
                                            <input
                                                className={styles.input}
                                                defaultValue={user.user_metadata?.display_name || ''}
                                                placeholder={tl('Tu nombre', 'Your name')}
                                                style={{ width: 220 }}
                                                onBlur={(e) => handleUpdateName(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                            />
                                        </SettingRow>
                                        <SettingRow name="Email" desc={tl('Tu correo de cuenta', 'Your account email')}>
                                            <input
                                                className={styles.input}
                                                defaultValue={user.email || ''}
                                                placeholder={tl('tu@email.com', 'you@email.com')}
                                                style={{ width: 220 }}
                                                onBlur={(e) => handleUpdateEmail(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                            />
                                        </SettingRow>
                                        <SettingRow name={tl('Cambiar contraseña', 'Change password')}>
                                            <button className={styles.btn} onClick={handleChangePassword}>{tl('Enviar enlace', 'Send link')}</button>
                                        </SettingRow>
                                        <SettingRow name={tl('Cerrar sesión', 'Sign out')}>
                                            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleSignOut}>{tl('Cerrar sesión', 'Sign out')}</button>
                                        </SettingRow>
                                    </>
                                ) : (
                                    /* ── Sin sesión: solo el form de login ── */
                                    <>
                                        <div className={styles.userCard} style={{ marginBottom: 20 }}>
                                            <Avatar initial="?" size={56} />
                                            <div className={styles.userCardInfo}>
                                                <div className={styles.userCardName} style={{ fontSize: 15, color: 'var(--ink-3)' }}>
                                                    {tl('Inicia sesión para guardar tu progreso', 'Sign in to save your progress')}
                                                </div>
                                            </div>
                                        </div>

                                        {supabaseReady && (
                                            <form className={styles.authForm} onSubmit={handleAuth}>
                                                <div className={styles.authTabs}>
                                                    <button type="button" className={authMode === 'login' ? styles.active : ''} onClick={() => setAuthMode('login')}>{t('settings.login')}</button>
                                                    <button type="button" className={authMode === 'signup' ? styles.active : ''} onClick={() => setAuthMode('signup')}>{t('settings.signUp')}</button>
                                                </div>
                                                <input type="email" placeholder={t('settings.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={styles.input} />
                                                <input type="password" placeholder={t('settings.passwordPlaceholder')} minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={styles.input} />
                                                <button type="submit" className={styles.btnGold} disabled={authLoading}>
                                                    {authLoading ? t('settings.loading') : authMode === 'login' ? t('settings.signIn') : t('settings.createAccount')}
                                                </button>
                                                <button type="button" className={styles.btnGhost} onClick={handleGoogleAuth}>{t('settings.continueWithGoogle')}</button>
                                                {authError && <div className={styles.authError}>{authError}</div>}
                                                {message && <div className={styles.authMessage}>{message}</div>}
                                            </form>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {section === 'audio' && (
                            <div>
                                <SettingRow name={tl('Volumen master', 'Master volume')} desc={tl('Volumen del piano virtual', 'Virtual piano volume')}>
                                    <div style={{ width: 220 }}>
                                        <Slider value={settings.volume} min={0} max={100} suffix="%" onChange={v => handleSaveSetting('volume', v)} />
                                    </div>
                                </SettingRow>
                                <SettingRow name={tl('Silenciar', 'Mute')}>
                                    <Toggle checked={settings.mute} onChange={v => handleSaveSetting('mute', v)} />
                                </SettingRow>
                                <SettingRow name={tl('Sonido / Instrumento', 'Sound / Instrument')} desc={tl('Selecciona el piano virtual', 'Select the virtual piano')}>
                                    <PianoSelector
                                        currentPresetId={audioPresetId || 'salamander'}
                                        onSelect={onAudioPresetChange}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {section === 'midi' && (
                            <div>
                                {/* MIDI status */}
                                <div className={`${styles.midiStatus} ${midiConnected ? styles.midiOk : styles.midiOff}`}>
                                    <span className={`${styles.led} ${midiConnected ? styles.ledOk : styles.ledOff}`} />
                                    <div className={styles.midiStatusInfo}>
                                        <div className={styles.midiDevice}>
                                            {midiConnected
                                                ? `${midi.selectedInput?.name || 'MIDI Device'} — Connected`
                                                : tl('No conectado', 'Not connected')}
                                        </div>
                                        {midiConnected && <div className={styles.midiDetail}>{midi.selectedInput?.manufacturer || 'USB'} · {midi.selectedInput?.type || 'input'}</div>}
                                    </div>
                                    <button className={styles.btn} onClick={handleMidiReconnect}>{tl('Reconectar', 'Reconnect')}</button>
                                </div>

                                <SettingRow name={tl('Dispositivo', 'Device')} desc={tl('Selecciona tu teclado MIDI', 'Pick your MIDI keyboard')}>
                                    <select
                                        className={styles.input}
                                        style={{ width: 220 }}
                                        value={midi.selectedInput?.id || ''}
                                        onChange={(e) => midi.selectInput(e.target.value)}
                                    >
                                        {midi.inputs.length === 0 && (
                                            <option value="">{tl('Sin dispositivos', 'No devices')}</option>
                                        )}
                                        {midi.inputs.map(input => (
                                            <option key={input.id} value={input.id}>
                                                {input.name} ({input.manufacturer || 'USB'})
                                            </option>
                                        ))}
                                    </select>
                                </SettingRow>
                                <SettingRow name={tl('Test de teclas', 'Key test')} desc={tl('Toca una tecla en tu MIDI para ver la nota detectada', 'Press a key on your MIDI to see the detected note')}>
                                    <div className={styles.keyTest}>
                                        <span className={`${styles.led} ${styles.ledOk}`} />
                                        <span className={styles.keyTestNote}>{midiNote.note} \u00b7 {midiNote.midi}</span>
                                        <span className={styles.keyTestVel}>vel: {midiNote.vel}</span>
                                    </div>
                                </SettingRow>
                            </div>
                        )}

                        {section === 'display' && (
                            <div>
                                <SettingRow name={tl('Tema', 'Theme')} desc={tl('Modo claro pr\u00f3ximamente', 'Light mode coming soon')}>
                                    <div className={styles.pillGroup}>
                                        <button className={`${styles.pillBtn} ${styles.pillBtnActive}`}><I.Moon size={12} /> {tl('Oscuro', 'Dark')}</button>
                                        <button className={styles.pillBtn} disabled style={{ opacity: 0.4 }}><I.Sun size={12} /> {tl('Claro', 'Light')}</button>
                                    </div>
                                </SettingRow>
                                <SettingRow name={tl('Nombres de notas', 'Show note names')} desc={tl('Muestra C, D, E... en cada tecla', 'Show C, D, E... on each key')}>
                                    <Toggle checked={settings.showLabels} onChange={v => handleSaveSetting('showLabels', v)} />
                                </SettingRow>
                                <SettingRow name={tl('Gu\u00edas de dedos', 'Finger guides')} desc={tl('N\u00fameros de dedos sobre las teclas', 'Finger numbers on keys')}>
                                    <Toggle checked={settings.fingerGuides} onChange={v => handleSaveSetting('fingerGuides', v)} />
                                </SettingRow>
                                <SettingRow name={tl('Densidad del waterfall', 'Waterfall density')} desc={tl('Velocidad de ca\u00edda de las notas', 'Speed of falling notes')}>
                                    <div style={{ width: 220 }}>
                                        <Slider value={settings.density} min={50} max={200} step={10} suffix="%" onChange={v => handleSaveSetting('density', v)} />
                                    </div>
                                </SettingRow>
                            </div>
                        )}

                        {section === 'language' && (
                            <div>
                                <SettingRow name={tl('Idioma de la interfaz', 'Interface language')}>
                                    <div className={styles.pillGroup}>
                                        <button className={`${styles.pillBtn} ${locale === 'es' ? styles.pillBtnActive : ''}`} onClick={() => setLocale('es')}>
                                            <span role="img" aria-label="ES">&#127466;&#127480;</span> Español
                                        </button>
                                        <button className={`${styles.pillBtn} ${locale === 'en' ? styles.pillBtnActive : ''}`} onClick={() => setLocale('en')}>
                                            <span role="img" aria-label="EN">&#127468;&#127463;</span> English
                                        </button>
                                    </div>
                                </SettingRow>
                                <SettingRow name={tl('Notaci\u00f3n de notas', 'Note naming')} desc={tl('Do Re Mi vs C D E', 'Do Re Mi vs C D E')}>
                                    <div className={styles.pillGroup}>
                                        <button className={`${styles.pillBtn} ${settings.notation === 'solfege' ? styles.pillBtnActive : ''}`} onClick={() => handleSaveSetting('notation', 'solfege')}>Do Re Mi</button>
                                        <button className={`${styles.pillBtn} ${settings.notation === 'letters' ? styles.pillBtnActive : ''}`} onClick={() => handleSaveSetting('notation', 'letters')}>C D E</button>
                                    </div>
                                </SettingRow>
                            </div>
                        )}

                        {section === 'data' && (
                            <div>
                                <SettingRow name={tl('Exportar datos', 'Export data')} desc={tl('Backup local de tu librer\u00eda y progreso', 'Local backup of library and progress')}>
                                    <button className={styles.btn} onClick={handleExportData}><I.Download size={14} /> {tl('Descargar', 'Download')}</button>
                                </SettingRow>
                                <SettingRow name={tl('Importar datos', 'Import data')}>
                                    <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportData} />
                                    <button className={styles.btn} onClick={() => importFileRef.current?.click()}><I.Upload size={14} /> {tl('Seleccionar archivo', 'Select file')}</button>
                                </SettingRow>
                                {/* Danger zone */}
                                <div className={styles.dangerZone}>
                                    <Pill tone="rose">{tl('Zona peligrosa', 'Danger zone')}</Pill>
                                    <div className={styles.dangerContent}>
                                        <div>
                                            <div className={styles.dangerTitle}>{tl('Borrar todos los datos', 'Erase all data')}</div>
                                            <div className={styles.dangerDesc}>{tl('Esta acci\u00f3n es irreversible. Necesita confirmaci\u00f3n doble.', 'This is irreversible. Requires double confirmation.')}</div>
                                        </div>
                                        <button
                                            className={`${styles.btn} ${styles.btnDanger}`}
                                            onClick={handleEraseAll}
                                        >
                                            <I.Trash size={14} /> {eraseConfirm > 0 ? tl('\u00bfEst\u00e1s seguro?', 'Are you sure?') : tl('Borrar todo', 'Erase all')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} userId={user?.id} />}
        </div>
    );
}

/* ── SettingRow helper ──────────────────────────── */
function SettingRow({ name, desc, children }) {
    return (
        <div className={styles.settingRow}>
            <div className={styles.settingRowInfo}>
                <div className={styles.settingRowName}>{name}</div>
                {desc && <div className={styles.settingRowDesc}>{desc}</div>}
            </div>
            <div>{children}</div>
        </div>
    );
}
