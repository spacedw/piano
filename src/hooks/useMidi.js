import { useState, useEffect, useCallback, useRef } from 'react';
import { WebMidi } from 'webmidi';

/**
 * Hook for managing Web MIDI API connection and input/output handling.
 * Uses WebMIDI.js v3 for simplified device management.
 */
export function useMidi() {
    const [enabled, setEnabled] = useState(false);
    const [inputs, setInputs] = useState([]);
    const [selectedInput, setSelectedInput] = useState(null);
    const [activeNotes, setActiveNotes] = useState(new Map()); // midi -> velocity
    const [sustainPedal, setSustainPedal] = useState(false);
    const [error, setError] = useState(null);

    const listenersRef = useRef([]);
    const noteCallbacksRef = useRef({ onNoteOn: null, onNoteOff: null, onSustain: null });

    // Enable WebMIDI
    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                await WebMidi.enable({ sysex: false });
                if (cancelled) return;
                setEnabled(true);
                setInputs([...WebMidi.inputs]);
                setError(null);

                // Auto-select first input if available
                if (WebMidi.inputs.length > 0) {
                    setSelectedInput(WebMidi.inputs[0]);
                }

                // Listen for device changes
                WebMidi.addListener('connected', () => {
                    setInputs([...WebMidi.inputs]);
                    if (!WebMidi.inputs.length) setSelectedInput(null);
                });
                WebMidi.addListener('disconnected', () => {
                    setInputs([...WebMidi.inputs]);
                });
            } catch (err) {
                if (cancelled) return;
                setError(err.message || 'Failed to enable MIDI');
                console.error('MIDI Error:', err);
            }
        }

        init();

        return () => {
            cancelled = true;
            try {
                WebMidi.disable();
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, []);

    // Attach listeners to selected input
    useEffect(() => {
        if (!selectedInput) return;

        const input = selectedInput;

        const handleNoteOn = (e) => {
            const midi = e.note.number;
            const velocity = e.note.rawAttack / 127; // normalize to 0-1
            setActiveNotes(prev => {
                const next = new Map(prev);
                next.set(midi, velocity);
                return next;
            });
            noteCallbacksRef.current.onNoteOn?.(midi, velocity);
        };

        const handleNoteOff = (e) => {
            const midi = e.note.number;
            setActiveNotes(prev => {
                const next = new Map(prev);
                next.delete(midi);
                return next;
            });
            noteCallbacksRef.current.onNoteOff?.(midi);
        };

        const handleCC = (e) => {
            if (e.controller.number === 64) {
                const isOn = e.rawValue >= 64;
                setSustainPedal(isOn);
                noteCallbacksRef.current.onSustain?.(isOn);
            }
        };

        input.addListener('noteon', handleNoteOn);
        input.addListener('noteoff', handleNoteOff);
        input.addListener('controlchange', handleCC);

        return () => {
            try {
                input.removeListener('noteon', handleNoteOn);
                input.removeListener('noteoff', handleNoteOff);
                input.removeListener('controlchange', handleCC);
            } catch (e) {
                // Ignore if already removed
            }
        };
    }, [selectedInput]);

    // Select a specific input by id
    const selectInput = useCallback((inputId) => {
        const input = WebMidi.inputs.find(i => i.id === inputId);
        setSelectedInput(input || null);
    }, []);

    // Register callbacks for note events
    const setNoteCallbacks = useCallback(({ onNoteOn, onNoteOff, onSustain }) => {
        noteCallbacksRef.current = { onNoteOn, onNoteOff, onSustain };
    }, []);

    return {
        enabled,
        error,
        inputs,
        selectedInput,
        activeNotes,
        sustainPedal,
        selectInput,
        setNoteCallbacks,
    };
}
