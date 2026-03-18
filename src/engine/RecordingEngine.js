/**
 * RecordingEngine captures MIDI events (notes + pedals) during a performance
 * and can play them back through the audio engine.
 * Also supports exporting recordings as standard MIDI files.
 */
export class RecordingEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.events = [];
        this.startTime = null;
        this.isRecording = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.playbackIndex = 0;
        this.playbackStartTime = null;
        this.playbackPausedElapsed = 0;
        this.duration = 0;
        this.recordingName = '';
    }

    /**
     * Start recording MIDI events
     */
    startRecording() {
        this.events = [];
        this.startTime = performance.now();
        this.isRecording = true;
        this.duration = 0;
    }

    /**
     * Stop recording
     */
    stopRecording() {
        if (!this.isRecording) return;
        this.duration = (performance.now() - this.startTime) / 1000;
        this.isRecording = false;
    }

    /**
     * Record a note-on event
     */
    recordNoteOn(midiNote, velocity) {
        if (!this.isRecording) return;
        this.events.push({
            time: (performance.now() - this.startTime) / 1000,
            type: 'noteOn',
            midi: midiNote,
            velocity,
        });
    }

    /**
     * Record a note-off event
     */
    recordNoteOff(midiNote) {
        if (!this.isRecording) return;
        this.events.push({
            time: (performance.now() - this.startTime) / 1000,
            type: 'noteOff',
            midi: midiNote,
        });
    }

    /**
     * Record a pedal CC event (sustain=64, sostenuto=66, soft=67)
     */
    recordPedalEvent(cc, isOn) {
        if (!this.isRecording) return;
        this.events.push({
            time: (performance.now() - this.startTime) / 1000,
            type: 'pedal',
            cc,
            isOn,
        });
    }

    /**
     * Start playback of recorded events
     */
    startPlayback() {
        if (this.events.length === 0) return;
        this.isPlaying = true;
        this.isPaused = false;
        this.playbackIndex = 0;
        this.playbackStartTime = performance.now();
        this.playbackPausedElapsed = 0;
    }

    /**
     * Pause playback — saves current elapsed time so it can be resumed
     */
    pausePlayback() {
        if (!this.isPlaying || this.isPaused) return;
        this.isPaused = true;
        this.playbackPausedElapsed = (performance.now() - this.playbackStartTime) / 1000;
    }

    /**
     * Resume playback from where it was paused
     */
    resumePlayback() {
        if (!this.isPlaying || !this.isPaused) return;
        this.isPaused = false;
        // Recalculate start time so elapsed stays consistent
        this.playbackStartTime = performance.now() - this.playbackPausedElapsed * 1000;
    }

    /**
     * Stop playback
     */
    stopPlayback() {
        this.isPlaying = false;
        this.isPaused = false;
        this.playbackIndex = 0;
        this.playbackStartTime = null;
        this.playbackPausedElapsed = 0;
    }

    /**
     * Get current playback time in seconds
     */
    get currentTime() {
        if (!this.isPlaying) return 0;
        if (this.isPaused) return this.playbackPausedElapsed;
        return (performance.now() - this.playbackStartTime) / 1000;
    }

    /**
     * Get playback progress as 0–1 ratio
     */
    get progress() {
        if (!this.isPlaying || this.duration <= 0) return 0;
        return Math.min(1, this.currentTime / this.duration);
    }

    /**
     * Update playback — call every frame.
     * Returns events that should fire this frame (noteOn, noteOff, pedal).
     */
    updatePlayback() {
        if (!this.isPlaying || this.isPaused || this.events.length === 0) return [];

        const elapsed = (performance.now() - this.playbackStartTime) / 1000;
        const eventsToFire = [];

        while (this.playbackIndex < this.events.length) {
            const event = this.events[this.playbackIndex];
            if (event.time <= elapsed) {
                eventsToFire.push(event);
                this.playbackIndex++;
            } else {
                break;
            }
        }

        // Check if playback ended — wait for duration to elapse, not just events
        const finished = this.playbackIndex >= this.events.length &&
            (this.duration <= 0 || elapsed >= this.duration);
        if (finished) {
            this.isPlaying = false;
            this.isPaused = false;
        }

        return eventsToFire;
    }

    /**
     * Get recording data for storage
     */
    getData() {
        return {
            events: [...this.events],
            duration: this.duration,
        };
    }

    /**
     * Load recording data for playback
     */
    loadData(data) {
        this.events = data.events || [];
        this.duration = data.duration || 0;
        this.isRecording = false;
        this.isPlaying = false;
    }

    /**
     * Convert a recording's events into a standard MIDI file ArrayBuffer.
     * Uses @tonejs/midi to encode notes and CC events.
     * @param {Object} recordingData - { events, duration, songName }
     * @returns {Promise<ArrayBuffer>} MIDI file data
     */
    static async toMidiArrayBuffer(recordingData) {
        const { Midi } = await import('@tonejs/midi');
        const midi = new Midi();

        // Set header
        midi.header.setTempo(120);
        midi.name = recordingData.songName || 'Recording';

        const track = midi.addTrack();
        track.name = 'Piano';
        track.channel = 0;

        const events = recordingData.events || [];

        // Build note pairs: match noteOn → noteOff to get duration
        const pendingNotes = new Map(); // midi → { time, velocity }

        for (const evt of events) {
            if (evt.type === 'noteOn') {
                pendingNotes.set(evt.midi, { time: evt.time, velocity: evt.velocity });
            } else if (evt.type === 'noteOff') {
                const start = pendingNotes.get(evt.midi);
                if (start) {
                    const duration = Math.max(0.01, evt.time - start.time);
                    track.addNote({
                        midi: evt.midi,
                        time: start.time,
                        duration,
                        velocity: start.velocity || 0.8,
                    });
                    pendingNotes.delete(evt.midi);
                }
            } else if (evt.type === 'pedal') {
                track.addCC({
                    number: evt.cc,
                    value: evt.isOn ? 1 : 0,
                    time: evt.time,
                });
            }
        }

        // Close any remaining open notes (user didn't release)
        const totalDuration = recordingData.duration || 0;
        for (const [midiNote, start] of pendingNotes) {
            track.addNote({
                midi: midiNote,
                time: start.time,
                duration: Math.max(0.01, totalDuration - start.time),
                velocity: start.velocity || 0.8,
            });
        }

        return midi.toArray().buffer;
    }
}
