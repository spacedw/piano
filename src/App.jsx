import React, { useState, useCallback, useEffect, useRef } from 'react';
import Piano from './components/Piano/Piano';
import Waterfall from './components/Waterfall/Waterfall';
import PlaybackBar from './components/Controls/PlaybackBar';
import MidiStatus from './components/MidiStatus/MidiStatus';
import { useMidi } from './hooks/useMidi';
import { useAudio } from './hooks/useAudio';
import { useSong } from './hooks/useSong';
import { useAnimationLoop } from './hooks/useAnimationLoop';

function App() {
  const midi = useMidi();
  const audio = useAudio();
  const song = useSong();

  const [audioInitialized, setAudioInitialized] = useState(false);
  const [pianoWidth, setPianoWidth] = useState(1200);
  const [waterfallHeight, setWaterfallHeight] = useState(400);
  const [visibleNotes, setVisibleNotes] = useState([]);
  const [songActiveNotes, setSongActiveNotes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const mainRef = useRef(null);
  const waterfallRef = useRef(null);

  // Initialize audio on user interaction
  const handleInitAudio = useCallback(async () => {
    await audio.initAudio();
    setAudioInitialized(true);
  }, [audio]);

  // Connect MIDI input to audio engine
  useEffect(() => {
    if (!audioInitialized) return;

    midi.setNoteCallbacks({
      onNoteOn: (midiNote, velocity) => {
        audio.noteOn(midiNote, velocity);
      },
      onNoteOff: (midiNote) => {
        audio.noteOff(midiNote);
      },
      onSustain: (isOn) => {
        // Sustain pedal handling could be enhanced here
      },
    });
  }, [audioInitialized, midi, audio]);

  // Connect song note-on events to audio
  useEffect(() => {
    song.setNoteCallbacks({
      onNoteOn: (note) => {
        if (audioInitialized) {
          audio.noteOn(note.midi, note.velocity);
        }
      },
      onNoteOff: (note) => {
        if (audioInitialized) {
          audio.noteOff(note.midi);
        }
      },
    });
  }, [audioInitialized, song, audio]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (mainRef.current) {
        setPianoWidth(mainRef.current.clientWidth);
      }
      if (waterfallRef.current) {
        setWaterfallHeight(waterfallRef.current.clientHeight);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(handleResize);
    if (mainRef.current) observer.observe(mainRef.current);
    if (waterfallRef.current) observer.observe(waterfallRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [audioInitialized]);

  // Animation loop – updates scheduler and redraws
  useAnimationLoop((timestamp) => {
    const result = song.update(timestamp);
    setVisibleNotes(result.visibleNotes);
    setSongActiveNotes(result.activeNotes);
  }, audioInitialized);

  // Drag & drop MIDI files
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
      song.loadFile(file);
    }
  }, [song]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          song.togglePlay();
          break;
        case 'Escape':
          song.stop();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song]);

  // Audio init overlay
  if (!audioInitialized) {
    return (
      <div className="audio-init-overlay">
        <h2>PIANO<span>APP</span></h2>
        <p>
          Connect your MIDI piano and start playing. Load any MIDI file and learn your favorite songs with visual guides.
        </p>
        <button className="audio-init-btn" onClick={handleInitAudio}>
          {audio.loading ? 'Loading Piano...' : 'Start Playing'}
        </button>
        <p style={{ fontSize: '11px', color: '#555558', marginTop: '8px' }}>
          Requires Chrome or Edge · MIDI device recommended
        </p>
      </div>
    );
  }

  return (
    <div
      className="app"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🎹</div>
          <div className="app-logo-text">PIANO<span>APP</span></div>
        </div>
        <div className="app-header-right">
          {/* Volume */}
          <div className="volume-section">
            <button className="volume-btn" onClick={audio.toggleMute} title={audio.muted ? 'Unmute' : 'Mute'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {audio.muted ? (
                  <>
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </>
                ) : (
                  <>
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
                    <path d="M15.54 8.46a5 5 0 010 7.07" />
                    <path d="M19.07 4.93a10 10 0 010 14.14" />
                  </>
                )}
              </svg>
            </button>
            <input
              type="range"
              className="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={audio.muted ? 0 : audio.volume}
              onChange={(e) => audio.setVolume(Number(e.target.value))}
            />
          </div>

          <MidiStatus
            enabled={midi.enabled}
            error={midi.error}
            inputs={midi.inputs}
            selectedInput={midi.selectedInput}
            onSelectInput={midi.selectInput}
            sustainPedal={midi.sustainPedal}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="app-main" ref={mainRef}>
        <div className="piano-section">
          {/* Waterfall area */}
          <div className="waterfall-area" ref={waterfallRef}>
            {song.song ? (
              <Waterfall
                visibleNotes={visibleNotes}
                currentTime={song.currentTime}
                width={pianoWidth}
                height={waterfallHeight}
                activeNotes={midi.activeNotes}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">♪</div>
                <div className="empty-state-text">Load a MIDI file to begin</div>
                <div className="empty-state-hint">Drag & drop a .mid file or click Open below</div>
              </div>
            )}
          </div>

          {/* Piano */}
          <Piano
            activeNotes={midi.activeNotes}
            songActiveNotes={songActiveNotes}
            width={pianoWidth}
            height={160}
          />
        </div>

        {/* Controls */}
        <PlaybackBar
          song={song.song}
          isPlaying={song.isPlaying}
          currentTime={song.currentTime}
          progress={song.progress}
          speed={song.speed}
          loading={song.loading}
          onLoadFile={song.loadFile}
          onTogglePlay={song.togglePlay}
          onStop={song.stop}
          onSeek={song.seek}
          onSpeedChange={song.setSpeed}
        />
      </main>

      {/* Drag overlay */}
      {isDragging && (
        <div className="drop-zone-active">
          <div className="drop-zone-content">
            <span>Drop MIDI file here</span>
            <small>.mid or .midi files</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
