import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useT, useLocale } from '@/i18n';
import NavRail from '@/components/NavRail';
import SettingsPanel from '@/components/SettingsPanel';
import PricingModal from '@/components/PricingModal';
import Onboarding from '@/components/Onboarding';
import RecordingDoneModal from '@/components/RecordingDoneModal';
import RecordingMiniPlayer from '@/components/RecordingMiniPlayer';
import { useMidi } from '@/hooks/useMidi';
import { useAudio } from '@/hooks/useAudio';
import { useSong } from '@/hooks/useSong';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useMetronome } from '@/hooks/useMetronome';
import { ScoreEngine } from '@/engine/ScoreEngine';
import { RecordingEngine } from '@/engine/RecordingEngine';
import { saveSong, updateSongMeta, saveSession, saveRecording, getSetting } from '@/engine/Storage';
import { supabase, getUser, syncProgress } from '@/engine/SupabaseClient';
import { useUserTier } from '@/hooks/useUserTier';
import { initSync, syncAll } from '@/engine/SyncEngine';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useMicrophone } from '@/hooks/useMicrophone';

export default function AppLayout() {
  const t = useT();
  const { locale: language } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSupporter, tier } = useUserTier();
  const midi = useMidi();
  const audio = useAudio();
  const song = useSong();
  const metronome = useMetronome(120);
  const mic = useMicrophone();
  const [micActiveNotes, setMicActiveNotes] = useState(() => new Map());

  const [audioInitialized, setAudioInitialized] = useState(
    () => !!sessionStorage.getItem('audioInitialized')
  );
  const [user, setUser] = useState(null);
  const [pianoWidth, setPianoWidth] = useState(1200);
  const [waterfallHeight, setWaterfallHeight] = useState(400);
  const [visibleNotes, setVisibleNotes] = useState([]);
  const [songActiveNotes, setSongActiveNotes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [notation, setNotation] = useState('solfege');

  // Load notation setting from IndexedDB
  useEffect(() => {
    getSetting('notation', 'solfege').then(setNotation);
  }, []);

  // Listen for settings changes from settings panel
  useEffect(() => {
    const handleSettingsChanged = (e) => {
      const { key, value } = e.detail || {};
      if (key === 'notation') getSetting('notation', 'solfege').then(setNotation);
      if (key === 'mute') audio.setMute(value);
      if (key === 'volume') audio.setVolume(value / 100);
    };
    window.addEventListener('settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('settings-changed', handleSettingsChanged);
  }, [audio]);

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('pianoapp_onboarded')
  );
  const [showRecDone, setShowRecDone] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);

  // Practice state
  const [waitMode, setWaitMode] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [handMode, setHandMode] = useState('both');
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [countIn, setCountIn] = useState(0);
  const [scoreStats, setScoreStats] = useState(null);
  const [lastScore, setLastScore] = useState(null);

  // Mic wait mode state
  const [waitModeBeforeMic, setWaitModeBeforeMic] = useState(false);
  const [micGhostNotes, setMicGhostNotes] = useState(() => new Set());

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [currentSongId, setCurrentSongId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [lastRecordingData, setLastRecordingData] = useState(null);

  // Recording playback (mini-player)
  const [recPlayback, setRecPlayback] = useState({
    active: false, paused: false, name: '', progress: 0, currentTime: 0, duration: 0,
  });

  // Pedals
  const [playbackPedals, setPlaybackPedals] = useState({ sustain: false, sostenuto: false, soft: false });

  // 3D toggle (standby)
  const [view3d, setView3d] = useState(false);

  const mainRef = useRef(null);
  const waterfallRef = useRef(null);
  const scoreEngineRef = useRef(new ScoreEngine());
  const recordingRef = useRef(new RecordingEngine());

  useWakeLock(audioInitialized, song.isPlaying);

  // Practice settings
  const practiceSettings = {
    waitMode, hands: handMode, loop: loopEnabled,
    loopStart, loopEnd, metro: metronome.enabled,
    bpm: metronome.bpm, countIn,
  };

  const setPracticeSettings = useCallback((newSettings) => {
    if (newSettings.waitMode !== undefined) setWaitMode(newSettings.waitMode);
    if (newSettings.hands !== undefined) setHandMode(newSettings.hands);
    if (newSettings.loop !== undefined) setLoopEnabled(newSettings.loop);
    if (newSettings.loopStart !== undefined) setLoopStart(newSettings.loopStart);
    if (newSettings.loopEnd !== undefined) setLoopEnd(newSettings.loopEnd);
    if (newSettings.metro !== undefined) {
      if (newSettings.metro !== metronome.enabled) metronome.toggle();
    }
    if (newSettings.bpm !== undefined) metronome.setBpm(newSettings.bpm);
    if (newSettings.countIn !== undefined) setCountIn(newSettings.countIn);
  }, [metronome]);

  // ─── Auth ───
  useEffect(() => {
    getUser().then(setUser);
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    }) ?? { data: { subscription: null } };
    return () => subscription?.unsubscribe();
  }, []);

  // ─── LemonSqueezy post-payment redirect ───
  // LemonSqueezy redirects back to VITE_APP_URL/?lemon_success=1 after payment.
  // We detect this, refresh the user profile (webhook may take a few seconds),
  // and show the pricing modal as a thank-you confirmation.
  const { refreshProfile } = useUserTier ? {} : {}; // accessed via tier hook below
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('lemon_success')) return;

    // Clean URL immediately so refreshes don't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    // Poll Supabase profile up to 10 times (every 2s) until tier = supporter
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { getUserProfile } = await import('@/engine/SupabaseClient');
      const profile = await getUserProfile();
      if (profile?.tier === 'supporter' || attempts >= 10) {
        clearInterval(poll);
        // Notify the user
        if (profile?.tier === 'supporter') {
          alert('🎉 ¡Bienvenido a Supporter! Recarga la app para activar todos los beneficios.');
        } else {
          alert('El pago fue procesado. Si los beneficios no aparecen en 1 min, recarga la app.');
        }
        window.location.reload();
      }
    }, 2000);

    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const canSync = user && (tier === 'supporter' || tier === 'admin');
    if (canSync) {
      initSync(user);
      syncAll().catch(e => console.error('[App] Initial sync failed:', e));
    } else {
      initSync(null);
    }
  }, [user, tier]);

  // ─── Audio init ───
  const handleInitAudio = useCallback(async () => {
    await audio.initAudio();
    sessionStorage.setItem('audioInitialized', '1');
    setAudioInitialized(true);
  }, [audio]);

  useEffect(() => {
    if (!audioInitialized || audio.loaded || audio.loading) return;
    const resume = () => audio.initAudio();
    window.addEventListener('pointerdown', resume, { once: true });
    return () => window.removeEventListener('pointerdown', resume);
  }, [audioInitialized, audio.loaded, audio.loading]);

  // ─── MIDI → audio + scoring + recording ───
  useEffect(() => {
    if (!audioInitialized) return;
    midi.setNoteCallbacks({
      onNoteOn: (midiNote, velocity) => {
        audio.noteOn(midiNote, velocity);
        if (isRecording) recordingRef.current.recordNoteOn(midiNote, velocity);
        if (waitMode && song.scheduler) song.scheduler.userPlayedNote(midiNote);
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
        if (isRecording) recordingRef.current.recordNoteOff(midiNote);
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

  // ─── Microphone → scoring (no audio playback, no recording) ───
  // Note: mic visual feedback works even without audioInitialized
  useEffect(() => {
    mic.setNoteCallbacks({
      onNoteOn: (midiNote, velocity) => {
        // Update visual piano keys
        setMicActiveNotes(prev => {
          const next = new Map(prev);
          next.set(midiNote, velocity);
          return next;
        });
        if (!audioInitialized) return; // scoring requires audio context
        if (waitMode && song.scheduler) song.scheduler.userPlayedNote(midiNote);
        if (song.isPlaying || isWaiting) {
          const result = scoreEngineRef.current.scoreNote(midiNote, velocity);
          if (result) {
            setLastScore({ ...result, _ts: Date.now() });
            setScoreStats(scoreEngineRef.current.getStats());
          }
        }
      },
      onNoteOff: (midiNote) => {
        // Remove from visual piano keys
        setMicActiveNotes(prev => {
          const next = new Map(prev);
          next.delete(midiNote);
          return next;
        });
      },
    });
  }, [audioInitialized, mic, waitMode, song, isWaiting]);

  // ─── Mic activation toast + micMode + auto wait mode ───
  useEffect(() => {
    if (mic.isActive) {
      scoreEngineRef.current?.setMicMode(true);
      // Save current waitMode and enable it
      setWaitModeBeforeMic(waitMode);
      setPracticeSettings({ waitMode: true });
      // Simple alert toast — replace with your toast system if available
      const toast = document.createElement('div');
      toast.textContent = t('mic.hint');
      toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1e;color:#C9A96E;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:1px solid rgba(201,169,110,0.3);white-space:nowrap;';
      document.body.appendChild(toast);
      const timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
      }, 3000);
      return () => {
        clearTimeout(timer);
        toast.remove();
      };
    } else {
      scoreEngineRef.current?.setMicMode(false);
      // Restore previous waitMode
      setPracticeSettings({ waitMode: waitModeBeforeMic });
    }
  }, [mic.isActive, t]);

  // ─── Song → audio + scoring ───
  useEffect(() => {
    song.setNoteCallbacks({
      onNoteOn: (note) => {
        if (audioInitialized && audio.loaded) audio.noteOn(note.midi, note.velocity);
        if (note.inActiveHand !== false) scoreEngineRef.current.addExpectedNote(note);
      },
      onNoteOff: (note) => { if (audioInitialized && audio.loaded) audio.noteOff(note.midi); },
      onPedalEvent: (cc, isOn) => {
        if (!audioInitialized || !audio.loaded) return;
        if (cc === 64) { audio.setSustain(isOn); setPlaybackPedals(p => ({ ...p, sustain: isOn })); }
        else if (cc === 66) { audio.setSostenuto(isOn); setPlaybackPedals(p => ({ ...p, sostenuto: isOn })); }
        else if (cc === 67) { audio.setSoft(isOn); setPlaybackPedals(p => ({ ...p, soft: isOn })); }
      },
    });
  }, [audioInitialized, audio.loaded, song, audio]);

  // ─── Sync practice settings to scheduler ───
  useEffect(() => { if (song.scheduler) song.scheduler.setWaitMode(waitMode); }, [waitMode, song.scheduler]);
  useEffect(() => { if (song.scheduler) song.scheduler.setHandMode(handMode); }, [handMode, song.scheduler]);
  useEffect(() => { if (song.scheduler) song.scheduler.setLoop(loopEnabled, loopStart, loopEnd); }, [loopEnabled, loopStart, loopEnd, song.scheduler]);

  useEffect(() => {
    if (song.song) {
      metronome.setBpm(Math.round(song.song.bpm));
      setLoopEnd(song.song.totalDuration);
    }
  }, [song.song]);

  // ─── Release pedals when playback stops ───
  useEffect(() => {
    if (!song.isPlaying && audioInitialized) {
      audio.setSustain(false);
      audio.setSostenuto(false);
      audio.setSoft(false);
      setPlaybackPedals({ sustain: false, sostenuto: false, soft: false });
      const timer = setTimeout(() => audio.allNotesOff(), 2000);
      return () => clearTimeout(timer);
    }
  }, [song.isPlaying]);

  // ─── Session tracking ───
  useEffect(() => {
    if (song.isPlaying && !sessionStartTime) {
      setSessionStartTime(Date.now());
      scoreEngineRef.current.reset();
      setScoreStats(null);
      setLastScore(null);
    }
  }, [song.isPlaying]);

  useEffect(() => {
    if (!song.isPlaying && sessionStartTime && currentSongId) {
      const duration = (Date.now() - sessionStartTime) / 1000;
      if (duration > 5) {
        const stats = scoreEngineRef.current.getStats();
        const sessionData = {
          songId: currentSongId,
          songName: song.song?.name || 'Unknown',
          duration, score: stats.totalScore,
          notesHit: stats.notesHit, notesMissed: stats.notesMissed,
          accuracy: stats.accuracy, maxStreak: stats.maxStreak,
          speed: song.speed, handMode,
        };
        saveSession(sessionData).then(saved => {
          if (isSupporter) syncProgress([saved]).catch(e => console.error('Cloud sync failed:', e));
        });
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

  // ─── Resize ───
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
  }, [audioInitialized, location.pathname]);

  // ─── Mutual exclusion: song vs recording playback ───
  useEffect(() => {
    if (song.isPlaying && recordingRef.current.isPlaying) {
      recordingRef.current.stopPlayback();
      audio.allNotesOff();
      audio.setSustain(false); audio.setSostenuto(false); audio.setSoft(false);
      setPlaybackPedals({ sustain: false, sostenuto: false, soft: false });
      setRecPlayback({ active: false, paused: false, name: '', progress: 0, currentTime: 0, duration: 0 });
    }
  }, [song.isPlaying]);

  // ─── Animation loop ───
  useAnimationLoop((timestamp) => {
    const result = song.update(timestamp);
    setVisibleNotes(result.visibleNotes);
    setSongActiveNotes(result.activeNotes);
    setIsWaiting(result.isWaiting);
    scoreEngineRef.current.checkTimeouts(3000);

    // Ghost notes for mic mode: pending notes + upcoming notes near hit line
    if (mic.isActive && result.visibleNotes) {
      const ghost = new Set();
      const currentTime = song.currentTime || 0;
      // Pending notes from score engine
      scoreEngineRef.current.pendingNotes.forEach((data, midi) => {
        ghost.add(midi);
      });
      // Upcoming notes within 0.5s of hit line
      result.visibleNotes.forEach(note => {
        if (note.time - currentTime < 0.5) {
          ghost.add(note.midi);
        }
      });
      setMicGhostNotes(ghost);
    } else if (!mic.isActive && micGhostNotes.size > 0) {
      setMicGhostNotes(new Set());
    }

    const rec = recordingRef.current;
    if (rec.isPlaying) {
      const events = rec.updatePlayback();
      events.forEach(evt => {
        if (evt.type === 'noteOn') audio.noteOn(evt.midi, evt.velocity);
        else if (evt.type === 'noteOff') audio.noteOff(evt.midi);
        else if (evt.type === 'pedal') {
          if (evt.cc === 64) { audio.setSustain(evt.isOn); setPlaybackPedals(p => ({ ...p, sustain: evt.isOn })); }
          else if (evt.cc === 66) { audio.setSostenuto(evt.isOn); setPlaybackPedals(p => ({ ...p, sostenuto: evt.isOn })); }
          else if (evt.cc === 67) { audio.setSoft(evt.isOn); setPlaybackPedals(p => ({ ...p, soft: evt.isOn })); }
        }
      });
      setRecPlayback(prev => ({
        ...prev, active: rec.isPlaying, paused: rec.isPaused,
        progress: rec.progress, currentTime: rec.currentTime,
      }));
    }
    if (!rec.isPlaying) {
      setRecPlayback(prev => {
        if (!prev.active) return prev;
        audio.allNotesOff();
        audio.setSustain(false); audio.setSostenuto(false); audio.setSoft(false);
        setPlaybackPedals({ sustain: false, sostenuto: false, soft: false });
        return { active: false, paused: false, name: '', progress: 0, currentTime: 0, duration: 0 };
      });
    }
  }, audioInitialized);

  // ─── Song selection (from Library) ───
  const handleSelectSong = useCallback(async (songData) => {
    if (!songData.midiData) return;
    if (recordingRef.current.isPlaying) {
      recordingRef.current.stopPlayback();
      audio.allNotesOff();
      audio.setSustain(false); audio.setSostenuto(false); audio.setSoft(false);
      setPlaybackPedals({ sustain: false, sostenuto: false, soft: false });
      setRecPlayback({ active: false, paused: false, name: '', progress: 0, currentTime: 0, duration: 0 });
    }
    const blob = new Blob([songData.midiData]);
    const file = new File([blob], songData.name + '.mid');
    await song.loadFile(file, songData.name);
    setCurrentSongId(songData.id);
    navigate('/');
    updateSongMeta(songData.id, { lastPlayedAt: Date.now() });
  }, [song, audio, navigate]);

  // ─── Recording ───
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recordingRef.current.stopRecording();
      const data = recordingRef.current.getData();
      const stats = scoreEngineRef.current.getStats();
      setLastRecordingData({
        ...data,
        songName: song.song?.name || 'Free Play',
        songId: currentSongId,
        score: stats.totalScore || 0,
        accuracy: stats.accuracy || 0,
        notesHit: stats.notesHit || 0,
      });
      setIsRecording(false);
      setRecordingStartTime(null);
      setShowRecDone(true);
    } else {
      recordingRef.current.startRecording();
      setIsRecording(true);
      setRecordingStartTime(Date.now());
    }
  }, [isRecording, currentSongId, song.song]);

  const handleSaveRecording = useCallback(async (name) => {
    if (!lastRecordingData) return;
    await saveRecording({
      songId: lastRecordingData.songId,
      songName: name || lastRecordingData.songName,
      duration: lastRecordingData.duration,
      events: lastRecordingData.events,
      score: lastRecordingData.score,
    });
    setShowRecDone(false);
    setLastRecordingData(null);
  }, [lastRecordingData]);

  const handleExportRecording = useCallback(async () => {
    if (!lastRecordingData) return;
    try {
      const midiBuffer = await RecordingEngine.toMidiArrayBuffer(lastRecordingData);
      const blob = new Blob([midiBuffer], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (lastRecordingData.songName || 'recording') + '.mid';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export recording:', err);
    }
  }, [lastRecordingData]);

  const handlePlayRecording = useCallback((rec) => {
    if (song.isPlaying) song.stop();
    recordingRef.current.loadData(rec);
    recordingRef.current.startPlayback();
    setRecPlayback({
      active: true, paused: false,
      name: rec.songName || 'Recording',
      progress: 0, currentTime: 0,
      duration: rec.duration || 0,
    });
    navigate('/');
  }, [song, navigate]);

  const handleSaveRecordingToLibrary = useCallback(async (rec) => {
    try {
      const midiBuffer = await RecordingEngine.toMidiArrayBuffer(rec);
      const saved = await saveSong({
        name: rec.songName || 'My Recording',
        bpm: 120, totalDuration: rec.duration,
        noteCount: rec.events.filter(e => e.type === 'noteOn').length,
        trackCount: 1, midiData: midiBuffer, source: 'recording',
      });
      const blob = new Blob([midiBuffer]);
      const file = new File([blob], (rec.songName || 'recording') + '.mid');
      await song.loadFile(file, rec.songName || 'My Recording');
      setCurrentSongId(saved.id);
      navigate('/');
    } catch (err) {
      console.error('Failed to export recording:', err);
    }
  }, [song, navigate]);

  // Recording mini-player controls
  const handleRecPause = useCallback(() => {
    recordingRef.current.pausePlayback();
    setRecPlayback(prev => ({ ...prev, paused: true }));
  }, []);
  const handleRecResume = useCallback(() => {
    recordingRef.current.resumePlayback();
    setRecPlayback(prev => ({ ...prev, paused: false }));
  }, []);
  const handleRecStop = useCallback(() => {
    recordingRef.current.stopPlayback();
    audio.allNotesOff();
    audio.setSustain(false); audio.setSostenuto(false); audio.setSoft(false);
    setPlaybackPedals({ sustain: false, sostenuto: false, soft: false });
    setRecPlayback({ active: false, paused: false, name: '', progress: 0, currentTime: 0, duration: 0 });
  }, [audio]);

  // ─── Drag & drop ───
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
      const buffer = await file.arrayBuffer();
      const { Midi } = await import('@tonejs/midi');
      const midiData = new Midi(buffer);
      const saved = await saveSong({
        name: midiData.name || file.name.replace(/\.(mid|midi)$/i, ''),
        bpm: Math.round(midiData.header.tempos?.[0]?.bpm || 120),
        totalDuration: midiData.duration,
        noteCount: midiData.tracks.reduce((sum, t) => sum + t.notes.length, 0),
        trackCount: midiData.tracks.filter(t => t.notes.length > 0).length,
        midiData: buffer,
      });
      setCurrentSongId(saved.id);
      song.loadFile(file);
      navigate('/');
    }
  }, [song, navigate]);

  // ─── Keyboard shortcuts ───
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

  // ─── Onboarding complete ───
  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('pianoapp_onboarded', '1');
    setShowOnboarding(false);
  }, []);

  const recordingElapsed = isRecording && recordingStartTime
    ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;

  // ─── Audio init overlay ───
  if (!audioInitialized) {
    return (
      <div className="audio-init-overlay">
        <h2>PIANO<span>APP</span></h2>
        <p>{t('app.startHint')}</p>
        <button className="audio-init-btn" onClick={handleInitAudio}>
          {audio.loading ? t('app.loadingPiano') : t('app.startPlaying')}
        </button>
        <p style={{ fontSize: '11px', color: '#555558', marginTop: '8px' }}>
          {t('app.browserHint')}
        </p>
      </div>
    );
  }

  // Context passed to all child routes via useOutletContext()
  const outletContext = {
    // Audio & MIDI
    midi, audio, song, metronome,
    audioInitialized,
    // Player state
    pianoWidth, waterfallHeight,
    visibleNotes, songActiveNotes,
    playbackPedals, view3d,
    mainRef, waterfallRef,
    // Practice
    practiceOpen, setPracticeOpen,
    practiceSettings, setPracticeSettings,
    waitMode, isWaiting, handMode,
    loopEnabled, loopStart, loopEnd,
    scoreStats, lastScore,
    // Recording
    isRecording, toggleRecording, recordingElapsed,
    // Song management
    currentSongId, handleSelectSong,
    // Recording playback
    handlePlayRecording, handleSaveRecordingToLibrary,
    // User & settings
    user, language, notation,
    // Microphone
    micActive: mic.isActive,
    onMicToggle: mic.toggle,
    micActiveNotes,
    micClarity: mic.clarity,
    micCurrentNote: mic.currentNote,
    micHz: mic.currentHz,
    micGhostNotes,
  };

  return (
    <div className="app-shell" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <NavRail user={user} onOpenSettings={() => setShowSettings(true)} />

      <div className="app-content" ref={mainRef}>
        <Outlet context={outletContext} />
      </div>

      {/* ── Global modals ── */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        onUserChange={setUser}
        onOpenUpgrade={() => { setShowSettings(false); setShowPricing(true); }}
        audioPresetId={audio.currentPresetId}
        onAudioPresetChange={(id) => {
          audio.switchPreset(id);
        }}
      />

      <PricingModal
        open={showPricing}
        onClose={() => setShowPricing(false)}
        userId={user?.id}
      />

      <Onboarding
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      <RecordingDoneModal
        open={showRecDone}
        onClose={() => { setShowRecDone(false); setLastRecordingData(null); }}
        onSave={(name) => handleSaveRecording(name)}
        onExport={handleExportRecording}
        recordingData={lastRecordingData}
      />

      <RecordingMiniPlayer
        name={recPlayback.name}
        progress={recPlayback.progress}
        currentTime={recPlayback.currentTime}
        duration={recPlayback.duration}
        isPlaying={recPlayback.active}
        isPaused={recPlayback.paused}
        onPause={handleRecPause}
        onResume={handleRecResume}
        onStop={handleRecStop}
      />

      {isDragging && (
        <div className="drop-zone-active">
          <div className="drop-zone-content">
            <span>{t('app.dropHint')}</span>
            <small>{t('app.dropHintSub')}</small>
          </div>
        </div>
      )}
    </div>
  );
}
