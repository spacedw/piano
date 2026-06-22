import React, { lazy, Suspense, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import Piano from '@/components/Piano';
import Waterfall from '@/components/Waterfall';
import TopBar from '@/components/Player/TopBar';
import Transport from '@/components/Player/Transport';
import PracticePanel from '@/components/Player/PracticePanel';
import ScoreFloat from '@/components/Player/ScoreFloat';
import FreePractice from '@/components/FreePractice';
import * as I from '@/components/Icons';

const Piano3D = lazy(() => import('@/components/Piano3D'));

// Hook: fuerza landscape en móvil mientras PlayerPage está montado
function useForceLandscape() {
  useEffect(() => {
    const lock = async () => {
      try {
        // Screen Orientation API (Chrome/Android)
        if (screen?.orientation?.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (_) {
        // iOS Safari no soporta lock() — usamos CSS rotate como fallback
      }
    };
    lock();
    return () => {
      try { screen?.orientation?.unlock?.(); } catch (_) {}
    };
  }, []);
}

export default function PlayerPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  useForceLandscape();
  const {
    midi, song, metronome, audio,
    pianoWidth, waterfallHeight,
    visibleNotes, songActiveNotes,
    playbackPedals, view3d,
    waterfallRef,
    practiceOpen, setPracticeOpen,
    practiceSettings, setPracticeSettings,
    waitMode, isWaiting, handMode,
    loopEnabled, loopStart, loopEnd,
    lastScore,
    isRecording, toggleRecording, recordingElapsed,
    language, notation,
    micActive, onMicToggle, micActiveNotes,
    micClarity, micCurrentNote, micHz,
    micGhostNotes,
  } = ctx;

  // Merge MIDI + mic active notes for piano visualization
  const combinedActiveNotes = React.useMemo(() => {
    if (!micActiveNotes || micActiveNotes.size === 0) return midi.activeNotes;
    const merged = new Map(midi.activeNotes);
    micActiveNotes.forEach((velocity, midi) => merged.set(midi, velocity));
    return merged;
  }, [midi.activeNotes, micActiveNotes]);

  return (
    <div className="player-rotate-wrapper">
      {/* Overlay portrait — oculto en landscape, visible en portrait vía CSS */}
      <div className="player-rotate-overlay">
        <div className="player-rotate-icon">📱</div>
        <div className="player-rotate-text">Gira tu dispositivo</div>
        <div className="player-rotate-sub">El piano necesita modo horizontal</div>
      </div>

      <TopBar
        song={song.song ? {
          name: song.song.name, artist: song.song.artist,
          bpm: song.song.bpm, difficulty: song.song.difficulty,
        } : null}
        midiConnected={midi.enabled && midi.inputs.length > 0}
        midiDeviceName={midi.selectedInput?.name}
        sustain={midi.sustainPedal || playbackPedals.sustain}
        sostenuto={midi.sostenutoPedal || playbackPedals.sostenuto}
        soft={midi.softPedal || playbackPedals.soft}
        recording={isRecording}
        recordingTime={recordingElapsed}
        practiceOpen={practiceOpen}
        onPracticeToggle={() => setPracticeOpen(p => !p)}
        micActive={micActive}
        onMicToggle={onMicToggle}
        micClarity={micClarity}
        audioLoaded={audio?.loaded ?? true}
      />

      <div className="player-main">
        <div className="waterfall-area" ref={waterfallRef}>
          {song.song ? (
            <>
              {view3d ? (
                <Suspense fallback={<div className="loading-3d">Loading 3D...</div>}>
                  <Piano3D
                    activeNotes={combinedActiveNotes}
                    songActiveNotes={songActiveNotes}
                    visibleNotes={visibleNotes}
                    currentTime={song.currentTime}
                    width={pianoWidth}
                    fullHeight
                  />
                </Suspense>
              ) : (
                <Waterfall
                  visibleNotes={visibleNotes}
                  songActiveNotes={songActiveNotes}
                  currentTime={song.currentTime}
                  width={pianoWidth}
                  height={waterfallHeight}
                  activeNotes={combinedActiveNotes}
                  loopEnabled={loopEnabled}
                  loopStart={loopStart}
                  loopEnd={loopEnd}
                  isWaiting={isWaiting}
                  handMode={handMode}
                  language={language}
                />
              )}
              <ScoreFloat lastScore={lastScore} />

              <div className="player-side-info">
                <div className="chip chip-gold">
                  <I.Note size={11} />
                  {language === 'es'
                    ? `Compás ${Math.floor(song.currentTime / (60 / (song.song?.bpm || 120) * 4)) + 1}`
                    : `Bar ${Math.floor(song.currentTime / (60 / (song.song?.bpm || 120) * 4)) + 1}`
                  }
                </div>
                <div className="chip">
                  <span className="t-mono" style={{ fontSize: 10 }}>♩ = {Math.round(song.song?.bpm || 120)}</span>
                </div>
                {waitMode && (
                  <div className="chip chip-gold">
                    {language === 'es' ? 'Modo Esperar' : 'Wait Mode'}
                  </div>
                )}
                {loopEnabled && (
                  <div className="chip chip-gold">
                    <I.Loop size={11} /> A → B
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state-player">
              <div className="empty-icon-circle">
                <I.Piano size={40} />
              </div>
              <h3>{language === 'es' ? 'Elige una pieza para empezar' : 'Choose a piece to begin'}</h3>
              <p>{language === 'es'
                ? 'Importa un archivo MIDI o explora la comunidad'
                : 'Import a MIDI file or browse the community'
              }</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-gold" onClick={() => navigate('/library')}>
                  <I.Library size={14} />
                  <span>{language === 'es' ? 'Abrir librería' : 'Open library'}</span>
                </button>
              </div>
              {micActive && (
                <FreePractice
                  currentNote={micCurrentNote}
                  currentHz={micHz}
                  clarity={micClarity}
                  language={language}
                />
              )}
            </div>
          )}
        </div>

        {song.song && (
          <PracticePanel
            open={practiceOpen}
            onClose={() => setPracticeOpen(false)}
            settings={practiceSettings}
            setSettings={setPracticeSettings}
            language={language}
            isWaiting={isWaiting}
            metronomeCurrentBeat={metronome.currentBeat}
            metronomeBeatsPerMeasure={metronome.beatsPerMeasure}
          />
        )}
      </div>

      <Transport
        isPlaying={song.isPlaying}
        onTogglePlay={song.togglePlay}
        onStop={song.stop}
        onRecord={toggleRecording}
        recording={isRecording}
        currentTime={song.currentTime}
        duration={song.song?.totalDuration || 0}
        progress={song.progress}
        speed={song.speed}
        onSpeedChange={song.setSpeed}
        onSeek={song.seek}
        loopEnabled={loopEnabled}
        loopStart={loopStart}
        loopEnd={loopEnd}
        disabled={!song.song}
      />

      {!view3d && (
        <Piano
          activeNotes={combinedActiveNotes}
          songActiveNotes={songActiveNotes}
          ghostNotes={micActive ? micGhostNotes : undefined}
          width={pianoWidth}
          height={160}
          language={language}
          notation={notation}
        />
      )}
    </div>
  );
}
