import { Midi } from '@tonejs/midi';

/**
 * Parse a MIDI file ArrayBuffer into a structured song object.
 * @param {ArrayBuffer} arrayBuffer - Raw MIDI file data
 * @returns {Object} Parsed song data
 */
export function parseMidiFile(arrayBuffer) {
    const midi = new Midi(arrayBuffer);

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
                time: note.time,           // in seconds
                duration: note.duration,   // in seconds
                velocity: note.velocity,   // 0-1
                ticks: note.ticks,
                durationTicks: note.durationTicks,
            })),
        }));

    // Calculate total duration
    const allNotes = tracks.flatMap(t => t.notes);
    const totalDuration = allNotes.reduce((max, note) => {
        return Math.max(max, note.time + note.duration);
    }, 0);

    return {
        name: midi.name || 'Untitled',
        bpm: midi.header.tempos?.[0]?.bpm || 120,
        timeSignature: midi.header.timeSignatures?.[0] || { timeSignature: [4, 4] },
        ppq: midi.header.ppq,
        totalDuration,
        tracks,
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
