// Settings + Pricing + Onboarding + Recording modal

const { useState: useStg } = React;

function SettingsScreen({ language, setLanguage, tier, onOpenUpgrade, prefs, setPrefs }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [section, setSection] = useStg('account');

  const sections = [
    { id: 'account', label: t('Cuenta','Account'), icon: <I.Users size={14}/> },
    { id: 'audio', label: 'Audio', icon: <I.Volume size={14}/> },
    { id: 'midi', label: 'MIDI', icon: <I.Midi size={14}/> },
    { id: 'display', label: t('Pantalla','Display'), icon: <I.Eye size={14}/> },
    { id: 'language', label: t('Idioma','Language'), icon: <I.Globe size={14}/> },
    { id: 'data', label: t('Datos','Data'), icon: <I.Folder size={14}/> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <UI.SectionTitle eyebrow={t('Personaliza tu app','Personalize your app')} title={t('Configuración','Settings')}/>

      <div className="settings-grid">
        <nav className="settings-nav">
          {sections.map(s => (
            <button key={s.id} className={`settings-navitem ${section === s.id ? 'settings-navitem-active' : ''}`} onClick={() => setSection(s.id)}>
              {s.icon}<span>{s.label}</span>
            </button>
          ))}
        </nav>

        <div>
          {section === 'account' && (
            <div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, padding: 20, background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--stroke-faint)' }}>
                <UI.Avatar initial="C" size={56} gold/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span className="t-display" style={{ fontSize: 20 }}>Camila Reyes</span>
                    {tier === 'pro' ? <UI.Pill tone="gold"><I.Crown size={10}/> Supporter</UI.Pill> : <UI.Pill>Free</UI.Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>camila.reyes@correo.com</div>
                </div>
                {tier === 'free' && <button className="btn btn-gold" onClick={onOpenUpgrade}><I.Crown size={14}/> Upgrade</button>}
              </div>

              <SettingRow name={t('Nombre','Name')} desc={t('Visible en la comunidad','Visible in community')}>
                <input className="input" defaultValue="Camila Reyes" style={{ width: 260 }}/>
              </SettingRow>
              <SettingRow name="Email" desc={t('Tu correo de cuenta','Your account email')}>
                <input className="input" defaultValue="camila.reyes@correo.com" style={{ width: 260 }}/>
              </SettingRow>
              <SettingRow name={t('Cambiar contraseña','Change password')}>
                <button className="btn">{t('Enviar enlace','Send link')}</button>
              </SettingRow>
              <SettingRow name={t('Cerrar sesión','Sign out')}>
                <button className="btn btn-ghost" style={{ color: '#D9B4B4' }}>{t('Cerrar sesión','Sign out')}</button>
              </SettingRow>
            </div>
          )}

          {section === 'audio' && (
            <div>
              <SettingRow name={t('Volumen master','Master volume')} desc={t('Volumen del piano virtual','Virtual piano volume')}>
                <div style={{ width: 220 }}><UI.Slider value={prefs.volume} min={0} max={100} suffix="%" onChange={v => setPrefs({ ...prefs, volume: v })}/></div>
              </SettingRow>
              <SettingRow name={t('Silenciar','Mute')}>
                <UI.Toggle checked={prefs.mute} onChange={v => setPrefs({ ...prefs, mute: v })}/>
              </SettingRow>
              <SettingRow name={t('Sonido / Instrumento','Sound / Instrument')} desc={t('Próximamente: múltiples pianos','Coming soon: multiple pianos')}>
                <select className="input" style={{ width: 220 }}>
                  <option>Steinway Concert Grand D</option>
                  <option>Yamaha C7</option>
                  <option>Fazioli F308</option>
                </select>
              </SettingRow>
            </div>
          )}

          {section === 'midi' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'rgba(143,180,138,0.05)', border: '1px solid rgba(143,180,138,0.18)', borderRadius: 'var(--r-md)', marginBottom: 24 }}>
                <span className="led led-ok"/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>Yamaha P-125 — Connected</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>USB · Channel 1 · 88 keys</div>
                </div>
                <button className="btn btn-sm">{t('Reconectar','Reconnect')}</button>
              </div>

              <SettingRow name={t('Dispositivo','Device')} desc={t('Selecciona tu teclado MIDI','Pick your MIDI keyboard')}>
                <select className="input" style={{ width: 220 }}>
                  <option>Yamaha P-125 (USB)</option>
                  <option>Roland FP-30X</option>
                  <option>Kawai ES110</option>
                </select>
              </SettingRow>
              <SettingRow name={t('Test de teclas','Key test')} desc={t('Toca una tecla en tu MIDI para ver la nota detectada','Press a key on your MIDI to see the detected note')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--r-md)', border: '1px solid var(--stroke-faint)' }}>
                  <span className="led led-ok"/>
                  <span className="t-mono" style={{ fontSize: 16, color: 'var(--gold-100)' }}>C4 · 60</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>vel: 84</span>
                </div>
              </SettingRow>
            </div>
          )}

          {section === 'display' && (
            <div>
              <SettingRow name={t('Tema','Theme')} desc={t('Modo claro próximamente','Light mode coming soon')}>
                <div className="speed-pills">
                  <button className="speed-pill speed-active"><I.Moon size={12}/> {t('Oscuro','Dark')}</button>
                  <button className="speed-pill" disabled style={{ opacity: 0.4 }}><I.Sun size={12}/> {t('Claro','Light')}</button>
                </div>
              </SettingRow>
              <SettingRow name={t('Nombres de notas','Show note names')} desc={t('Muestra C, D, E... en cada tecla','Show C, D, E... on each key')}>
                <UI.Toggle checked={prefs.showLabels} onChange={v => setPrefs({ ...prefs, showLabels: v })}/>
              </SettingRow>
              <SettingRow name={t('Guías de dedos','Finger guides')} desc={t('Números de dedos sobre las teclas','Finger numbers on keys')}>
                <UI.Toggle checked={prefs.fingerGuides} onChange={v => setPrefs({ ...prefs, fingerGuides: v })}/>
              </SettingRow>
              <SettingRow name={t('Densidad del waterfall','Waterfall density')} desc={t('Velocidad de caída de las notas','Speed of falling notes')}>
                <div style={{ width: 220 }}><UI.Slider value={prefs.density} min={50} max={200} step={10} suffix="%" onChange={v => setPrefs({ ...prefs, density: v })}/></div>
              </SettingRow>
            </div>
          )}

          {section === 'language' && (
            <div>
              <SettingRow name={t('Idioma de la interfaz','Interface language')}>
                <div className="speed-pills">
                  <button className={`speed-pill ${language === 'es' ? 'speed-active' : ''}`} onClick={() => setLanguage('es')}>🇪🇸 Español</button>
                  <button className={`speed-pill ${language === 'en' ? 'speed-active' : ''}`} onClick={() => setLanguage('en')}>🇬🇧 English</button>
                </div>
              </SettingRow>
              <SettingRow name={t('Notación de notas','Note naming')} desc={t('Do Re Mi vs C D E','Do Re Mi vs C D E')}>
                <div className="speed-pills">
                  <button className={`speed-pill ${prefs.notation === 'solfege' ? 'speed-active' : ''}`} onClick={() => setPrefs({ ...prefs, notation: 'solfege' })}>Do Re Mi</button>
                  <button className={`speed-pill ${prefs.notation === 'letters' ? 'speed-active' : ''}`} onClick={() => setPrefs({ ...prefs, notation: 'letters' })}>C D E</button>
                </div>
              </SettingRow>
            </div>
          )}

          {section === 'data' && (
            <div>
              <SettingRow name={t('Exportar datos','Export data')} desc={t('Backup local de tu librería y progreso','Local backup of library and progress')}>
                <button className="btn"><I.Download size={14}/> {t('Descargar','Download')}</button>
              </SettingRow>
              <SettingRow name={t('Importar datos','Import data')}>
                <button className="btn"><I.Upload size={14}/> {t('Seleccionar archivo','Select file')}</button>
              </SettingRow>
              <div style={{ marginTop: 32, padding: 20, border: '1px solid rgba(194,138,138,0.25)', borderRadius: 'var(--r-lg)', background: 'rgba(194,138,138,0.03)' }}>
                <UI.Pill tone="rose">{t('Zona peligrosa','Danger zone')}</UI.Pill>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--ink-1)', marginBottom: 4 }}>{t('Borrar todos los datos','Erase all data')}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('Esta acción es irreversible. Necesita confirmación doble.','This is irreversible. Requires double confirmation.')}</div>
                  </div>
                  <button className="btn" style={{ borderColor: 'rgba(194,138,138,0.4)', color: '#D9B4B4' }}><I.Trash size={14}/> {t('Borrar todo','Erase all')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ name, desc, children }) {
  return (
    <div className="setting-row">
      <div className="setting-row-info">
        <div className="setting-row-name">{name}</div>
        {desc && <div className="setting-row-desc">{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ============================================================
   PRICING modal
   ============================================================ */
function PricingModal({ open, onClose, language, onUpgrade }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [billing, setBilling] = useStg('annual');
  if (!open) return null;

  const features = [
    { f: t('Práctica local con MIDI','Local practice with MIDI'), free: true, pro: true },
    { f: t('Importar archivos MIDI','Import MIDI files'), free: true, pro: true },
    { f: t('Estadísticas y heatmap','Stats & heatmap'), free: true, pro: true },
    { f: t('Subidas a la comunidad','Community uploads'), free: '3 / mes', pro: t('Ilimitadas','Unlimited') },
    { f: t('Sincronización en la nube','Cloud sync'), free: false, pro: true },
    { f: t('Backup automático','Automatic backup'), free: false, pro: true },
    { f: t('Múltiples instrumentos (próx.)','Multiple instruments (soon)'), free: false, pro: true },
    { f: t('Badge exclusivo','Exclusive badge'), free: false, pro: true },
  ];

  return (
    <UI.Modal open onClose={onClose} width={780}>
      <div className="modal-head">
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>PianoApp Supporter</div>
          <h3 className="t-display" style={{ fontSize: 24, margin: 0 }}>{t('Apoya el desarrollo, recibe más','Support development, get more')}</h3>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose}><I.Close size={14}/></button>
      </div>

      <div className="modal-body">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div className="speed-pills">
            <button className={`speed-pill ${billing === 'monthly' ? 'speed-active' : ''}`} onClick={() => setBilling('monthly')}>{t('Mensual','Monthly')}</button>
            <button className={`speed-pill ${billing === 'annual' ? 'speed-active' : ''}`} onClick={() => setBilling('annual')}>{t('Anual','Annual')} <span style={{ marginLeft: 4, color: 'var(--gold)', fontSize: 9 }}>−25%</span></button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="tier-card">
            <UI.Pill>Free</UI.Pill>
            <div className="t-display" style={{ fontSize: 36, fontWeight: 200, marginTop: 16, marginBottom: 4 }}>$0</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 24 }}>{t('Para siempre','Forever')}</div>
            <button className="btn" style={{ width: '100%', marginBottom: 24 }} disabled>{t('Plan actual','Current plan')}</button>
            <FeatureList features={features} which="free"/>
          </div>

          <div className="tier-card tier-card-pro">
            <UI.Pill tone="gold"><I.Crown size={10}/> Supporter</UI.Pill>
            <div className="t-display" style={{ fontSize: 36, fontWeight: 200, marginTop: 16, marginBottom: 4 }}>
              ${billing === 'monthly' ? '6' : '54'}
              <span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 400 }}> / {billing === 'monthly' ? t('mes','mo') : t('año','yr')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gold-100)', marginBottom: 24 }}>{billing === 'annual' ? t('Equivale a $4.50/mes','Works out to $4.50/mo') : t('Cancela cuando quieras','Cancel anytime')}</div>
            <button className="btn btn-gold" style={{ width: '100%', marginBottom: 24 }} onClick={onUpgrade}>{t('Suscribirme','Subscribe')}</button>
            <FeatureList features={features} which="pro"/>
          </div>
        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: 'var(--ink-4)', textAlign: 'center' }}>
          {t('Pago seguro · IVA incluido · Factura por correo','Secure payment · Tax included · Invoice via email')}
        </div>
      </div>
    </UI.Modal>
  );
}

