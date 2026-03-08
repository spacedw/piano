/**
 * NoteScheduler handles timing and scheduling of notes for playback.
 * Supports: normal playback, wait mode, section looping, hand filtering.
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

        // Phase 2: Practice features
        this.waitMode = false;           // Pause until user plays correct note
        this.isWaiting = false;          // Currently waiting for user input
        this.waitingForNotes = new Set(); // MIDI notes we're waiting for
        this.handMode = 'both';          // 'both', 'right', 'left'
        this.splitPoint = 60;            // MIDI note for hand split (C4)

        // Section loop
        this.loopEnabled = false;
        this.loopStart = 0;              // seconds
        this.loopEnd = 0;                // seconds

        // Metronome
        this.metronomeEnabled = false;
        this.countIn = false;            // count-in before play
        this.countInBeats = 4;
        this.countInRemaining = 0;
    }

    loadSong(song) {
        this.song = song;
        this.currentTime = 0;
        this.isPlaying = false;
        this.lastTimestamp = null;
        this._triggeredNoteIds.clear();
        this.isWaiting = false;
        this.waitingForNotes.clear();
        this.activeTracks = new Set(song.tracks.map((_, i) => i));
    }

    play() {
        if (!this.song) return;
        this.isPlaying = true;
        this.isWaiting = false;
        this.lastTimestamp = performance.now();
    }

    pause() {
        this.isPlaying = false;
        this.lastTimestamp = null;
    }

    stop() {
        this.isPlaying = false;
        this.currentTime = this.loopEnabled ? this.loopStart : 0;
        this.lastTimestamp = null;
        this._triggeredNoteIds.clear();
        this.isWaiting = false;
        this.waitingForNotes.clear();
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.song?.totalDuration || 0));
        this._triggeredNoteIds.clear();
        this.lastTimestamp = this.isPlaying ? performance.now() : null;
        this.isWaiting = false;
        this.waitingForNotes.clear();
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    // --- Phase 2 controls ---

    setWaitMode(enabled) {
        this.waitMode = enabled;
        if (!enabled) {
            this.isWaiting = false;
            this.waitingForNotes.clear();
        }
    }

    setHandMode(mode) {
        this.handMode = mode; // 'both', 'right', 'left'
    }

    setSplitPoint(midi) {
        this.splitPoint = midi;
    }

    setLoop(enabled, start = 0, end = 0) {
        this.loopEnabled = enabled;
        this.loopStart = start;
        this.loopEnd = end || (this.song?.totalDuration || 0);
    }

    setLoopPoints(start, end) {
        this.loopStart = start;
        this.loopEnd = end;
    }

    toggleTrack(trackIndex) {
        if (this.activeTracks.has(trackIndex)) {
            this.activeTracks.delete(trackIndex);
        } else {
            this.activeTracks.add(trackIndex);
        }
    }

    /**
     * Called when user plays a note in wait mode.
     * Returns true if the note was one we were waiting for.
     */
    userPlayedNote(midiNote) {
        if (!this.isWaiting) return false;

        if (this.waitingForNotes.has(midiNote)) {
            this.waitingForNotes.delete(midiNote);

            // If all waiting notes are cleared, resume playback
            if (this.waitingForNotes.size === 0) {
                this.isWaiting = false;
                this.lastTimestamp = performance.now();
            }
            return true;
        }
        return false;
    }

    /**
     * Determine if a note should be active based on hand mode
     */
    _isNoteInActiveHand(note, trackIndex) {
        if (this.handMode === 'both') return true;

        // Strategy: use track index if multi-track, otherwise use split point
        if (this.song && this.song.tracks.length >= 2) {
            // First track = right hand, second track = left hand
            if (this.handMode === 'right') return trackIndex === 0;
            if (this.handMode === 'left') return trackIndex === 1;
        } else {
            // Single track: use split point
            if (this.handMode === 'right') return note.midi >= this.splitPoint;
            if (this.handMode === 'left') return note.midi < this.splitPoint;
        }
        return true;
    }

    /**
     * Update the scheduler - call this every frame.
     */
    update(timestamp, windowBefore = 2, windowAfter = 5) {
        if (!this.song) {
            return {
                currentTime: 0,
                visibleNotes: [],
                activeNotes: [],
                progress: 0,
                isWaiting: false,
                waitingForNotes: [],
            };
        }

        // Don't advance time if waiting
        if (this.isWaiting) {
            this.lastTimestamp = timestamp;
        }
        // Advance time if playing and not waiting
        else if (this.isPlaying && this.lastTimestamp) {
            const delta = (timestamp - this.lastTimestamp) / 1000;
            this.currentTime += delta * this.speed;

            // Loop check
            if (this.loopEnabled && this.currentTime >= this.loopEnd) {
                this.currentTime = this.loopStart;
                this._triggeredNoteIds.clear();
                this.waitingForNotes.clear();
            }
            // End of song check
            else if (this.currentTime >= this.song.totalDuration) {
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
        const notesToWaitFor = [];

        for (const track of this.song.tracks) {
            if (!this.activeTracks.has(track.index)) continue;

            for (const note of track.notes) {
                const noteEnd = note.time + note.duration;
                const inActiveHand = this._isNoteInActiveHand(note, track.index);
                const isRightHand = this.song.tracks.length >= 2
                    ? track.index === 0
                    : note.midi >= this.splitPoint;

                // Is the note visible?
                if (noteEnd >= viewStart && note.time <= viewEnd) {
                    const noteWithTrack = {
                        ...note,
                        trackIndex: track.index,
                        isRightHand,
                        inActiveHand,
                        dimmed: !inActiveHand, // Dim notes not in active hand
                    };
                    visibleNotes.push(noteWithTrack);

                    // Is the note active (being played by song)?
                    if (note.time <= ct && noteEnd > ct) {
                        activeNotes.push(noteWithTrack);

                        // Trigger note-on callback (only for active hand notes)
                        const noteId = `${track.index}-${note.midi}-${note.time}`;
                        if (!this._triggeredNoteIds.has(noteId)) {
                            this._triggeredNoteIds.add(noteId);

                            if (inActiveHand) {
                                this.onNoteOn?.(noteWithTrack);

                                // Wait mode: collect notes to wait for
                                if (this.waitMode && !this.isWaiting) {
                                    notesToWaitFor.push(note.midi);
                                }
                            } else {
                                // Play dimmed hand notes automatically
                                this.onNoteOn?.(noteWithTrack);
                            }
                        }
                    }
                }
            }
        }

        // Enter wait mode if we have notes to wait for
        if (this.waitMode && notesToWaitFor.length > 0 && !this.isWaiting) {
            this.isWaiting = true;
            notesToWaitFor.forEach(midi => this.waitingForNotes.add(midi));
        }

        return {
            currentTime: ct,
            visibleNotes,
            activeNotes,
            progress: this.song.totalDuration > 0 ? ct / this.song.totalDuration : 0,
            isWaiting: this.isWaiting,
            waitingForNotes: [...this.waitingForNotes],
        };
    }
}
