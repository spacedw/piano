import React, { useState, useCallback, useEffect, useRef } from 'react';
import Piano from '@/components/Piano';
import Waterfall from '@/components/Waterfall';
import PlaybackBar from '@/components/Controls';
import MidiStatus from '@/components/MidiStatus';
import PracticePanel from '@/components/PracticePanel';
import ScoreOverlay from '@/components/ScoreOverlay';
import Library from '@/components/Library';
import ProgressDashboard from '@/components/ProgressDashboard';
import SettingsPanel from '@/components/SettingsPanel';
import PedalMinimap from '@/components/PedalMinimap';
import { useMidi } from '@/hooks/useMidi';
import { useAudio } from '@/hooks/useAudio';
import { useSong } from '@/hooks/useSong';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useMetronome } from '@/hooks/useMetronome';
import { ScoreEngine } from '@/engine/ScoreEngine';
import { RecordingEngine } from '@/engine/RecordingEngine';
import { saveSong, updateSongMeta, saveSession, saveRecording } from '@/engine/Storage';
import { loadMidiFromFile } from '@/engine/MidiParser';
import { supabase, getUser, syncProgress } from '@/engine/SupabaseClient';
import { useUserTier } from '@/hooks/useUserTier';
import { useWakeLock } from '@/hooks/useWakeLock';

