import React, { useState, useCallback, useEffect, useRef } from 'react';
import Piano from './components/Piano/Piano';
import Waterfall from './components/Waterfall/Waterfall';
import PlaybackBar from './components/Controls/PlaybackBar';
import MidiStatus from './components/MidiStatus/MidiStatus';
import PracticePanel from './components/PracticePanel/PracticePanel';
import ScoreOverlay from './components/ScoreOverlay/ScoreOverlay';
import { useMidi } from './hooks/useMidi';
import { useAudio } from './hooks/useAudio';
import { useSong } from './hooks/useSong';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { useMetronome } from './hooks/useMetronome';
import { ScoreEngine } from './engine/ScoreEngine';

function App() {
  const midi = useMidi();
  const audio = useAudio();
  const song = useSong();
  const metronome = useMetronome(120);

  const [audioInitialized, setAudioInitialized] = useState(false);
  const [pianoWidth, setPianoWidth] = useState(1200);
  const [waterfallHeight, setWaterfallHeight] = useState(400);
  const [visibleNotes, setVisibleNotes] = useState([]);
  const [songActiveNotes, setSongActiveNotes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Phase 2: Practice state
  const [waitMode, setWaitMode] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [handMode, setHandMode] = useState('both');
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [scoreStats, setScoreStats] = useState(null);
  const [lastScore, setLastScore] = useState(null);

  const mainRef = useRef(null);
  const waterfallRef = useRef(null);
  const scoreEngineRef = useRef(new ScoreEngine());

  // Initialize audio on user interaction
  const handleInitAudio = useCallback(async () => {
    await audio.initAudio();
    setAudioInitialized(true);
  }, [audio]);

  // Connect MIDI input to audio engine + scoring
  useEffect(() => {
    if (!audioInitialized) return;

    midi.setNoteCallbacks({
      onNoteOn: (midiNote, velocity) => {
        audio.noteOn(midiNote, velocity);

        // Wait mode: notify scheduler
        if (waitMode && song.scheduler) {
          song.scheduler.userPlayedNote(midiNote);
        }

        // Scoring
        if (song.isPlaying || isWaiting) {
          const result = scoreEngineRef.current.scoreNote(midiNote, velocity);
          if (result) {
            setLastScore({ ...result, _ts: Date.now() });
            setScoreStats(scoreEngineRef.current.getStats());
          }
        }
      },
      onNoteOff: (midiNote) => {
        audio.noteOff(midiNote);
      },
      onSustain: () => { },
    });
  }, [audioInitialized, midi, audio, waitMode, song, isWaiting]);

  // Connect song note-on events to audio + scoring
  useEffect(() => {
    song.setNoteCallbacks({
      onNoteOn: (note) => {
        if (audioInitialized) {
          audio.noteOn(note.midi, note.velocity);
        }
        // Register expected note for scoring
        if (note.inActiveHand !== false) {
          scoreEngineRef.current.addExpectedNote(note);
        }
      },
      onNoteOff: () => { },
    });
  }, [audioInitialized, song, audio]);

  // Sync practice settings with scheduler
  useEffect(() => {
    if (!song.scheduler) return;
    song.scheduler.setWaitMode(waitMode);
  }, [waitMode, song.scheduler]);

  useEffect(() => {
    if (!song.scheduler) return;
    song.scheduler.setHandMode(handMode);
  }, [handMode, song.scheduler]);

  useEffect(() => {
    if (!song.scheduler) return;
    song.scheduler.setLoop(loopEnabled, loopStart, loopEnd);
  }, [loopEnabled, loopStart, loopEnd, song.scheduler]);

  // Set metronome BPM from song
  useEffect(() => {
    if (song.song) {
      metronome.setBpm(Math.round(song.song.bpm));
      setLoopEnd(song.song.totalDuration);
    }
  }, [song.song]);

  // Reset score when song changes or stops
  useEffect(() => {
    if (!song.isPlaying) return;
    scoreEngineRef.current.reset();
    setScoreStats(null);
    setLastScore(null);
  }, [song.song]);

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

  // Animation loop
  useAnimationLoop((timestamp) => {
    const result = song.update(timestamp);
    setVisibleNotes(result.visibleNotes);
    setSongActiveNotes(result.activeNotes);
    setIsWaiting(result.isWaiting);

    // Check for missed notes
    scoreEngineRef.current.checkTimeouts(3000);
  }, audioInitialized);

  // Drag & drop
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
        case 'KeyW':
          setWaitMode(prev => !prev);
          break;
        case 'KeyM':
          metronome.toggle();
          break;
        case 'KeyL':
          setLoopEnabled(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song, metronome]);

  // Loop change handler
  const handleLoopChange = useCallback((enabled) => {
    setLoopEnabled(enabled);
    if (enabled && song.song) {
      setLoopStart(Math.max(0, song.currentTime - 2));
      setLoopEnd(Math.min(song.song.totalDuration, song.currentTime + 10));
    }
  }, [song]);

  const handleLoopPointsChange = useCallback((start, end) => {
    setLoopStart(start);
    setLoopEnd(end);
  }, []);

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
              <>
                <Waterfall
                  visibleNotes={visibleNotes}
                  currentTime={song.currentTime}
                  width={pianoWidth}
                  height={waterfallHeight}
                  activeNotes={midi.activeNotes}
                  loopEnabled={loopEnabled}
                  loopStart={loopStart}
                  loopEnd={loopEnd}
                  isWaiting={isWaiting}
                />
                <ScoreOverlay lastScore={lastScore} />
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">♪</div>
                <div className="empty-state-text">Load a MIDI file to begin</div>
                <div className="empty-state-hint">Drag & drop a .mid file or click Open below</div>
              </div>
            )}

            {/* Practice Panel (overlaid on waterfall) */}
            {song.song && (
              <PracticePanel
                song={song.song}
                waitMode={waitMode}
                onWaitModeChange={setWaitMode}
                isWaiting={isWaiting}
                handMode={handMode}
                onHandModeChange={setHandMode}
                speed={song.speed}
                onSpeedChange={song.setSpeed}
                loopEnabled={loopEnabled}
                loopStart={loopStart}
                loopEnd={loopEnd}
                onLoopChange={handleLoopChange}
                onLoopPointsChange={handleLoopPointsChange}
                currentTime={song.currentTime}
                totalDuration={song.song.totalDuration}
                metronomeEnabled={metronome.enabled}
                metronomeBpm={metronome.bpm}
                metronomeCurrentBeat={metronome.currentBeat}
                metronomeBeatsPerMeasure={metronome.beatsPerMeasure}
                onMetronomeToggle={metronome.toggle}
                onMetronomeBpmChange={metronome.setBpm}
                scoreStats={scoreStats}
              />
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
