/**
 * Lightweight i18n system for PianoApp.
 *
 * Architecture:
 *   - React Context holds current locale + t() function
 *   - t(key, vars?) looks up key in the loaded JSON dictionary
 *   - Falls back to English if key is missing in the selected locale
 *   - Supports {{variable}} interpolation
 *   - Auto-detects system language on first visit
 *   - Persists selection to localStorage
 *
 * To add a new language:
 *   1. Create src/i18n/locales/xx.json (copy en.json and translate)
 *   2. Add 'xx' to AVAILABLE_LOCALES below
 *   3. Done — no component changes needed
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './locales/en.json';
import es from './locales/es.json';

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

export const AVAILABLE_LOCALES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const DICTIONARIES = { en, es };

const STORAGE_KEY = 'pianoapp_locale';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Detect the best locale from the browser's language preference.
 * Returns a supported locale code, defaulting to 'en'.
 */
function detectSystemLocale() {
    const langs = navigator.languages ?? [navigator.language ?? 'en'];
    for (const lang of langs) {
        const code = lang.toLowerCase().split('-')[0];
        if (DICTIONARIES[code]) return code;
    }
    return 'en';
}

/**
 * Resolve the initial locale:
 *   1. localStorage preference (user explicitly chose)
 *   2. System language auto-detection
 */
function resolveInitialLocale() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTIONARIES[saved]) return saved;
    return detectSystemLocale();
}

/**
 * Create a t() translation function bound to the given locale.
 *
 * @param {string} locale - Locale code ('en', 'es', …)
 * @returns {function} t(key: string, vars?: Record<string, string|number>) => string
 */
function createT(locale) {
    const primary = DICTIONARIES[locale] ?? {};
    const fallback = DICTIONARIES['en'] ?? {};

    return function t(key, vars) {
        let str = primary[key] ?? fallback[key] ?? key;

        // {{variable}} interpolation
        if (vars) {
            str = str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
                vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
            );
        }

        return str;
    };
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const I18nContext = createContext(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function I18nProvider({ children }) {
    const [locale, setLocaleState] = useState(resolveInitialLocale);

    const setLocale = useCallback((code) => {
        if (!DICTIONARIES[code]) return;
        localStorage.setItem(STORAGE_KEY, code);
        setLocaleState(code);
    }, []);

    const t = useMemo(() => createT(locale), [locale]);

    const value = useMemo(
        () => ({ locale, setLocale, t, availableLocales: AVAILABLE_LOCALES }),
        [locale, setLocale, t]
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/**
 * Returns the translation function for the current locale.
 * Usage: const t = useT();  →  t('library.title')
 */
export function useT() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
    return ctx.t;
}

/**
 * Returns locale state + setter + available locales.
 * Usage: const { locale, setLocale, availableLocales } = useLocale();
 */
export function useLocale() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useLocale must be used inside <I18nProvider>');
    return { locale: ctx.locale, setLocale: ctx.setLocale, availableLocales: ctx.availableLocales };
}