function App() {
  const { isSupporter } = useUserTier();
  const midi = useMidi();
  const audio = useAudio();
  const song = useSong();
  const metronome = useMetronome(120);

  const [audioInitialized, setAudioInitialized] = useState(
    () => !!sessionStorage.getItem('audioInitialized')
  );
  const [user, setUser] = useState(null);
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

  // Phase 3-4: UI panels
  const [showLibrary, setShowLibrary] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSongId, setCurrentSongId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Playback pedal state (from song/recording playback)
  const [playbackPedals, setPlaybackPedals] = useState({ sustain: false, sostenuto: false, soft: false });

  const mainRef = useRef(null);
  const waterfallRef = useRef(null);
  const scoreEngineRef = useRef(new ScoreEngine());
  const recordingRef = useRef(new RecordingEngine());

  // Keep screen awake while user is in the app; during playback, idle timer resets automatically
  useWakeLock(audioInitialized, song.isPlaying);

  // Auth state
  useEffect(() => {
    getUser().then(setUser);
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    }) ?? { data: { subscription: null } };
    return () => subscription?.unsubscribe();
  }, []);

  // Initialize audio
  const handleInitAudio = useCallback(async () => {
    await audio.initAudio();
    sessionStorage.setItem('audioInitialized', '1');
    setAudioInitialized(true);
  }, [audio]);

  // Auto-resume audio after HMR or OAuth redirect (sampler lost but sessionStorage still set)
  useEffect(() => {
    if (!audioInitialized || audio.loaded || audio.loading) return;
    const resume = () => audio.initAudio();
    window.addEventListener('pointerdown', resume, { once: true });
    return () => window.removeEventListener('pointerdown', resume);
  }, [audioInitialized, audio.loaded, audio.loading]);

  // MIDI → audio + scoring + recording
  useEffect(() => {
    if (!audioInitialized) return;

    midi.setNoteCallbacks({
      onNoteOn: (midiNote, velocity) => {
        audio.noteOn(midiNote, velocity);

        // Recording
        if (isRecording) {
          recordingRef.current.recordNoteOn(midiNote, velocity);
        }

        // Wait mode
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
        if (isRecording) {
          recordingRef.current.recordNoteOff(midiNote);
        }
      },
      onSustain: (isOn) => {
        audio.setSustain(isOn);
        if (isRecording) recordingRef.current.recordPedalEvent(64, isOn);
      },
      onSostenuto: (isOn) => {
        audio.setSostenuto(isOn);
        if (isRecording) recordingRef.current.recordPedalEvent(66, isOn);
      },
      onSoft: (isOn) => {
        audio.setSoft(isOn);
        if (isRecording) recordingRef.current.recordPedalEvent(67, isOn);
      },
    });
  }, [audioInitialized, midi, audio, waitMode, song, isWaiting, isRecording]);

  // Song → audio + scoring
  useEffect(() => {
    song.setNoteCallbacks({
      onNoteOn: (note) => {
        if (audioInitialized) audio.noteOn(note.midi, note.velocity);
        if (note.inActiveHand !== false) {
          scoreEngineRef.current.addExpectedNote(note);
        }
      },
      onNoteOff: (note) => { if (audioInitialized) audio.noteOff(note.midi); },
      onPedalEvent: (cc, isOn) => {
        if (!audioInitialized) return;
        if (cc === 64) { audio.setSustain(isOn); setPlaybackPedals(p => ({ ...p, sustain: isOn })); }
        else if (cc === 66) { audio.setSostenuto(isOn); setPlaybackPedals(p => ({ ...p, sostenuto: isOn })); }
        else if (cc === 67) { audio.setSoft(isOn); setPlaybackPedals(p => ({ ...p, soft: isOn })); }
      },
    });
  }, [audioInitialized, song, audio]);

  // Sync practice settings
  useEffect(() => {
    if (song.scheduler) song.scheduler.setWaitMode(waitMode);
  }, [waitMode, song.scheduler]);

  useEffect(() => {
    if (song.scheduler) song.scheduler.setHandMode(handMode);
  }, [handMode, song.scheduler]);

  useEffect(() => {
    if (song.scheduler) song.scheduler.setLoop(loopEnabled, loopStart, loopEnd);
  }, [loopEnabled, loopStart, loopEnd, song.scheduler]);

  // Song metadata sync
  useEffect(() => {
    if (song.song) {
      metronome.setBpm(Math.round(song.song.bpm));
      setLoopEnd(song.song.totalDuration);
    }
  }, [song.song]);

  // Release pedals and notes when playback stops
  useEffect(() => {
    if (!song.isPlaying && audioInitialized) {
      // Release all pedals first so sustained notes begin their natural decay
      audio.setSustain(false);
      audio.setSostenuto(false);
      audio.setSoft(false);
      setPlaybackPedals({ sustain: false, sostenuto: false, soft: false });
      // Give a short grace period for notes to decay naturally, then clean up
      const timer = setTimeout(() => audio.allNotesOff(), 2000);
      return () => clearTimeout(timer);
    }
  }, [song.isPlaying]);

  // Session tracking — start timer when play begins
  useEffect(() => {
    if (song.isPlaying && !sessionStartTime) {
      setSessionStartTime(Date.now());
      scoreEngineRef.current.reset();
      setScoreStats(null);
      setLastScore(null);
    }
  }, [song.isPlaying]);

  // Save session when song stops
  useEffect(() => {
    if (!song.isPlaying && sessionStartTime && currentSongId) {
      const duration = (Date.now() - sessionStartTime) / 1000;
      if (duration > 5) { // don't save sessions shorter than 5s
        const stats = scoreEngineRef.current.getStats();
        const sessionData = {
          songId: currentSongId,
          songName: song.song?.name || 'Unknown',
          duration,
          score: stats.totalScore,
          notesHit: stats.notesHit,
          notesMissed: stats.notesMissed,
          accuracy: stats.accuracy,
          maxStreak: stats.maxStreak,
          speed: song.speed,
          handMode,
        };

        saveSession(sessionData).then(saved => {
          if (isSupporter) {
            syncProgress([saved]).catch(e => console.error('Cloud sync failed:', e));
          }
        });
        
        // Update best score on song
        if (stats.totalScore > 0) {
          updateSongMeta(currentSongId, {
            lastPlayedAt: Date.now(),
            playCount: (song.song?.playCount || 0) + 1,
            bestScore: Math.max(song.song?.bestScore || 0, stats.totalScore),
          });
        }
      }
      setSessionStartTime(null);
    }
  }, [song.isPlaying, sessionStartTime, currentSongId]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      if (mainRef.current) setPianoWidth(mainRef.current.clientWidth);
      if (waterfallRef.current) setWaterfallHeight(waterfallRef.current.clientHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(handleResize);
    if (mainRef.current) observer.observe(mainRef.current);
    if (waterfallRef.current) observer.observe(waterfallRef.current);
    return () => { window.removeEventListener('resize', handleResize); observer.disconnect(); };
  }, [audioInitialized]);

  // Animation loop
  useAnimationLoop((timestamp) => {
    const result = song.update(timestamp);
    setVisibleNotes(result.visibleNotes);
    setSongActiveNotes(result.activeNotes);
    setIsWaiting(result.isWaiting);
    scoreEngineRef.current.checkTimeouts(3000);

    // Recording playback
    if (recordingRef.current.isPlaying) {
      const events = recordingRef.current.updatePlayback();
      events.forEach(evt => {
        if (evt.type === 'noteOn') audio.noteOn(evt.midi, evt.velocity);
        else if (evt.type === 'noteOff') audio.noteOff(evt.midi);
        else if (evt.type === 'pedal') {
          if (evt.cc === 64) { audio.setSustain(evt.isOn); setPlaybackPedals(p => ({ ...p, sustain: evt.isOn })); }
          else if (evt.cc === 66) { audio.setSostenuto(evt.isOn); setPlaybackPedals(p => ({ ...p, sostenuto: evt.isOn })); }
          else if (evt.cc === 67) { audio.setSoft(evt.isOn); setPlaybackPedals(p => ({ ...p, soft: evt.isOn })); }
        }
      });
    }
  }, audioInitialized);

  // Library → load song from saved MIDI data
  const handleSelectSong = useCallback(async (songData) => {
    if (!songData.midiData) return;
    const blob = new Blob([songData.midiData]);
    const file = new File([blob], songData.name + '.mid');
    await song.loadFile(file, songData.name);
    setCurrentSongId(songData.id);
    setShowLibrary(false);
    updateSongMeta(songData.id, { lastPlayedAt: Date.now() });
  }, [song]);

  // Recording controls
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recordingRef.current.stopRecording();
      const data = recordingRef.current.getData();
      saveRecording({
        songId: currentSongId,
        songName: song.song?.name || 'Free Play',
        duration: data.duration,
        events: data.events,
        score: scoreStats?.totalScore || 0,
      });
      setIsRecording(false);
    } else {
      recordingRef.current.startRecording();
      setIsRecording(true);
    }
  }, [isRecording, currentSongId, song.song, scoreStats]);

  const handlePlayRecording = useCallback((rec) => {
    recordingRef.current.loadData(rec);
    recordingRef.current.startPlayback();
    setShowProgress(false);
  }, []);

  const handleSaveRecordingToLibrary = useCallback(async (rec) => {
    try {
      // Debug: trace pedal events through save pipeline
      const pedalCount = (rec.events || []).filter(e => e.type === 'pedal').length;
      console.log(`[PedalDebug] Recording has ${pedalCount} pedal events before MIDI export`);

      const midiBuffer = await RecordingEngine.toMidiArrayBuffer(rec);

      // Debug: verify pedal events survived MIDI export by re-parsing
      const { parseMidiFile } = await import('@/engine/MidiParser');
      const verifyParsed = parseMidiFile(midiBuffer);
      console.log(`[PedalDebug] After MIDI export → re-parse: ${verifyParsed.pedalEvents.length} pedal events`);

      const saved = await saveSong({
        name: rec.songName || 'My Recording',
        bpm: 120,
        totalDuration: rec.duration,
        noteCount: rec.events.filter(e => e.type === 'noteOn').length,
        trackCount: 1,
        midiData: midiBuffer,
        source: 'recording',
      });
      // Load the newly saved song
      const blob = new Blob([midiBuffer]);
      const file = new File([blob], (rec.songName || 'recording') + '.mid');
      await song.loadFile(file, rec.songName || 'My Recording');
      setCurrentSongId(saved.id);
      setShowProgress(false);
    } catch (err) {
      console.error('Failed to export recording:', err);
    }
  }, [song]);

  // Drag & drop
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
      // Save to library + load
      const buffer = await file.arrayBuffer();
      const { Midi } = await import('@tonejs/midi');
      const midi = new Midi(buffer);
      const saved = await saveSong({
        name: midi.name || file.name.replace(/\.(mid|midi)$/i, ''),
        bpm: Math.round(midi.header.tempos?.[0]?.bpm || 120),
        totalDuration: midi.duration,
        noteCount: midi.tracks.reduce((sum, t) => sum + t.notes.length, 0),
        trackCount: midi.tracks.filter(t => t.notes.length > 0).length,
        midiData: buffer,
      });
      setCurrentSongId(saved.id);
      song.loadFile(file);
    }
  }, [song]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); song.togglePlay(); break;
        case 'Escape': song.stop(); break;
        case 'KeyW': setWaitMode(prev => !prev); break;
        case 'KeyM': metronome.toggle(); break;
        case 'KeyL': setLoopEnabled(prev => !prev); break;
        case 'KeyR': toggleRecording(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song, metronome, toggleRecording]);

  // Loop handlers
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
        <p>Connect your MIDI piano and start playing. Load any MIDI file and learn your favorite songs with visual guides.</p>
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
    <div className="app" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🎹</div>
          <div className="app-logo-text">PIANO<span>APP</span></div>
        </div>
        <div className="app-header-right">
          {/* Nav buttons */}
          <button className="nav-btn" onClick={() => setShowLibrary(true)} title="Song Library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </button>
          <button className="nav-btn" onClick={() => setShowProgress(true)} title="Progress">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
          </button>
          <button
            className={`nav-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <div className={`rec-dot ${isRecording ? 'active' : ''}`} />
          </button>
          {user ? (
            <button className="nav-btn avatar-btn" onClick={() => setShowSettings(true)} title={`Account: ${user.email}`}>
              <span className="header-avatar">{user.email?.[0]?.toUpperCase() || '?'}</span>
            </button>
          ) : (
            <button className="nav-btn" onClick={() => setShowSettings(true)} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
              </svg>
            </button>
          )}

          <div className="header-divider" />

          {/* Audio not ready indicator (shows after HMR or OAuth redirect) */}
          {audioInitialized && !audio.loaded && !audio.loading && (
            <button className="audio-resume-btn" onClick={audio.initAudio} title="Click to enable audio">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
                <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
              </svg>
              <span>Tap to enable audio</span>
            </button>
          )}
          {audioInitialized && audio.loading && (
            <span className="audio-loading-badge">Loading piano...</span>
          )}

          {/* Volume */}
          <div className="volume-section">
            <button className="volume-btn" onClick={audio.toggleMute}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {audio.muted ? (
                  <>
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
                    <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                  </>
                ) : (
                  <>
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
                    <path d="M15.54 8.46a5 5 0 010 7.07" /><path d="M19.07 4.93a10 10 0 010 14.14" />
                  </>
                )}
              </svg>
            </button>
            <input type="range" className="volume-slider" min="0" max="1" step="0.01"
              value={audio.muted ? 0 : audio.volume}
              onChange={(e) => audio.setVolume(Number(e.target.value))} />
          </div>

          <MidiStatus
            enabled={midi.enabled} error={midi.error} inputs={midi.inputs}
            selectedInput={midi.selectedInput} onSelectInput={midi.selectInput}
            sustainPedal={midi.sustainPedal}
            sostenutoPedal={midi.sostenutoPedal}
            softPedal={midi.softPedal}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="app-main" ref={mainRef}>
        <div className="piano-section">
          <div className="waterfall-area" ref={waterfallRef}>
            {song.song ? (
              <>
                <Waterfall
                  visibleNotes={visibleNotes} currentTime={song.currentTime}
                  width={pianoWidth} height={waterfallHeight}
                  activeNotes={midi.activeNotes}
                  loopEnabled={loopEnabled} loopStart={loopStart} loopEnd={loopEnd}
                  isWaiting={isWaiting}
                />
                <ScoreOverlay lastScore={lastScore} />
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">♪</div>
                <div className="empty-state-text">Load a MIDI file to begin</div>
                <div className="empty-state-hint">Drag & drop a .mid file, click Open, or browse your Library</div>
              </div>
            )}
            {song.song && (
              <PracticePanel
                song={song.song}
                waitMode={waitMode} onWaitModeChange={setWaitMode} isWaiting={isWaiting}
                handMode={handMode} onHandModeChange={setHandMode}
                speed={song.speed} onSpeedChange={song.setSpeed}
                loopEnabled={loopEnabled} loopStart={loopStart} loopEnd={loopEnd}
                onLoopChange={handleLoopChange} onLoopPointsChange={handleLoopPointsChange}
                currentTime={song.currentTime} totalDuration={song.song.totalDuration}
                metronomeEnabled={metronome.enabled} metronomeBpm={metronome.bpm}
                metronomeCurrentBeat={metronome.currentBeat}
                metronomeBeatsPerMeasure={metronome.beatsPerMeasure}
                onMetronomeToggle={metronome.toggle} onMetronomeBpmChange={metronome.setBpm}
                scoreStats={scoreStats}
              />
            )}
          </div>
          <Piano activeNotes={midi.activeNotes} songActiveNotes={songActiveNotes}
            width={pianoWidth} height={160} />
          <PedalMinimap
            liveSustain={midi.sustainPedal}
            liveSostenuto={midi.sostenutoPedal}
            liveSoft={midi.softPedal}
            playbackSustain={playbackPedals.sustain}
            playbackSostenuto={playbackPedals.sostenuto}
            playbackSoft={playbackPedals.soft}
          />
        </div>
        <PlaybackBar
          song={song.song} isPlaying={song.isPlaying} currentTime={song.currentTime}
          progress={song.progress} speed={song.speed} loading={song.loading}
          onLoadFile={song.loadFile} onTogglePlay={song.togglePlay} onStop={song.stop}
          onSeek={song.seek} onSpeedChange={song.setSpeed}
        />
      </main>

      {/* Modals */}
      <Library isOpen={showLibrary} onClose={() => setShowLibrary(false)}
        onSelectSong={handleSelectSong} currentSongId={currentSongId} />
      <ProgressDashboard isOpen={showProgress} onClose={() => setShowProgress(false)}
        onPlayRecording={handlePlayRecording} onSaveToLibrary={handleSaveRecordingToLibrary} />
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} user={user} onUserChange={setUser} />

      {/* Drag overlay */}
      {isDragging && (
        <div className="drop-zone-active">
          <div className="drop-zone-content">
            <span>Drop MIDI file here</span>
            <small>.mid or .midi files — saves to library</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
