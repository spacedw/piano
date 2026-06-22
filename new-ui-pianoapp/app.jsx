// Main App — orchestrates all screens, state, navigation.

const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 60,
  "waterfallDensity": 100,
  "showLabels": false,
  "fingerGuides": false,
  "language": "es",
  "compactMode": false,
  "skipOnboarding": false
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const language = tweaks.language;

  // Navigation
  const [route, setRoute] = uS('player'); // player | library | stats | settings
  const [showSettings, setShowSettings] = uS(false);
  const [showPricing, setShowPricing] = uS(false);
  const [showOnboarding, setShowOnboarding] = uS(!tweaks.skipOnboarding);
  const [showRecDone, setShowRecDone] = uS(false);

  // Player state
  const [playing, setPlaying] = uS(false);
  const [time, setTime] = uS(0);
  const [duration] = uS(274);
  const [speed, setSpeed] = uS(1.0);
  const [recording, setRecording] = uS(false);
  const [practiceOpen, setPracticeOpen] = uS(true);
  const [currentSong, setCurrentSong] = uS(MOCK.songs[0]);
  const [showMiniRec, setShowMiniRec] = uS(false);

  // Audio/practice
  const [practiceSettings, setPracticeSettings] = uS({
    waitMode: false,
    hands: 'both',
    loop: false,
    metro: true,
    bpm: 88,
    countIn: 1,
  });

  // Score floats + sparks
  const [floats, setFloats] = uS([]);
  const [sparks, setSparks] = uS([]);

  // Active piano notes (currently being played in waterfall)
  const allNotes = uM(() => MOCK.generateDemoNotes(), []);
  const activeNotes = uM(() => {
    const set = new Set();
    allNotes.forEach(n => {
      if (time >= n.start && time <= n.start + n.duration) set.add(n.midi);
    });
    return set;
  }, [time, allNotes]);

  // Ghost notes hint (notes about to be played)
  const ghostNotes = uM(() => {
    const set = new Set();
    allNotes.forEach(n => {
      if (n.start > time && n.start < time + 0.6) set.add(n.midi);
    });
    return set;
  }, [time, allNotes]);

  // Playback loop
  uE(() => {
    if (!playing) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime(t => {
        const next = t + dt * speed;
        if (next > duration) { setPlaying(false); return 0; }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  // Score floats: when notes start, randomly emit a tier
  const lastTriggerRef = uR(new Set());
  uE(() => {
    allNotes.forEach((n, i) => {
      const key = `${i}-${Math.floor(n.start * 100)}`;
      if (time >= n.start && time < n.start + 0.05 && !lastTriggerRef.current.has(key)) {
        lastTriggerRef.current.add(key);
        // emit float roughly at note's x position
        const tiers = ['Perfect ★', 'Great', 'Good', 'Perfect ★', 'Great'];
        const tier = tiers[Math.floor(Math.random() * tiers.length)].split(' ')[0];
        const x = `${20 + (n.midi - 21) / 87 * 60}%`;
        const y = '60%';
        setFloats(f => [...f, { id: Math.random(), tier, x, y }]);
        // Spark cluster
        setSparks(s => [...s, { id: Math.random(), x: `${20 + (n.midi - 21) / 87 * 60}%`, y: '92%' }]);
      }
    });
  }, [time, allNotes]);

  uE(() => {
    if (!showOnboarding) return;
    // also auto-detect MIDI message
  }, [showOnboarding]);

  const handlePlaySong = (song) => {
    setCurrentSong(song);
    setRoute('player');
    setTime(0);
    setPlaying(true);
  };

  const handleRecord = () => {
    if (!recording) {
      setRecording(true);
    } else {
      setRecording(false);
      setShowRecDone(true);
    }
  };

  // Apply tweaks: accent hue
  uE(() => {
    const root = document.documentElement;
    const h = tweaks.accentHue;
    // gold default hue ≈ 60 (a bit greenish-gold). Allow 30-220.
    root.style.setProperty('--gold', `oklch(0.74 0.10 ${h})`);
    root.style.setProperty('--gold-50', `oklch(0.92 0.07 ${h})`);
    root.style.setProperty('--gold-100', `oklch(0.85 0.09 ${h})`);
    root.style.setProperty('--gold-200', `oklch(0.80 0.10 ${h})`);
    root.style.setProperty('--gold-600', `oklch(0.65 0.10 ${h})`);
    root.style.setProperty('--gold-700', `oklch(0.55 0.09 ${h})`);
    root.style.setProperty('--gold-800', `oklch(0.42 0.08 ${h})`);
    root.style.setProperty('--gold-glow', `oklch(0.74 0.10 ${h} / 0.35)`);
  }, [tweaks.accentHue]);

  return (
    <div className="app-shell" data-screen-label={`PianoApp / ${route}`}>
      {/* Nav rail */}
      <nav className="nav-rail">
        <div className="nav-logo">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--gold-50)"/>
                <stop offset="1" stopColor="var(--gold-700)"/>
              </linearGradient>
            </defs>
            <text x="14" y="20" textAnchor="middle" fontFamily="var(--font-display)" fontSize="20" fontWeight="200" fill="url(#logoGrad)" letterSpacing="-0.04em">P</text>
            <circle cx="14" cy="14" r="12" fill="none" stroke="var(--gold-700)" strokeWidth="0.5" opacity="0.6"/>
          </svg>
        </div>

        {[
          { id: 'player', label: language === 'es' ? 'Tocar' : 'Play', icon: <I.Piano size={18}/> },
          { id: 'library', label: language === 'es' ? 'Librería' : 'Library', icon: <I.Library size={18}/> },
          { id: 'stats', label: language === 'es' ? 'Progreso' : 'Progress', icon: <I.Chart size={18}/> },
        ].map(item => (
          <button
            key={item.id}
            className={`nav-item ${route === item.id ? 'nav-item-active' : ''}`}
            onClick={() => setRoute(item.id)}
          >
            {item.icon}
            <span className="nav-tooltip">{item.label}</span>
          </button>
        ))}

        <div className="nav-spacer"/>

        <button className="nav-item" onClick={() => setShowSettings(true)}>
          <I.Settings size={18}/>
          <span className="nav-tooltip">{language === 'es' ? 'Ajustes' : 'Settings'}</span>
        </button>
        <div style={{ height: 8 }}/>
        <button className="nav-account" title="Camila">C</button>
      </nav>

      {/* Main panel */}
      {route === 'player' && (
        <PlayerView
          tweaks={tweaks}
          setTweak={setTweak}
          playing={playing} setPlaying={setPlaying}
          time={time} setTime={setTime} duration={duration}
          speed={speed} setSpeed={setSpeed}
          recording={recording} onRecord={handleRecord}
          practiceOpen={practiceOpen} setPracticeOpen={setPracticeOpen}
          practiceSettings={practiceSettings} setPracticeSettings={setPracticeSettings}
          allNotes={allNotes} activeNotes={activeNotes} ghostNotes={ghostNotes}
          floats={floats} setFloats={setFloats}
          sparks={sparks} setSparks={setSparks}
          currentSong={currentSong} setCurrentSong={setCurrentSong}
          language={language}
        />
      )}
      {route === 'library' && (
        <LibraryScreen onPlay={handlePlaySong} language={language}/>
      )}
      {route === 'stats' && (
        <StatsScreen language={language} onOpenUpgrade={() => setShowPricing(true)}/>
      )}

      {/* Settings overlay */}
      {showSettings && (
        <div className="scrim" onClick={() => setShowSettings(false)}>
          <div className="modal-shell glass-strong fade-up" style={{ maxWidth: 880, padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowSettings(false)}><I.Close size={14}/></button>
            </div>
            <div style={{ height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
              <SettingsScreen
                language={language}
                setLanguage={(l) => setTweak('language', l)}
                tier={tweaks.tier || 'free'}
                onOpenUpgrade={() => { setShowSettings(false); setShowPricing(true); }}
                prefs={{
                  volume: 80, mute: false,
                  showLabels: tweaks.showLabels,
                  fingerGuides: tweaks.fingerGuides,
                  density: tweaks.waterfallDensity,
                  notation: 'solfege',
                }}
                setPrefs={(p) => {
                  setTweak({ showLabels: p.showLabels, fingerGuides: p.fingerGuides, waterfallDensity: p.density });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pricing modal */}
      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} language={language} onUpgrade={() => setShowPricing(false)}/>

      {/* Onboarding */}
      <Onboarding open={showOnboarding} onComplete={() => setShowOnboarding(false)} language={language}/>

      {/* Recording done */}
      <RecordingDoneModal open={showRecDone} onClose={() => setShowRecDone(false)} language={language} onSave={() => setShowRecDone(false)}/>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection title={language === 'es' ? 'Apariencia' : 'Appearance'}>
          <TweakSlider label={language === 'es' ? 'Tono del acento' : 'Accent hue'} min={20} max={300} step={5} value={tweaks.accentHue} onChange={v => setTweak('accentHue', v)} suffix="°"/>
          <TweakToggle label={language === 'es' ? 'Modo compacto' : 'Compact mode'} value={tweaks.compactMode} onChange={v => setTweak('compactMode', v)}/>
        </TweakSection>
        <TweakSection title="Waterfall">
          <TweakSlider label={language === 'es' ? 'Densidad' : 'Density'} min={50} max={200} step={10} value={tweaks.waterfallDensity} onChange={v => setTweak('waterfallDensity', v)} suffix="%"/>
          <TweakToggle label={language === 'es' ? 'Nombres en teclas' : 'Key labels'} value={tweaks.showLabels} onChange={v => setTweak('showLabels', v)}/>
          <TweakToggle label={language === 'es' ? 'Guías de dedos' : 'Finger guides'} value={tweaks.fingerGuides} onChange={v => setTweak('fingerGuides', v)}/>
        </TweakSection>
        <TweakSection title={language === 'es' ? 'Idioma' : 'Language'}>
          <TweakRadio
            value={tweaks.language}
            onChange={v => setTweak('language', v)}
            options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]}
          />
        </TweakSection>
        <TweakSection title={language === 'es' ? 'Atajos demo' : 'Demo shortcuts'}>
          <TweakButton onClick={() => setShowOnboarding(true)}>{language === 'es' ? 'Mostrar onboarding' : 'Show onboarding'}</TweakButton>
          <TweakButton onClick={() => setShowPricing(true)}>{language === 'es' ? 'Mostrar pricing' : 'Show pricing'}</TweakButton>
          <TweakButton onClick={() => setShowRecDone(true)}>{language === 'es' ? 'Modal post-grabación' : 'Recording done modal'}</TweakButton>
          <TweakButton onClick={() => { setCurrentSong(null); setPlaying(false); setTime(0); }}>{language === 'es' ? 'Empty state (sin canción)' : 'Empty state (no song)'}</TweakButton>
          <TweakButton onClick={() => setCurrentSong(MOCK.songs[0])}>{language === 'es' ? 'Cargar canción demo' : 'Load demo song'}</TweakButton>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

/* ============================================================
   PLAYER VIEW
   ============================================================ */
function PlayerView({
  tweaks, setTweak,
  playing, setPlaying, time, setTime, duration, speed, setSpeed,
  recording, onRecord,
  practiceOpen, setPracticeOpen, practiceSettings, setPracticeSettings,
  allNotes, activeNotes, ghostNotes,
  floats, setFloats, sparks, setSparks,
  currentSong, setCurrentSong, language,
}) {
  const t = (es, en) => language === 'es' ? es : en;
  return (
    <div className="player-main">
      {/* Top bar */}
      <div className="player-topbar">
        {currentSong ? (
          <>
            <div className="now-playing">
              <div className="now-playing-cover">{currentSong.title[0]}</div>
              <div className="now-playing-info">
                <div className="now-playing-title">{currentSong.title}</div>
                <div className="now-playing-artist">{currentSong.artist} · <UI.Difficulty value={currentSong.difficulty}/></div>
              </div>
            </div>
            <div className="status-strip">
              <button className="status-chip status-ok">
                <span className="led led-ok"/>
                <I.Midi size={14}/>
                <span>Yamaha P-125</span>
              </button>
              <div className="pedal-stack">
                <span className="pedal-dot pedal-on">Sus</span>
                <span className="pedal-dot">Sost</span>
                <span className="pedal-dot">Soft</span>
              </div>
              {recording && (
                <div className="rec-badge">
                  <span className="rec-pulse"/>
                  <span>REC</span>
                  <span className="t-mono" style={{ marginLeft: 4 }}>00:42</span>
                </div>
              )}
              <button className="btn btn-icon btn-ghost" onClick={() => setPracticeOpen(!practiceOpen)} title={t('Panel de práctica','Practice panel')}>
                <I.Wait size={16}/>
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="t-eyebrow">{t('Sin canción cargada','No song loaded')}</div>
          </div>
        )}
      </div>

      {/* Waterfall area */}
      <div className="waterfall-area">
        {currentSong ? (
          <>
            <Waterfall
              playing={playing}
              time={time}
              notes={allNotes}
              language={language}
              density={tweaks.waterfallDensity / 100}
              sparks={sparks}
              onSparkDone={(id) => setSparks(s => s.filter(x => x.id !== id))}
            />
            <div className="waterfall-overlays">
              <PlayerParts.ScoreFloat items={floats} onDone={(id) => setFloats(f => f.filter(x => x.id !== id))}/>
            </div>

            {/* Side info */}
            <div className="player-side-info">
              <div className="chip chip-gold"><I.Note size={11}/> {t('Compás 14 / 32','Bar 14 / 32')}</div>
              <div className="chip"><span className="t-mono" style={{ fontSize: 10 }}>♩ = {practiceSettings.bpm}</span></div>
              {practiceSettings.waitMode && <div className="chip chip-gold"><I.Wait size={11}/> {t('Modo Esperar','Wait Mode')}</div>}
              {practiceSettings.loop && <div className="chip chip-gold"><I.Loop size={11}/> A → B</div>}
            </div>
          </>
        ) : (
          <EmptyPlayerState language={language} onChoose={() => {/* would open library */}}/>
        )}
      </div>

      {/* Transport */}
      {currentSong ? (
        <PlayerParts.Transport
          playing={playing}
          onPlayPause={() => setPlaying(!playing)}
          onStop={() => { setPlaying(false); setTime(0); }}
          time={time}
          duration={duration}
          speed={speed}
          onSpeed={setSpeed}
          recording={recording}
          onRecord={onRecord}
          onSeek={setTime}
        />
      ) : (
        <div className="transport glass" style={{ opacity: 0.5 }}>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--ink-4)' }}>{t('Carga una pieza para comenzar','Load a piece to start')}</div>
        </div>
      )}

      {/* Piano */}
      <Piano
        activeNotes={activeNotes}
        ghostNotes={ghostNotes}
        showLabels={tweaks.showLabels}
        language={language}
        height={160}
        fingerGuides={tweaks.fingerGuides}
        fingerings={tweaks.fingerGuides ? { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 } : {}}
      />

      {/* Practice panel */}
      <PlayerParts.PracticePanel
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
        settings={practiceSettings}
        setSettings={setPracticeSettings}
        language={language}
      />
    </div>
  );
}

/* Empty state for player (no song loaded) */
function EmptyPlayerState({ language, onChoose }) {
  const t = (es, en) => language === 'es' ? es : en;
  return (
    <div className="empty-state">
      <div className="empty-content">
        <div style={{ width: 96, height: 96, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 24px', background: 'radial-gradient(circle, rgba(201,169,110,0.14), transparent 70%)', border: '1px solid rgba(201,169,110,0.18)', color: 'var(--gold-100)' }}>
          <I.Piano size={36}/>
        </div>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('Pantalla principal','Main player')}</div>
        <h2 className="t-display" style={{ fontSize: 28, margin: '0 0 12px', fontWeight: 300 }}>
          {t('Elige una pieza para empezar','Choose a piece to begin')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
          {t('Importa un archivo .mid de tu librería o explora la comunidad. Tu teclado MIDI ya está conectado.','Import a .mid from your library or browse community pieces. Your MIDI is already connected.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-gold"><I.Library size={14}/> {t('Abrir librería','Open library')}</button>
          <button className="btn"><I.Users size={14}/> {t('Explorar comunidad','Browse community')}</button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App/>, document.getElementById('root'));