function FeatureList({ features, which }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {features.map((f, i) => {
        const v = f[which];
        const has = v === true || (typeof v === 'string');
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: has ? 'var(--ink-2)' : 'var(--ink-4)' }}>
            <span style={{ width: 14, color: has ? 'var(--gold)' : 'var(--ink-5)' }}>
              {has ? <I.Check size={12}/> : <I.Close size={10}/>}
            </span>
            <span style={{ flex: 1 }}>{f.f}</span>
            {typeof v === 'string' && <span className="t-mono" style={{ fontSize: 10, color: 'var(--gold-100)' }}>{v}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   ONBOARDING
   ============================================================ */
function Onboarding({ open, onComplete, language }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [step, setStep] = useStg(0);
  if (!open) return null;

  const steps = [
    {
      eyebrow: t('Bienvenido','Welcome'),
      title: t('Te damos la bienvenida a PianoApp','Welcome to PianoApp'),
      desc: t('Una herramienta de práctica para pianistas serios. Conecta tu teclado MIDI, importa partituras y mide tu progreso.','A practice tool for serious pianists. Connect MIDI, import scores, track progress.'),
      illo: <Illo type="welcome"/>,
    },
    {
      eyebrow: t('Paso 1 de 3','Step 1 of 3'),
      title: t('Conecta tu teclado MIDI','Connect your MIDI keyboard'),
      desc: t('Detectaremos tu instrumento automáticamente. Si no tienes uno, puedes practicar con el teclado virtual.','We auto-detect your instrument. No keyboard? Use the on-screen one.'),
      illo: <Illo type="midi"/>,
    },
    {
      eyebrow: t('Paso 2 de 3','Step 2 of 3'),
      title: t('Importa tu primera pieza','Import your first piece'),
      desc: t('Arrastra un archivo .mid, o explora la comunidad para empezar a tocar de inmediato.','Drop a .mid file, or browse community pieces to start playing right away.'),
      illo: <Illo type="library"/>,
    },
    {
      eyebrow: t('Listo','Ready'),
      title: t('A practicar','Time to play'),
      desc: t('El waterfall te muestra qué tocar; las teclas se iluminan cuando aciertas. ¡Disfruta!','The waterfall shows what to play; keys glow when you hit them. Enjoy.'),
      illo: <Illo type="play"/>,
    },
  ];

  const s = steps[step];
  return (
    <div className="onb-shell">
      <div className="glass-strong" style={{ width: 720, borderRadius: 'var(--r-xl)', padding: 0, overflow: 'hidden', position: 'relative' }}>
        <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }} onClick={onComplete}>{t('Saltar','Skip')}</button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 420 }}>
          <div style={{ padding: '48px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--gold-100)' }}>{s.eyebrow}</div>
            <h2 className="t-display" style={{ fontSize: 32, margin: 0, fontWeight: 300, lineHeight: 1.15, marginBottom: 16 }}>{s.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 32 }}>{s.desc}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><I.ArrowLeft size={14}/></button>}
              <button className="btn btn-gold btn-lg" onClick={() => step === steps.length - 1 ? onComplete() : setStep(step + 1)}>
                {step === steps.length - 1 ? t('Empezar a tocar','Start playing') : t('Continuar','Continue')}
                <I.ArrowRight size={14}/>
              </button>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {steps.map((_, i) => (
                  <span key={i} style={{
                    width: i === step ? 18 : 6, height: 4, borderRadius: 999,
                    background: i === step ? 'var(--gold)' : 'rgba(255,255,255,0.12)',
                    transition: 'all 200ms',
                  }}/>
                ))}
              </div>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #15110A, #0A0A0E)', position: 'relative', overflow: 'hidden' }}>
            {s.illo}
          </div>
        </div>
      </div>
    </div>
  );
}

