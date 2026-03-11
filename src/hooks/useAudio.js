import { useState, useEffect, useRef, useCallback } from 'react';

// Salamander Grand Piano samples via unpkg CDN (free, high quality)
const SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

// We load a subset of notes and let Tone.js interpolate the rest
const SAMPLE_MAP = {
    A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
    A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
    A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
    A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
    A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
    A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
    A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
    A7: 'A7.mp3', C8: 'C8.mp3',
};

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
 */
export function useAudio() {
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [volume, setVolumeState] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const samplerRef = useRef(null);
    const volumeNodeRef = useRef(null);
    const toneRef = useRef(null);

    // Initialize the sampler
    const initAudio = useCallback(async () => {
        if (samplerRef.current || loading) return;

        setLoading(true);

        try {
            const T = await getTone();
            toneRef.current = T;
            await T.start();

            const vol = new T.Volume(T.gainToDb(volume)).toDestination();
            volumeNodeRef.current = vol;

            const sampler = new T.Sampler({
                urls: SAMPLE_MAP,
                baseUrl: SAMPLE_BASE_URL,
                release: 1.5,
                onload: () => {
                    setLoaded(true);
                    setLoading(false);
                },
                onerror: (err) => {
                    console.error('Sampler load error:', err);
                    setLoading(false);
                },
            }).connect(vol);

            samplerRef.current = sampler;
        } catch (err) {
            console.error('Audio init error:', err);
            setLoading(false);
        }
    }, [loading, volume]);

    // Play a note
    const noteOn = useCallback((midiNote, velocity = 0.8) => {
        const T = toneRef.current;
        if (!samplerRef.current || !loaded || !T) return;
        const noteName = T.Frequency(midiNote, 'midi').toNote();
        try {
            samplerRef.current.triggerAttack(noteName, T.now(), velocity);
        } catch (e) {
            // Ignore individual note errors
        }
    }, [loaded]);

    // Release a note
    const noteOff = useCallback((midiNote) => {
        const T = toneRef.current;
        if (!samplerRef.current || !loaded || !T) return;
        const noteName = T.Frequency(midiNote, 'midi').toNote();
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
        initAudio,
        noteOn,
        noteOff,
        allNotesOff,
        setVolume,
        toggleMute,
    };
}
