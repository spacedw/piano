import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

/**
 * Hook for metronome functionality with audio clicks and visual beat tracking.
 */
export function useMetronome(bpm = 120, timeSignature = [4, 4]) {
    const [enabled, setEnabled] = useState(false);
    const [currentBeat, setCurrentBeat] = useState(0);
    const [activeBpm, setActiveBpm] = useState(bpm);
    const [activeTimeSig, setActiveTimeSig] = useState(timeSignature);

    const clickHighRef = useRef(null);  // Accent click (beat 1)
    const clickLowRef = useRef(null);   // Normal click
    const loopRef = useRef(null);
    const beatRef = useRef(0);

    // Create click sounds
    useEffect(() => {
        // High click (accent)
        const synthHigh = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
            volume: -8,
        }).toDestination();

        // Low click
        const synthLow = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
            volume: -12,
        }).toDestination();

        clickHighRef.current = synthHigh;
        clickLowRef.current = synthLow;

        return () => {
            synthHigh.dispose();
            synthLow.dispose();
        };
    }, []);

    // Start/stop metronome loop
    useEffect(() => {
        if (enabled) {
            Tone.getTransport().bpm.value = activeBpm;
            beatRef.current = 0;

            const loop = new Tone.Loop((time) => {
                const beat = beatRef.current % activeTimeSig[0];

                if (beat === 0) {
                    clickHighRef.current?.triggerAttackRelease('C4', '32n', time);
                } else {
                    clickLowRef.current?.triggerAttackRelease('C5', '32n', time);
                }

                // Schedule visual update slightly ahead
                Tone.getDraw().schedule(() => {
                    setCurrentBeat(beat);
                }, time);

                beatRef.current++;
            }, `${activeTimeSig[1]}n`);

            loop.start(0);
            loopRef.current = loop;
            Tone.getTransport().start();
        } else {
            if (loopRef.current) {
                loopRef.current.stop();
                loopRef.current.dispose();
                loopRef.current = null;
            }
            Tone.getTransport().stop();
            setCurrentBeat(0);
            beatRef.current = 0;
        }

        return () => {
            if (loopRef.current) {
                loopRef.current.stop();
                loopRef.current.dispose();
                loopRef.current = null;
            }
        };
    }, [enabled, activeBpm, activeTimeSig]);

    const toggle = useCallback(() => setEnabled(prev => !prev), []);

    const setBpm = useCallback((newBpm) => {
        const clamped = Math.max(20, Math.min(300, newBpm));
        setActiveBpm(clamped);
        Tone.getTransport().bpm.value = clamped;
    }, []);

    const setTimeSig = useCallback((sig) => {
        setActiveTimeSig(sig);
    }, []);

    return {
        enabled,
        currentBeat,
        bpm: activeBpm,
        timeSignature: activeTimeSig,
        beatsPerMeasure: activeTimeSig[0],
        toggle,
        setEnabled,
        setBpm,
        setTimeSig,
    };
}