function Illo({ type }) {
  if (type === 'welcome') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,110,0.25), transparent 70%)' }}/>
          <svg viewBox="0 0 200 200" width="200" height="200" style={{ position: 'absolute', inset: 0 }}>
            <circle cx="100" cy="100" r="60" fill="none" stroke="var(--gold)" strokeWidth="0.5"/>
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(201,169,110,0.3)" strokeWidth="0.5" strokeDasharray="2 4"/>
            <text x="100" y="115" textAnchor="middle" fontFamily="var(--font-display)" fontSize="56" fontWeight="200" fill="var(--gold)">P</text>
          </svg>
        </div>
      </div>
    );
  }
  if (type === 'midi') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <I.Midi size={80} stroke="var(--gold)" strokeWidth="0.8"/>
          <div style={{ display: 'flex', gap: 4 }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{ width: 8, height: i % 3 === 1 ? 28 : 40, background: i % 5 === 2 ? 'var(--gold)' : 'rgba(255,255,255,0.08)', borderRadius: 1 }}/>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (type === 'library') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 90px)', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ aspectRatio: '1', background: 'linear-gradient(135deg, #1F1A12, #0E0C08)', border: '1px solid rgba(201,169,110,0.18)', borderRadius: 8, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--gold)', fontWeight: 200 }}>{['C','D','S','B'][i-1]}</div>
          ))}
        </div>
      </div>
    );
  }
  if (type === 'play') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 60, height: 60, background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.06))' }}/>
        <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', boxShadow: '0 0 20px var(--gold)' }}/>
        {/* Falling notes */}
        {[
          { x: '20%', y: 40, w: 14, h: 60 },
          { x: '40%', y: 100, w: 14, h: 40 },
          { x: '55%', y: 20, w: 10, h: 80 },
          { x: '70%', y: 80, w: 14, h: 50 },
        ].map((n, i) => (
          <div key={i} style={{ position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h, background: 'linear-gradient(180deg, var(--gold-50), var(--gold))', borderRadius: 4, boxShadow: '0 0 12px var(--gold-glow)' }}/>
        ))}
        {/* Mini keyboard */}
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, height: 50, background: 'linear-gradient(180deg, #FAF7F1, #ECE6D9)', borderRadius: 4, display: 'flex' }}>
          {[...Array(14)].map((_, i) => <div key={i} style={{ flex: 1, borderRight: '1px solid rgba(0,0,0,0.1)' }}/>)}
        </div>
      </div>
    );
  }
  return null;
}

