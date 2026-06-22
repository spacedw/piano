// Waterfall: notes falling toward the keyboard.
// Renders a fixed-height area where note rectangles slide down based on time elapsed.

function Waterfall({ playing, time, notes, language='es', density=1, showHints=true, sparks=[], onSparkDone }) {
  // notes: [{midi, start, duration, hand: 'L'|'R'}]
  // time: current playback seconds
  // density: speed multiplier
  const SECONDS_VISIBLE = 4 / density; // how many seconds of "future" fit in the lane
  const containerRef = React.useRef();

  // Map midi to horizontal position using piano white-key layout.
  const WHITE_TOTAL = 52;
  const positionForMidi = (midi) => {
    const isBlk = window.PIANO_NOTES.isBlack(midi);
    // Count white keys before this midi
    const whitesBefore = [];
    for (let m = 21; m < midi; m++) if (!window.PIANO_NOTES.isBlack(m)) whitesBefore.push(m);
    const idx = whitesBefore.length;
    if (!isBlk) {
      const left = (idx / WHITE_TOTAL) * 100;
      return { left: `${left}%`, width: `calc(${100/WHITE_TOTAL}% - 2px)`, isBlk: false };
    } else {
      const left = ((idx + 1) / WHITE_TOTAL) * 100;
      return { left: `calc(${left}% - ${100/WHITE_TOTAL}% * 0.32)`, width: `calc(${100/WHITE_TOTAL}% * 0.62)`, isBlk: true };
    }
  };

  return (
    <div className="waterfall" ref={containerRef}>
      {/* Vertical reference grid */}
      <div className="wf-grid">
        {[...Array(WHITE_TOTAL+1)].map((_, i) => {
          const x = (i / WHITE_TOTAL) * 100;
          const isC = ((i + 5) % 7 === 0); // every C
          return <div key={i} className={`wf-grid-line ${isC ? 'wf-grid-c' : ''}`} style={{ left: `${x}%` }} />;
        })}
      </div>

      {/* Horizontal beat lines */}
      <div className="wf-beats">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="wf-beat-line" style={{ top: `${(i/8)*100}%` }} />
        ))}
      </div>

      {/* Notes */}
      <div className="wf-notes">
        {notes.map((n, idx) => {
          const dt = n.start - time;
          // Visible if note is within window OR currently playing
          const noteEnd = n.start + n.duration;
          if (noteEnd < time - 0.5) return null;
          if (dt > SECONDS_VISIBLE + 0.5) return null;
          const pos = positionForMidi(n.midi);
          // Y position: 0 = top, 100% = the keyboard line
          const topPct = ((SECONDS_VISIBLE - dt) / SECONDS_VISIBLE) * 100;
          const heightPct = (n.duration / SECONDS_VISIBLE) * 100;
          const playingNow = time >= n.start && time <= noteEnd;
          return (
            <div
              key={idx}
              className={`wf-note ${pos.isBlk ? 'wf-note-blk' : 'wf-note-wht'} ${n.hand === 'L' ? 'wf-note-l' : 'wf-note-r'} ${playingNow ? 'wf-note-now' : ''}`}
              style={{
                left: pos.left,
                width: pos.width,
                top: `calc(${topPct}% - ${heightPct}%)`,
                height: `${heightPct}%`,
              }}
            >
              {n.duration > 0.5 && playingNow && <span className="wf-note-glow" />}
            </div>
          );
        })}
      </div>

      {/* Strike line + glow when active */}
      <div className="wf-strike">
        <div className="wf-strike-line" />
        <div className="wf-strike-fade" />
      </div>

      {/* Sparkles for correct hits */}
      <div className="wf-sparks">
        {sparks.map(s => (
          <div key={s.id} className="wf-spark-cluster" style={{ left: s.x, top: s.y }}
               onAnimationEnd={() => onSparkDone?.(s.id)}>
            {[...Array(8)].map((_, i) => {
              const angle = (i/8) * Math.PI * 2;
              const dx = Math.cos(angle) * 28;
              const dy = Math.sin(angle) * 28;
              return <span key={i} className="wf-spark" style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${i*8}ms` }} />;
            })}
            <span className="wf-spark-core" />
          </div>
        ))}
      </div>
    </div>
  );
}

window.Waterfall = Waterfall;
