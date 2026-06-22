import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;      // 2 minutes
const PLAYBACK_KEEPALIVE_MS = 30 * 1000;     // ping every 30s during playback
const RESET_THROTTLE_MS = 5 * 1000;          // ignore activity events within 5s of last reset

/**
 * Prevents the screen from sleeping while the app is active.
 *
 * @param {boolean} active  - true once the user has initialized the app
 * @param {boolean} isPlaying - true while a song is playing back
 *
 * Releases the lock when:
 *  - `active` is false
 *  - The user (and song) is idle for IDLE_TIMEOUT_MS
 *  - The page becomes hidden (browser auto-release)
 *
 * Re-acquires when the page becomes visible again (if still active).
 * During playback, the idle timer is reset every 30s automatically.
 */
export function useWakeLock(active, isPlaying = false) {
    const wakeLockRef = useRef(null);
    const idleTimerRef = useRef(null);
    const keepAliveIntervalRef = useRef(null);
    const lastResetRef = useRef(0); // timestamp of last idle-timer reset

    const acquire = useCallback(async () => {
        if (!('wakeLock' in navigator)) return;
        if (wakeLockRef.current) return;
        try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
                wakeLockRef.current = null;
            });
        } catch {
            // Silently ignore — permission denied or unsupported
        }
    }, []);

    const release = useCallback(async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
        }
    }, []);

    const resetIdleTimer = useCallback((force = false) => {
        const now = Date.now();
        // Throttle: skip if called too recently (e.g. mousemove at 60fps)
        if (!force && now - lastResetRef.current < RESET_THROTTLE_MS) return;
        lastResetRef.current = now;
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            release();
        }, IDLE_TIMEOUT_MS);
    }, [release]);

    // Acquire / release based on `active`
    useEffect(() => {
        if (active) {
            acquire();
            resetIdleTimer(true); // force: initial activation always resets
        } else {
            release();
            clearTimeout(idleTimerRef.current);
        }
        return () => clearTimeout(idleTimerRef.current);
    }, [active, acquire, release, resetIdleTimer]);

    // While song is playing → reset idle timer every 30s automatically
    // (user may be watching waterfall or playing MIDI keyboard without touching mouse)
    useEffect(() => {
        if (active && isPlaying) {
            resetIdleTimer(true); // force: start of playback always resets
            keepAliveIntervalRef.current = setInterval(() => {
                if (!wakeLockRef.current) acquire();
                resetIdleTimer(true); // force: scheduled keepalive always resets
            }, PLAYBACK_KEEPALIVE_MS);
        } else {
            clearInterval(keepAliveIntervalRef.current);
        }
        return () => clearInterval(keepAliveIntervalRef.current);
    }, [active, isPlaying, acquire, resetIdleTimer]);

    // Re-acquire when tab becomes visible again
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && active) {
                acquire();
                resetIdleTimer(true); // force: returning to tab always resets
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [active, acquire, resetIdleTimer]);

    // Reset idle timer on any user interaction (mouse, keyboard, touch)
    useEffect(() => {
        if (!active) return;
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
        const onActivity = () => {
            if (!wakeLockRef.current) acquire();
            resetIdleTimer();
        };
        events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
        return () => events.forEach(e => window.removeEventListener(e, onActivity));
    }, [active, acquire, resetIdleTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            release();
            clearTimeout(idleTimerRef.current);
            clearInterval(keepAliveIntervalRef.current);
        };
    }, [release]);
}

