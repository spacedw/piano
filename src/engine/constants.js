// MIDI note constants and mappings
export const TOTAL_KEYS = 88;
export const FIRST_NOTE = 21; // A0
export const LAST_NOTE = 108; // C8
export const MIDDLE_C = 60; // C4

// Note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Map a MIDI note number to a note name (e.g. 60 → "C4")
export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

// Check if a MIDI note is a black key
export function isBlackKey(midi) {
  const n = midi % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

// Get the white key index (0-51) for a given MIDI note
export function getWhiteKeyIndex(midi) {
  let count = 0;
  for (let i = FIRST_NOTE; i < midi; i++) {
    if (!isBlackKey(i)) count++;
  }
  return count;
}

// MIDI command types
export const MIDI_NOTE_ON = 0x90;
export const MIDI_NOTE_OFF = 0x80;
export const MIDI_CC = 0xB0;
export const CC_SUSTAIN = 64;

// Waterfall colors
export const COLORS = {
  background: '#0A0A0B',
  surface: '#141416',
  card: '#1A1A1E',
  accentGold: '#C9A96E',
  accentLight: '#E8D5A8',
  textPrimary: '#F5F5F5',
  textSecondary: '#8A8A8F',
  success: '#4ADE80',
  error: '#F87171',
  whiteKey: '#FAFAFA',
  whiteKeyPressed: '#E8D5A8',
  blackKey: '#1A1A1E',
  blackKeyPressed: '#C9A96E',
  rightHand: '#C9A96E',
  leftHand: '#8B9DC3',
  waterfall: {
    rightHand: 'rgba(201, 169, 110, 0.85)',
    leftHand: 'rgba(139, 157, 195, 0.85)',
    rightHandBorder: 'rgba(232, 213, 168, 1)',
    leftHandBorder: 'rgba(170, 185, 215, 1)',
  }
};

// Key dimensions (will be scaled)
export const KEY_LAYOUT = {
  whiteKeyWidth: 24,
  whiteKeyHeight: 140,
  blackKeyWidth: 14,
  blackKeyHeight: 90,
  gap: 1,
};

// Speed multipliers
export const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

// Scoring thresholds
export const SCORE_THRESHOLDS = {
  perfect: 95,
  great: 80,
  good: 60,
};
