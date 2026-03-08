/**
 * RecordingEngine captures MIDI events during a performance
 * and can play them back through the audio engine.
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
        this.playbackIndex = 0;
        this.playbackStartTime = null;
        this.duration = 0;
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
     * Start playback of recorded events
     */
    startPlayback() {
        if (this.events.length === 0) return;
        this.isPlaying = true;
        this.playbackIndex = 0;
        this.playbackStartTime = performance.now();
    }

    /**
     * Stop playback
     */
    stopPlayback() {
        this.isPlaying = false;
        this.playbackIndex = 0;
        this.playbackStartTime = null;
    }

    /**
     * Update playback — call every frame.
     * Returns events that should fire this frame.
     */
    updatePlayback() {
        if (!this.isPlaying || this.events.length === 0) return [];

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

        // Check if playback ended
        if (this.playbackIndex >= this.events.length) {
            this.isPlaying = false;
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
}