/* ============================================================
   RECORDING POST modal
   ============================================================ */
function RecordingDoneModal({ open, onClose, language, onSave }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [name, setName] = useStg('Sesión espontánea — abril 28');
  if (!open) return null;
  return (
    <UI.Modal open onClose={onClose} width={560}>
      <div className="modal-head">
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 4, color: '#D9B4B4' }}>● {t('Grabación finalizada','Recording finished')}</div>
          <h3 className="t-display" style={{ fontSize: 22, margin: 0 }}>{t('Tu performance','Your performance')}</h3>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose}><I.Close size={14}/></button>
      </div>
      <div className="modal-body">
        {/* Mini waterfall preview */}
        <div style={{ height: 80, borderRadius: 'var(--r-md)', background: 'linear-gradient(180deg, #07070A, #0F0F15)', position: 'relative', overflow: 'hidden', marginBottom: 20 }}>
          {[...Array(40)].map((_, i) => {
            const h = 8 + Math.random() * 50;
            return <div key={i} style={{ position: 'absolute', bottom: 8, left: `${i * 2.5}%`, width: 6, height: h, background: i % 4 === 0 ? 'var(--gold)' : 'rgba(201,169,110,0.4)', borderRadius: 2 }}/>;
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--gold)', boxShadow: '0 0 12px var(--gold)' }}/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          <Stat icon={<I.Clock size={14}/>} label={t('Duración','Duration')} value="3:04" mono/>
          <Stat icon={<I.Note size={14}/>} label={t('Notas','Notes')} value="284" mono/>
          <Stat icon={<I.Trophy size={14}/>} label="Score" value="92" mono/>
          <Stat icon={<I.Check size={14}/>} label={t('Precisión','Accuracy')} value="96%" mono/>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('Nombre de la grabación','Recording name')}</div>
          <input className="input" value={name} onChange={e => setName(e.target.value)}/>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-gold" style={{ flex: 1 }} onClick={onSave}><I.Check size={14}/> {t('Guardar','Save')}</button>
          <button className="btn"><I.Download size={14}/> {t('Exportar MIDI','Export MIDI')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('Descartar','Discard')}</button>
        </div>
      </div>
    </UI.Modal>
  );
}

window.SettingsScreen = SettingsScreen;
window.PricingModal = PricingModal;
window.Onboarding = Onboarding;
window.RecordingDoneModal = RecordingDoneModal;
