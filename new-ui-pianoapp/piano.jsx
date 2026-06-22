// 88-key piano keyboard, A0..C8.
// Renders semantically (white keys as flex row, black keys absolutely positioned).
// Props: activeNotes (Set of midi numbers), onPress, showLabels, sustain, height.

const NOTE_NAMES_ES = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const NOTE_NAMES_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const isBlack = (midi) => [1,3,6,8,10].includes(midi % 12);
const noteName = (midi, lang='en') => {
  const n = lang === 'es' ? NOTE_NAMES_ES[midi%12] : NOTE_NAMES_EN[midi%12];
  const oct = Math.floor(midi/12) - 1;
  return `${n}${oct}`;
};
const noteShort = (midi, lang='en') => {
  const n = lang === 'es' ? NOTE_NAMES_ES[midi%12] : NOTE_NAMES_EN[midi%12];
  return n.replace('#','♯');
};

window.PIANO_NOTES = { isBlack, noteName, noteShort, NOTE_NAMES_EN, NOTE_NAMES_ES };

// Build 88 keys A0(21) .. C8(108)
const ALL_KEYS = Array.from({length: 88}, (_, i) => 21 + i);
const WHITE_KEYS = ALL_KEYS.filter(m => !isBlack(m));

function Piano({ activeNotes, ghostNotes, fingerings, showLabels, language='es', height=140, onPress, compact=false, fingerGuides=false }) {
  const whiteCount = WHITE_KEYS.length; // 52

  const blackKeyOffset = (midi) => {
    // Black-key ratio: traditionally ~0.6 of a white key; place centered between adjacent whites
    // Find index of preceding white key
    const precedingWhite = WHITE_KEYS.findIndex(w => w > midi) - 1;
    return precedingWhite + 1; // place at right edge of that white
  };

  return (
    <div className="piano" style={{ '--piano-h': `${height}px`, '--white-count': whiteCount }}>
      <div className="piano-felt"></div>
      <div className="piano-whites">
        {WHITE_KEYS.map((midi) => {
          const active = activeNotes?.has(midi);
          const ghost = ghostNotes?.has(midi);
          const showLabel = showLabels && (midi % 12 === 0); // C only by default
          return (
            <button
              key={midi}
              className={`pkey pkey-white ${active ? 'pkey-active' : ''} ${ghost ? 'pkey-ghost' : ''}`}
              onMouseDown={() => onPress?.(midi, true)}
              onMouseUp={() => onPress?.(midi, false)}
              onMouseLeave={() => onPress?.(midi, false)}
            >
              {(showLabels || showLabel) && (
                <span className="pkey-label">{showLabels ? noteShort(midi, language) : `${language==='es'?'Do':'C'}${Math.floor(midi/12)-1}`}</span>
              )}
              {fingerings?.[midi] && <span className="pkey-finger">{fingerings[midi]}</span>}
            </button>
          );
        })}
      </div>
      <div className="piano-blacks">
        {ALL_KEYS.filter(isBlack).map((midi) => {
          const active = activeNotes?.has(midi);
          const ghost = ghostNotes?.has(midi);
          // Position: between the white at index whiteBefore and whiteBefore+1
          const whiteBefore = WHITE_KEYS.filter(w => w < midi).length - 1;
          const left = `calc(${(whiteBefore+1)} * (100% / var(--white-count)) - (100% / var(--white-count)) * 0.32)`;
          return (
            <button
              key={midi}
              className={`pkey pkey-black ${active ? 'pkey-active' : ''} ${ghost ? 'pkey-ghost' : ''}`}
              style={{ left }}
              onMouseDown={() => onPress?.(midi, true)}
              onMouseUp={() => onPress?.(midi, false)}
              onMouseLeave={() => onPress?.(midi, false)}
            >
              {fingerings?.[midi] && <span className="pkey-finger">{fingerings[midi]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

window.Piano = Piano;
