import { useState, useEffect, useRef, useCallback } from 'react';
import { PitchDetector } from 'pitchy';

const MIN_MIDI = 21;  // A0
const MAX_MIDI = 108; // C8
const CLARITY_THRESHOLD = 0.85;
const SILENCE_CLARITY = 0.5;
const SILENCE_TIMEOUT_MS = 300;
const CALIBRATION_MS = 1500;

function hzToMidi(hz) {
    return Math.round(12 * Math.log2(hz / 440) + 69);
}

/**
 * Hook for detecting musical pitch from microphone input.
 * Uses native Web Audio API (not Tone.js) to avoid AudioContext conflicts.
 */
export function useMicrophone() {
    const [isActive, setIsActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [currentNote, setCurrentNote] = useState(null);
    const [currentHz, setCurrentHz] = useState(null);
    const [clarity, setClarity] = useState(0);
    const [error, setError] = useState(null);
    const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'

    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const analyserRef = useRef(null);
    const processorRef = useRef(null);
    const detectorRef = useRef(null);
    const bufferRef = useRef(null);
    const rafIdRef = useRef(null);

    const prevNoteRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const calibrationStartRef = useRef(null);
    const noiseFloorRef = useRef(0);
    const isCalibratingRef = useRef(false);

    const noteCallbacksRef = useRef({
        onNoteOn: null,
        onNoteOff: null,
    });

    const setNoteCallbacks = useCallback(({ onNoteOn, onNoteOff }) => {
        noteCallbacksRef.current = { onNoteOn, onNoteOff };
    }, []);

    const cleanup = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (processorRef.current) {
            try {
                processorRef.current.disconnect();
            } catch (e) { /* ignore */ }
            processorRef.current = null;
        }
        if (analyserRef.current) {
            try {
                analyserRef.current.disconnect();
            } catch (e) { /* ignore */ }
            analyserRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try {
                audioContextRef.current.close();
            } catch (e) { /* ignore */ }
            audioContextRef.current = null;
        }
        detectorRef.current = null;
        bufferRef.current = null;
        prevNoteRef.current = null;
        noiseFloorRef.current = 0;
        isCalibratingRef.current = false;
        calibrationStartRef.current = null;
    }, []);

    const handleSilence = useCallback(() => {
        if (prevNoteRef.current !== null) {
            noteCallbacksRef.current.onNoteOff?.(prevNoteRef.current);
            prevNoteRef.current = null;
            setCurrentNote(null);
            setCurrentHz(null);
        }
        silenceTimerRef.current = null;
    }, []);

    const processFrame = useCallback(() => {
        const analyser = analyserRef.current;
        const detector = detectorRef.current;
        const buffer = bufferRef.current;
        if (!analyser || !detector || !buffer) return;

        analyser.getFloatTimeDomainData(buffer);

        // Compute RMS to check noise floor
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        // During calibration, just measure noise floor
        if (isCalibratingRef.current) {
            if (rms > noiseFloorRef.current) {
                noiseFloorRef.current = rms;
            }
            if (Date.now() - calibrationStartRef.current >= CALIBRATION_MS) {
                isCalibratingRef.current = false;
                // Add small headroom to noise floor
                noiseFloorRef.current = Math.max(noiseFloorRef.current * 1.5, 0.001);
            }
            rafIdRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // Ignore if below noise floor
        if (rms < noiseFloorRef.current) {
            if (!silenceTimerRef.current && prevNoteRef.current !== null) {
                silenceTimerRef.current = setTimeout(handleSilence, SILENCE_TIMEOUT_MS);
            }
            rafIdRef.current = requestAnimationFrame(processFrame);
            return;
        }

        const [pitch, clarityValue] = detector.findPitch(buffer, audioContextRef.current.sampleRate);

        setClarity(clarityValue);

        if (clarityValue < CLARITY_THRESHOLD) {
            if (!silenceTimerRef.current && prevNoteRef.current !== null) {
                silenceTimerRef.current = setTimeout(handleSilence, SILENCE_TIMEOUT_MS);
            }
            rafIdRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // Valid pitch detected
        const midi = hzToMidi(pitch);

        if (midi < MIN_MIDI || midi > MAX_MIDI) {
            rafIdRef.current = requestAnimationFrame(processFrame);
            return;
        }

        setCurrentHz(pitch);
        setCurrentNote(midi);

        // Cancel silence timer since we have a valid note
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        if (midi !== prevNoteRef.current) {
            // Note changed: off previous, on new
            if (prevNoteRef.current !== null) {
                noteCallbacksRef.current.onNoteOff?.(prevNoteRef.current);
            }
            prevNoteRef.current = midi;
            noteCallbacksRef.current.onNoteOn?.(midi, 0.7);
        }

        rafIdRef.current = requestAnimationFrame(processFrame);
    }, [handleSilence]);

    const start = useCallback(async () => {
        if (isActive) return;
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                },
            });
            streamRef.current = stream;
            setPermissionState('granted');

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyserRef.current = analyser;

            source.connect(analyser);

            const detector = PitchDetector.forFloat32Array(analyser.fftSize);
            detectorRef.current = detector;
            bufferRef.current = new Float32Array(analyser.fftSize);

            // Start calibration
            isCalibratingRef.current = true;
            calibrationStartRef.current = Date.now();
            noiseFloorRef.current = 0;

            setIsActive(true);
            setIsListening(true);

            rafIdRef.current = requestAnimationFrame(processFrame);
        } catch (err) {
            console.error('Microphone error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('mic.permissionDenied');
                setPermissionState('denied');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('mic.notFound');
            } else {
                setError(err.message || 'Microphone error');
            }
            cleanup();
        }
    }, [isActive, cleanup, processFrame]);

    const stop = useCallback(() => {
        cleanup();
        setIsActive(false);
        setIsListening(false);
        setCurrentNote(null);
        setCurrentHz(null);
        setClarity(0);
    }, [cleanup]);

    const toggle = useCallback(() => {
        if (isActive) {
            stop();
        } else {
            start();
        }
    }, [isActive, start, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        isActive,
        isListening,
        currentNote,
        currentHz,
        clarity,
        error,
        permissionState,
        toggle,
        start,
        stop,
        setNoteCallbacks,
    };
}
