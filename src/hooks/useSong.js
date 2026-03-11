import { useState, useRef, useCallback } from 'react';
import { NoteScheduler } from '../engine/NoteScheduler';
import { loadMidiFromFile } from '../engine/MidiParser';

/**
 * Hook for managing song loading, playback state, and the NoteScheduler.
 */
export function useSong() {
    const [song, setSong] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeedState] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const schedulerRef = useRef(new NoteScheduler());

    /**
     * Load a MIDI file from a File object
     */
    const loadFile = useCallback(async (file) => {
        setLoading(true);
        setError(null);
        try {
            const parsed = await loadMidiFromFile(file);
            const scheduler = schedulerRef.current;
            scheduler.loadSong(parsed);
            setSong(parsed);
            setIsPlaying(false);
            setCurrentTime(0);
            setProgress(0);
        } catch (err) {
            setError(err.message || 'Failed to load MIDI file');
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Play or resume the song
     */
    const play = useCallback(() => {
        const scheduler = schedulerRef.current;
        if (!scheduler.song) return;
        scheduler.play();
        setIsPlaying(true);
    }, []);

    /**
     * Pause the song
     */
    const pause = useCallback(() => {
        schedulerRef.current.pause();
        setIsPlaying(false);
    }, []);

    /**
     * Stop and reset to beginning
     */
    const stop = useCallback(() => {
        schedulerRef.current.stop();
        setIsPlaying(false);
        setCurrentTime(0);
        setProgress(0);
    }, []);

    /**
     * Toggle play/pause
     */
    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    /**
     * Seek to a position (0-1 normalized)
     */
    const seek = useCallback((normalizedPosition) => {
        if (!song) return;
        const time = normalizedPosition * song.totalDuration;
        schedulerRef.current.seek(time);
        setCurrentTime(time);
        setProgress(normalizedPosition);
    }, [song]);

    /**
     * Set playback speed
     */
    const setSpeed = useCallback((newSpeed) => {
        schedulerRef.current.setSpeed(newSpeed);
        setSpeedState(newSpeed);
    }, []);

    /**
     * Update the scheduler (call every frame) and return visible/active notes
     */
    const update = useCallback((timestamp) => {
        const result = schedulerRef.current.update(timestamp);
        setCurrentTime(result.currentTime);
        setProgress(result.progress);

        // Check if playback finished
        if (schedulerRef.current.song &&
            result.currentTime >= schedulerRef.current.song.totalDuration &&
            !schedulerRef.current.isPlaying) {
            setIsPlaying(false);
        }

        return result;
    }, []);

    /**
     * Set note event callbacks on the scheduler
     */
    const setNoteCallbacks = useCallback(({ onNoteOn, onNoteOff, onPedalEvent }) => {
        schedulerRef.current.onNoteOn = onNoteOn;
        schedulerRef.current.onNoteOff = onNoteOff;
        schedulerRef.current.onPedalEvent = onPedalEvent || null;
    }, []);

    return {
        song,
        isPlaying,
        currentTime,
        progress,
        speed,
        loading,
        error,
        loadFile,
        play,
        pause,
        stop,
        togglePlay,
        seek,
        setSpeed,
        update,
        setNoteCallbacks,
        scheduler: schedulerRef.current,
    };
}
