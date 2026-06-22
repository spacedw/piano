import { useState, useEffect, useRef, useCallback } from 'react';
import { PIANO_PRESETS, DEFAULT_PRESET, SAMPLE_MAP, SAMPLE_MAP_FLAT } from '@/constants/pianoPresets';

// We load a subset of notes and let Tone.js interpolate the rest

// Lazy-loaded Tone.js module reference
let Tone = null;

async function getTone() {
    if (!Tone) {
        Tone = await import('tone');
    }
    return Tone;
}

/**
 * Hook for managing the audio engine using Tone.js with Salamander Grand Piano samples.
 * Supports sustain, sostenuto, and soft pedals.
 */
export function useAudio(presetId = DEFAULT_PRESET) {
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [volume, setVolumeState] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [currentPresetId, setCurrentPresetId] = useState(presetId);
    const samplerRef = useRef(null);
    const volumeNodeRef = useRef(null);
    const toneRef = useRef(null);

    // Pedal state (refs to avoid stale closures in callbacks)
    const sustainActiveRef = useRef(false);
    const sostenutoActiveRef = useRef(false);
    const softActiveRef = useRef(false);

    // Notes currently held alive by each pedal mechanism
    // sustainHeld: keys released while sustain was on
    const sustainHeldRef = useRef(new Set());
    // sostenutoHeld: keys that were pressed AT THE MOMENT sostenuto was activated
    const sostenutoHeldRef = useRef(new Set());
    // Notes currently physically depressed (key is down)
    const pressedNotesRef = useRef(new Set());

    // Soft pedal velocity multiplier
    const SOFT_VELOCITY_FACTOR = 0.55;

    // Resolve current preset config
    const preset = PIANO_PRESETS[currentPresetId] || PIANO_PRESETS[DEFAULT_PRESET];
    const sampleMap = preset.sampleMapKey === 'flat' ? SAMPLE_MAP_FLAT : SAMPLE_MAP;

    // Initialize the sampler
    const initAudio = useCallback(async () => {
        if (samplerRef.current || loading) return;
        if (!preset.loaded) {
            console.warn(`[useAudio] Preset "${currentPresetId}" not loaded locally. Skipping init.`);
            return;
        }

        setLoading(true);

        try {
            const T = await getTone();
            toneRef.current = T;
            await T.start();

            const vol = new T.Volume(T.gainToDb(volume)).toDestination();
            volumeNodeRef.current = vol;

            const sampler = new T.Sampler({
                urls: sampleMap,
                baseUrl: preset.baseUrl,
                release: 1.5,
                onload: () => { /* samples fully buffered — already marked loaded */ },
                onerror: () => { /* non-fatal: Tone.js interpolates from nearby samples */ },
            }).connect(vol);

            samplerRef.current = sampler;

            // Unlock immediately — Tone.js plays nearest available sample while others load
            setLoaded(true);
            setLoading(false);
        } catch (err) {
            console.error('Audio init error:', err);
            setLoading(false);
        }
    }, [loading, volume, currentPresetId, preset.baseUrl, preset.loaded, sampleMap]);

    // Switch preset at runtime — disposes old sampler and inits new one immediately
    const switchPreset = useCallback(async (newPresetId) => {
        const target = PIANO_PRESETS[newPresetId];
        if (!target) {
            console.warn(`[useAudio] Unknown preset: ${newPresetId}`);
            return;
        }
        if (!target.loaded) {
            console.log(`[useAudio] Preset "${newPresetId}" not available locally.`);
            setCurrentPresetId(newPresetId);
            setLoaded(false);
            return;
        }

        // Dispose old sampler
        if (samplerRef.current) {
            samplerRef.current.dispose();
            samplerRef.current = null;
        }

        setLoaded(false);
        setLoading(true);
        setCurrentPresetId(newPresetId);

        try {
            const T = toneRef.current || await getTone();
            toneRef.current = T;

            const targetMap = target.sampleMapKey === 'flat' ? SAMPLE_MAP_FLAT : SAMPLE_MAP;

            // Ensure volume node exists (may not if audio was never init'd)
            if (!volumeNodeRef.current) {
                const vol = new T.Volume(T.gainToDb(0.8)).toDestination();
                volumeNodeRef.current = vol;
            }

            const newSampler = new T.Sampler({
                urls: targetMap,
                baseUrl: target.baseUrl,
                release: 1.5,
                onload: () => { /* fully buffered */ },
                onerror: () => { /* non-fatal */ },
            }).connect(volumeNodeRef.current);

            samplerRef.current = newSampler;

            // Unlock immediately
            setLoaded(true);
            setLoading(false);
        } catch (err) {
            console.error('[useAudio] Preset switch error:', err);
            setLoading(false);
        }
    }, []);

    // Play a note
    const noteOn = useCallback((midiNote, velocity = 0.8) => {
        const T = toneRef.current;
        if (!samplerRef.current || !loaded || !T) return;
        const noteName = T.Frequency(midiNote, 'midi').toNote();

        // Track as physically pressed
        pressedNotesRef.current.add(midiNote);

        // If sustain was holding this note from a prior release, remove from held set
        // (re-attack takes over)
        sustainHeldRef.current.delete(midiNote);

        // Apply soft pedal velocity reduction
        const effectiveVelocity = softActiveRef.current
            ? velocity * SOFT_VELOCITY_FACTOR
            : velocity;

        try {
            samplerRef.current.triggerAttack(noteName, T.now(), Math.max(0.01, effectiveVelocity));
        } catch (e) {
            // Ignore individual note errors
        }
    }, [loaded]);

    // Release a note
    const noteOff = useCallback((midiNote) => {
        const T = toneRef.current;
        if (!samplerRef.current || !loaded || !T) return;
        const noteName = T.Frequency(midiNote, 'midi').toNote();

        // Remove from physically pressed set
        pressedNotesRef.current.delete(midiNote);

        // Check if any pedal is holding this note
        const heldBySustain = sustainActiveRef.current;
        const heldBySostenuto = sostenutoHeldRef.current.has(midiNote);

        if (heldBySustain) {
            // Sustain pedal is active — defer release, remember it
            sustainHeldRef.current.add(midiNote);
            return;
        }

        if (heldBySostenuto) {
            // Sostenuto is holding this note — don't release yet
            return;
        }

        // No pedal holding — release immediately
        try {
            samplerRef.current.triggerRelease(noteName, T.now());
        } catch (e) {
            // Ignore
        }
    }, [loaded]);

    // Release all notes
    const allNotesOff = useCallback(() => {
        if (!samplerRef.current) return;
        samplerRef.current.releaseAll();
        sustainHeldRef.current.clear();
        sostenutoHeldRef.current.clear();
        pressedNotesRef.current.clear();
    }, []);

    // --- Pedal handlers ---

    /**
     * Sustain pedal (CC#64).
     * When released: trigger release on all notes that were deferred.
     */
    const setSustain = useCallback((isOn) => {
        const T = toneRef.current;
        sustainActiveRef.current = isOn;

        if (!isOn && samplerRef.current && T) {
            // Release all notes that were being held by sustain,
            // except those still physically pressed or held by sostenuto
            const toRelease = [...sustainHeldRef.current].filter(
                note => !pressedNotesRef.current.has(note) && !sostenutoHeldRef.current.has(note)
            );
            toRelease.forEach(midiNote => {
                const noteName = T.Frequency(midiNote, 'midi').toNote();
                try {
                    samplerRef.current.triggerRelease(noteName, T.now());
                } catch (e) { /* ignore */ }
            });
            sustainHeldRef.current.clear();
        }
    }, []);

    /**
     * Sostenuto pedal (CC#66).
     * When pressed: capture the notes that are currently physically held down.
     * When released: release only the captured notes (if sustain is also not active).
     */
    const setSostenuto = useCallback((isOn) => {
        const T = toneRef.current;
        sostenutoActiveRef.current = isOn;

        if (isOn) {
            // Capture currently pressed notes
            sostenutoHeldRef.current = new Set(pressedNotesRef.current);
        } else if (samplerRef.current && T) {
            // Release all sostenuto-held notes that are not also physically pressed
            // or held by sustain
            const toRelease = [...sostenutoHeldRef.current].filter(
                note => !pressedNotesRef.current.has(note) && !sustainHeldRef.current.has(note) && !sustainActiveRef.current
            );
            toRelease.forEach(midiNote => {
                const noteName = T.Frequency(midiNote, 'midi').toNote();
                try {
                    samplerRef.current.triggerRelease(noteName, T.now());
                } catch (e) { /* ignore */ }
            });
            sostenutoHeldRef.current.clear();
        }
    }, []);

    /**
     * Soft / una corda pedal (CC#67).
     * Only affects future noteOn calls via velocity reduction.
     */
    const setSoft = useCallback((isOn) => {
        softActiveRef.current = isOn;
    }, []);

    // Volume control
    const setVolume = useCallback((v) => {
        const T = toneRef.current;
        const clamped = Math.max(0, Math.min(1, v));
        setVolumeState(clamped);
        if (volumeNodeRef.current && T) {
            volumeNodeRef.current.volume.value = clamped === 0 ? -Infinity : T.gainToDb(clamped);
        }
    }, []);

    // Mute toggle
    const toggleMute = useCallback(() => {
        setMuted(prev => {
            const T = toneRef.current;
            const next = !prev;
            if (volumeNodeRef.current && T) {
                volumeNodeRef.current.volume.value = next ? -Infinity : T.gainToDb(volume);
            }
            return next;
        });
    }, [volume]);

    // Mute setter (direct boolean, for settings panel)
    const setMute = useCallback((value) => {
        const T = toneRef.current;
        setMuted(value);
        if (volumeNodeRef.current && T) {
            volumeNodeRef.current.volume.value = value ? -Infinity : T.gainToDb(volume);
        }
    }, [volume]);

    // Cleanup
    useEffect(() => {
        return () => {
            samplerRef.current?.dispose();
            volumeNodeRef.current?.dispose();
        };
    }, []);

    return {
        loaded,
        loading,
        volume,
        muted,
        currentPresetId,
        initAudio,
        noteOn,
        noteOff,
        allNotesOff,
        setVolume,
        toggleMute,
        setMute,
        setSustain,
        setSostenuto,
        setSoft,
        switchPreset,
    };
}
