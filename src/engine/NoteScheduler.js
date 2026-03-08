/**
 * NoteScheduler handles timing and scheduling of notes for playback.
 * It manages the current playback position, speed, and determines
 * which notes should be active at any given time.
 */
export class NoteScheduler {
    constructor() {
        this.song = null;
        this.currentTime = 0;
        this.speed = 1;
        this.isPlaying = false;
        this.lastTimestamp = null;
        this.activeTracks = new Set();
        this.onNoteOn = null;
        this.onNoteOff = null;
        this._triggeredNoteIds = new Set();
    }

    /**
     * Load a parsed song into the scheduler
     * @param {Object} song - Parsed MIDI song data
     */
    loadSong(song) {
        this.song = song;
        this.currentTime = 0;
        this.isPlaying = false;
        this.lastTimestamp = null;
        this._triggeredNoteIds.clear();

        // Activate all tracks by default
        this.activeTracks = new Set(song.tracks.map((_, i) => i));
    }

    /**
     * Start or resume playback
     */
    play() {
        if (!this.song) return;
        this.isPlaying = true;
        this.lastTimestamp = performance.now();
    }

    /**
     * Pause playback
     */
    pause() {
        this.isPlaying = false;
        this.lastTimestamp = null;
    }

    /**
     * Stop playback and reset to beginning
     */
    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
        this.lastTimestamp = null;
        this._triggeredNoteIds.clear();
    }

    /**
     * Seek to a specific time
     * @param {number} time - Time in seconds
     */
    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.song?.totalDuration || 0));
        this._triggeredNoteIds.clear();
        this.lastTimestamp = this.isPlaying ? performance.now() : null;
    }

    /**
     * Set playback speed
     * @param {number} speed - Multiplier (e.g., 0.5, 1, 1.5)
     */
    setSpeed(speed) {
        this.speed = speed;
    }

    /**
     * Toggle a track on/off
     * @param {number} trackIndex 
     */
    toggleTrack(trackIndex) {
        if (this.activeTracks.has(trackIndex)) {
            this.activeTracks.delete(trackIndex);
        } else {
            this.activeTracks.add(trackIndex);
        }
    }

    /**
     * Update the scheduler - call this every frame.
     * Returns the notes that should be visible in the waterfall.
     * @param {number} timestamp - Current performance.now()
     * @param {number} windowBefore - Seconds of past notes to show
     * @param {number} windowAfter - Seconds of future notes to show
     * @returns {{ currentTime: number, visibleNotes: Array, activeNotes: Array, progress: number }}
     */
    update(timestamp, windowBefore = 2, windowAfter = 5) {
        if (!this.song) {
            return { currentTime: 0, visibleNotes: [], activeNotes: [], progress: 0 };
        }

        // Advance time if playing
        if (this.isPlaying && this.lastTimestamp) {
            const delta = (timestamp - this.lastTimestamp) / 1000;
            this.currentTime += delta * this.speed;

            // Check if song ended
            if (this.currentTime >= this.song.totalDuration) {
                this.currentTime = this.song.totalDuration;
                this.isPlaying = false;
            }
        }
        this.lastTimestamp = timestamp;

        const ct = this.currentTime;
        const viewStart = ct - windowBefore;
        const viewEnd = ct + windowAfter;

        const visibleNotes = [];
        const activeNotes = [];

        for (const track of this.song.tracks) {
            if (!this.activeTracks.has(track.index)) continue;

            for (const note of track.notes) {
                const noteEnd = note.time + note.duration;

                // Is the note visible in the waterfall window?
                if (noteEnd >= viewStart && note.time <= viewEnd) {
                    const noteWithTrack = {
                        ...note,
                        trackIndex: track.index,
                        isRightHand: track.index === 0, // Simple heuristic: first track = right hand
                    };
                    visibleNotes.push(noteWithTrack);

                    // Is the note currently active (being played)?
                    if (note.time <= ct && noteEnd > ct) {
                        activeNotes.push(noteWithTrack);

                        // Trigger note-on callback
                        const noteId = `${track.index}-${note.midi}-${note.time}`;
                        if (!this._triggeredNoteIds.has(noteId)) {
                            this._triggeredNoteIds.add(noteId);
                            this.onNoteOn?.(noteWithTrack);
                        }
                    }
                }
            }
        }

        return {
            currentTime: ct,
            visibleNotes,
            activeNotes,
            progress: this.song.totalDuration > 0 ? ct / this.song.totalDuration : 0,
        };
    }
}
