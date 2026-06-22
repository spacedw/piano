import { Midi } from '@tonejs/midi';

/**
 * Parse a MIDI file ArrayBuffer into a structured song object.
 * @param {ArrayBuffer} arrayBuffer - Raw MIDI file data
 * @returns {Object} Parsed song data
 */
export function parseMidiFile(arrayBuffer) {
    const midi = new Midi(arrayBuffer);

    // Lead-in: push all events forward so notes at t=0 don't fire immediately
    // Tail: extra time after last note for sustained sounds to ring out
    const LEAD_IN_TIME = 1.0;  // seconds before first note
    const TAIL_TIME = 3.0;     // seconds after last note ends

    // Pedal CC numbers we care about
    const PEDAL_CCS = [64, 66, 67]; // sustain, sostenuto, soft

    const tracks = midi.tracks
        .filter(track => track.notes.length > 0)
        .map((track, index) => ({
            index,
            name: track.name || `Track ${index + 1}`,
            instrument: track.instrument?.name || 'Piano',
            channel: track.channel,
            notes: track.notes.map(note => ({
                midi: note.midi,
                name: note.name,
                time: note.time + LEAD_IN_TIME,   // offset by lead-in
                duration: note.duration,
                velocity: note.velocity,
                ticks: note.ticks,
                durationTicks: note.durationTicks,
            })),
        }));

    // Extract pedal CC events from ALL tracks (including note-less ones)
    const pedalEvents = [];
    for (const track of midi.tracks) {
        for (const ccNum of PEDAL_CCS) {
            const ccEvents = track.controlChanges[ccNum];
            if (ccEvents) {
                for (const cc of ccEvents) {
                    pedalEvents.push({
                        time: cc.time + LEAD_IN_TIME,  // offset by lead-in
                        cc: ccNum,
                        value: cc.value,
                        isOn: cc.value >= 0.5,
                    });
                }
            }
        }
    }
    // Sort by time so the scheduler can process them in order
    pedalEvents.sort((a, b) => a.time - b.time);

    // Calculate total duration (including lead-in and tail)
    const allNotes = tracks.flatMap(t => t.notes);
    const rawEnd = allNotes.reduce((max, note) => {
        return Math.max(max, note.time + note.duration);
    }, 0);
    const totalDuration = rawEnd + TAIL_TIME;

    return {
        name: midi.name || 'Untitled',
        bpm: midi.header.tempos?.[0]?.bpm || 120,
        timeSignature: midi.header.timeSignatures?.[0] || { timeSignature: [4, 4] },
        ppq: midi.header.ppq,
        totalDuration,
        tracks,
        pedalEvents,
        totalNotes: allNotes.length,
    };
}

/**
 * Load a MIDI file from a File object (drag & drop / file input)
 * @param {File} file - The MIDI file
 * @returns {Promise<Object>} Parsed song data
 */
export async function loadMidiFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return parseMidiFile(arrayBuffer);
}

/**
 * Load a MIDI file from a URL
 * @param {string} url - URL to the MIDI file
 * @returns {Promise<Object>} Parsed song data
 */
export async function loadMidiFromURL(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return parseMidiFile(arrayBuffer);
}
