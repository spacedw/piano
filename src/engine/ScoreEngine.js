/**
 * ScoreEngine evaluates user performance against expected notes.
 * 
 * Scoring weights:
 *   - Pitch accuracy:    50%
 *   - Timing accuracy:   35%
 *   - Velocity accuracy: 15%
 */

const TIMING_TOLERANCE_MS = 200; // ±200ms window for "perfect" timing
const VELOCITY_TOLERANCE = 0.3;  // ±0.3 tolerance on 0-1 scale

export const SCORE_LEVELS = {
    PERFECT: { min: 95, label: 'Perfect', color: '#C9A96E', glow: 'rgba(201, 169, 110, 0.6)' },
    GREAT: { min: 80, label: 'Great', color: '#4ADE80', glow: 'rgba(74, 222, 128, 0.4)' },
    GOOD: { min: 60, label: 'Good', color: '#FACC15', glow: 'rgba(250, 204, 21, 0.3)' },
    MISS: { min: 0, label: 'Miss', color: '#F87171', glow: 'rgba(248, 113, 113, 0.3)' },
};

export function getScoreLevel(score) {
    if (score >= SCORE_LEVELS.PERFECT.min) return SCORE_LEVELS.PERFECT;
    if (score >= SCORE_LEVELS.GREAT.min) return SCORE_LEVELS.GREAT;
    if (score >= SCORE_LEVELS.GOOD.min) return SCORE_LEVELS.GOOD;
    return SCORE_LEVELS.MISS;
}

export class ScoreEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.noteResults = [];      // Array of { expected, actual, pitchScore, timingScore, velocityScore, totalScore }
        this.totalScore = 0;
        this.notesHit = 0;
        this.notesMissed = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.pendingNotes = new Map(); // midiNote → { expected note, startWait timestamp }
    }

    /**
     * Register an expected note that the user should play.
     * Called when a song note reaches the hit line.
     * @param {Object} expectedNote - { midi, time, velocity, duration }
     */
    addExpectedNote(expectedNote) {
        const key = expectedNote.midi;
        // Store the expected note with the time it appeared
        if (!this.pendingNotes.has(key)) {
            this.pendingNotes.set(key, {
                expected: expectedNote,
                expectedTime: performance.now(),
            });
        }
    }

    /**
     * Register a user-played note and score it against pending expected notes.
     * @param {number} midiNote - MIDI note number played
     * @param {number} velocity - Velocity 0-1
     * @returns {Object|null} Score result or null if no matching expected note
     */
    scoreNote(midiNote, velocity) {
        const pending = this.pendingNotes.get(midiNote);

        if (!pending) {
            // Wrong note or extra note - mild penalty
            return {
                correct: false,
                totalScore: 0,
                level: SCORE_LEVELS.MISS,
                isExtra: true,
            };
        }

        const { expected, expectedTime } = pending;
        const actualTime = performance.now();
        const timeDiff = Math.abs(actualTime - expectedTime);

        // Pitch score: correct note = 100
        const pitchScore = 100;

        // Timing score: based on how close to expected time
        const timingScore = Math.max(0, 100 - (timeDiff / TIMING_TOLERANCE_MS) * 50);

        // Velocity score: how close to expected velocity
        const velDiff = Math.abs(velocity - expected.velocity);
        const velocityScore = Math.max(0, 100 - (velDiff / VELOCITY_TOLERANCE) * 50);

        // Weighted total
        const totalScore = Math.round(
            pitchScore * 0.50 +
            timingScore * 0.35 +
            velocityScore * 0.15
        );

        const level = getScoreLevel(totalScore);

        // Update stats
        this.notesHit++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;

        const result = {
            correct: true,
            midi: midiNote,
            pitchScore,
            timingScore: Math.round(timingScore),
            velocityScore: Math.round(velocityScore),
            totalScore,
            level,
            streak: this.streak,
        };

        this.noteResults.push(result);
        this.pendingNotes.delete(midiNote);

        // Update running average
        this._updateTotalScore();

        return result;
    }

    /**
     * Mark a note as missed (user didn't play it in time).
     * @param {number} midiNote
     */
    markMissed(midiNote) {
        if (this.pendingNotes.has(midiNote)) {
            this.pendingNotes.delete(midiNote);
            this.notesMissed++;
            this.streak = 0;


            this.noteResults.push({
                correct: false,
                midi: midiNote,
                totalScore: 0,
                level: SCORE_LEVELS.MISS,
            });

            this._updateTotalScore();
        }
    }

    /**
     * Check for timed-out pending notes (notes the user missed).
     * @param {number} timeoutMs - Max time allowed to hit a note
     */
    checkTimeouts(timeoutMs = 2000) {
        const now = performance.now();
        const toRemove = [];

        this.pendingNotes.forEach((data, midi) => {
            if (now - data.expectedTime > timeoutMs) {
                toRemove.push(midi);
            }
        });

        toRemove.forEach(midi => this.markMissed(midi));
    }

    _updateTotalScore() {
        if (this.noteResults.length === 0) {
            this.totalScore = 0;
            return;
        }
        const sum = this.noteResults.reduce((acc, r) => acc + r.totalScore, 0);
        this.totalScore = Math.round(sum / this.noteResults.length);
    }

    getStats() {
        return {
            totalScore: this.totalScore,
            level: getScoreLevel(this.totalScore),
            notesHit: this.notesHit,
            notesMissed: this.notesMissed,
            totalNotes: this.notesHit + this.notesMissed,
            accuracy: this.notesHit + this.notesMissed > 0
                ? Math.round((this.notesHit / (this.notesHit + this.notesMissed)) * 100)
                : 0,
            streak: this.streak,
            maxStreak: this.maxStreak,
        };
    }
}
