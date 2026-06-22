// Player screen — waterfall + transport + piano + practice panel.

const { useState, useEffect, useRef, useMemo } = React;

function ScoreFloat({ items, onDone }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {items.map(s => (
        <div
          key={s.id}
          onAnimationEnd={() => onDone(s.id)}
          style={{
            position: 'absolute',
            left: s.x, top: s.y,
            transform: 'translate(-50%, 0)',
            animation: 'float-up 1100ms var(--ease-out) forwards',
            fontFamily: 'var(--font-display)',
            fontSize: s.tier === 'Perfect' ? 32 : 24,
            fontWeight: 300,
            letterSpacing: '-0.02em',
            color: s.tier === 'Perfect' ? 'var(--gold-50)' : s.tier === 'Great' ? 'var(--gold-100)' : s.tier === 'Good' ? 'var(--ink-2)' : '#D9B4B4',
            textShadow: s.tier === 'Perfect' ? '0 0 24px var(--gold)' : s.tier === 'Miss' ? 'none' : '0 0 12px rgba(201,169,110,0.4)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {s.tier} {s.tier === 'Perfect' && <span style={{ color: 'var(--gold)' }}>★</span>}
        </div>
      ))}
    </div>
  );
}

function Transport({ playing, onPlayPause, onStop, time, duration, speed, onSpeed, onRecord, recording, onSeek }) {
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };
  const pct = (time / duration) * 100;
  const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="transport glass">
      {/* Left: transport buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn btn-icon btn-ghost" title="Stop" onClick={onStop}><I.Stop size={14}/></button>
        <button
          className="play-btn"
          onClick={onPlayPause}
          aria-label={playing ? 'Pausa' : 'Play'}
        >
          {playing ? <I.Pause size={18} /> : <I.Play size={18} />}
        </button>
        <button
          className={`btn btn-icon btn-ghost ${recording ? 'recording-on' : ''}`}
          title="Grabar"
          onClick={onRecord}
          style={{ color: recording ? '#D9B4B4' : undefined }}
        >
          <I.Record size={12}/>
        </button>
      </div>

      {/* Center: time + scrubber */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span className="t-mono" style={{ fontSize: 12, color: 'var(--gold-100)', minWidth: 38, textAlign: 'right' }}>{fmt(time)}</span>
        <div className="scrubber" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek?.(((e.clientX - rect.left) / rect.width) * duration);
        }}>
          <div className="scrub-track" />
          {/* Loop A/B markers */}
          <div className="scrub-loop" style={{ left: '32%', width: '24%' }} />
          <div className="scrub-fill" style={{ width: `${pct}%` }} />
          <div className="scrub-thumb" style={{ left: `${pct}%` }} />
        </div>
        <span className="t-mono" style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 38 }}>{fmt(duration)}</span>
      </div>

      {/* Right: speed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="t-eyebrow">Vel.</span>
        <div className="speed-pills">
          {[0.5, 0.75, 1.0, 1.25, 1.5].map(s => (
            <button
              key={s}
              className={`speed-pill ${speed === s ? 'speed-active' : ''}`}
              onClick={() => onSpeed(s)}
            >{s}×</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusStrip({ midi, sustain, sostenuto, soft, recording, onOpen }) {
  return (
    <div className="status-strip">
      <button className={`status-chip ${midi ? 'status-ok' : 'status-warn'}`} onClick={onOpen}>
        <span className={`led ${midi ? 'led-ok' : 'led-off'}`} />
        <I.Midi size={14}/>
        <span>{midi ? 'MIDI · Yamaha P-125' : 'Sin MIDI'}</span>
      </button>
      <div className="pedal-stack">
        <span className={`pedal-dot ${sustain ? 'pedal-on' : ''}`} title="Sustain">Sus</span>
        <span className={`pedal-dot ${sostenuto ? 'pedal-on' : ''}`} title="Sostenuto">Sost</span>
        <span className={`pedal-dot ${soft ? 'pedal-on' : ''}`} title="Una corda">Soft</span>
      </div>
      {recording && (
        <div className="rec-badge">
          <span className="rec-pulse" />
          <span>REC</span>
          <span className="t-mono" style={{ marginLeft: 4 }}>00:42</span>
        </div>
      )}
    </div>
  );
}

function PracticePanel({ open, onClose, settings, setSettings, language }) {
  const t = (es, en) => language === 'es' ? es : en;
  return (
    <div className={`practice-panel ${open ? 'practice-open' : ''}`}>
      <div className="practice-header">
        <div>
          <div className="t-eyebrow">{t('Profesor', 'Coach')}</div>
          <div className="t-display" style={{ fontSize: 18, marginTop: 2 }}>{t('Práctica', 'Practice')}</div>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose}><I.Close size={14} /></button>
      </div>

      <div className="practice-section">
        <div className="practice-row">
          <div>
            <div className="t-label" style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{t('Modo Esperar', 'Wait Mode')}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{t('Pausa hasta que toques la nota correcta', 'Pauses until you play the right note')}</div>
          </div>
          <UI.Toggle checked={settings.waitMode} onChange={v => setSettings({ ...settings, waitMode: v })} />
        </div>
      </div>

      <div className="practice-section">
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('Manos', 'Hands')}</div>
        <div className="hand-toggle">
          {[
            { id: 'both', label: t('Ambas','Both') },
            { id: 'right', label: t('Derecha','Right') },
            { id: 'left', label: t('Izquierda','Left') },
          ].map(h => (
            <button
              key={h.id}
              className={`hand-btn ${settings.hands === h.id ? 'hand-active' : ''}`}
              onClick={() => setSettings({ ...settings, hands: h.id })}
            >
              <I.Hand size={14}/>
              <span>{h.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="practice-section">
        <div className="practice-row" style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ color: 'var(--ink-1)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <I.Loop size={14} /> {t('Loop A → B', 'Loop A → B')}
          </div>
          <UI.Toggle checked={settings.loop} onChange={v => setSettings({ ...settings, loop: v })} />
        </div>
        <div className="loop-controls">
          <button className="btn btn-sm">A: 1:24</button>
          <span className="t-mono" style={{ color: 'var(--ink-4)' }}>→</span>
          <button className="btn btn-sm">B: 1:48</button>
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>{t('Limpiar','Clear')}</button>
        </div>
      </div>

      <div className="practice-section">
        <div className="practice-row" style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ color: 'var(--ink-1)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <I.Metronome size={14}/> {t('Metrónomo', 'Metronome')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`metro-tick ${settings.metro ? 'metro-active' : ''}`} />
            <UI.Toggle checked={settings.metro} onChange={v => setSettings({ ...settings, metro: v })} />
          </div>
        </div>
        <UI.Slider value={settings.bpm} min={20} max={300} onChange={v => setSettings({ ...settings, bpm: v })} suffix=" BPM" label="" />
      </div>

      <div className="practice-section">
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('Compás de entrada', 'Count-in')}</div>
        <div className="hand-toggle">
          {[0, 1, 2, 4].map(c => (
            <button
              key={c}
              className={`hand-btn ${settings.countIn === c ? 'hand-active' : ''}`}
              onClick={() => setSettings({ ...settings, countIn: c })}
              style={{ flex: 1 }}
            >
              <span className="t-mono">{c === 0 ? t('No','Off') : `${c}`}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

window.PlayerParts = { ScoreFloat, Transport, StatusStrip, PracticePanel };
