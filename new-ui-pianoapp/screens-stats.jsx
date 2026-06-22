// Stats / Progress screen + Recordings tab

const { useState: useStS } = React;

function StatsScreen({ language, onOpenUpgrade }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [tab, setTab] = useStS('overview');

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <UI.SectionTitle
        eyebrow={t('Sigue tu evolución','Track your progress')}
        title={t('Progreso', 'Progress')}
        action={
          <UI.Tabs value={tab} onChange={setTab} tabs={[
            { id: 'overview', label: t('Resumen','Overview'), icon: <I.Chart size={14}/> },
            { id: 'recordings', label: t('Grabaciones','Recordings'), icon: <I.Mic size={14}/>, count: 3 },
          ]}/>
        }
      />

      {tab === 'overview' && <OverviewTab language={language}/>}
      {tab === 'recordings' && <RecordingsTab language={language}/>}
    </div>
  );
}

function OverviewTab({ language }) {
  const t = (es, en) => language === 'es' ? es : en;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPI icon={<I.Flame size={16}/>} eyebrow={t('Racha','Streak')} value="14" unit={t('días','days')} delta="+3"/>
        <KPI icon={<I.Clock size={16}/>} eyebrow={t('Esta semana','This week')} value="4h 32m" delta={t('+18% vs semana pasada','+18% vs last week')}/>
        <KPI icon={<I.Trophy size={16}/>} eyebrow={t('Score promedio','Avg score')} value="86" unit="/ 100" delta="+4"/>
        <KPI icon={<I.Note size={16}/>} eyebrow={t('Notas tocadas','Notes played')} value="12,840" delta={t('vida total','lifetime')}/>
      </div>

      {/* Heatmap + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('Últimos 90 días','Last 90 days')}</div>
              <div className="t-display" style={{ fontSize: 18 }}>{t('Actividad de práctica','Practice activity')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--ink-3)' }}>
              <span>{t('Menos','Less')}</span>
              <span className="hm-cell" style={{ width: 10, height: 10 }}/>
              <span className="hm-cell hm-1" style={{ width: 10, height: 10 }}/>
              <span className="hm-cell hm-2" style={{ width: 10, height: 10 }}/>
              <span className="hm-cell hm-3" style={{ width: 10, height: 10 }}/>
              <span className="hm-cell hm-4" style={{ width: 10, height: 10 }}/>
              <span>{t('Más','More')}</span>
            </div>
          </div>
          <div className="heatmap" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
            {MOCK.heatmap.map((v, i) => (
              <div key={i} className={`hm-cell hm-${v}`} title={`Día ${i+1}: ${v} sesiones`}/>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('Últimos 14 días','Last 14 days')}</div>
          <div className="t-display" style={{ fontSize: 18, marginBottom: 12 }}>{t('Score promedio','Average score')}</div>
          <ScoreChart data={MOCK.scoreHistory}/>
        </div>
      </div>

      {/* Top scores + Sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('Personal Best','Personal Best')}</div>
          <div className="t-display" style={{ fontSize: 18, marginBottom: 16 }}>{t('Top scores','Top scores')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { rank: 1, song: 'Preludio en Do mayor', artist: 'Bach', score: 98 },
              { rank: 2, song: 'Gymnopédie No.1', artist: 'Satie', score: 95 },
              { rank: 3, song: 'Nocturne en Mi♭ mayor', artist: 'Chopin', score: 92 },
              { rank: 4, song: 'Clair de Lune', artist: 'Debussy', score: 87 },
              { rank: 5, song: 'Rêverie', artist: 'Debussy', score: 84 },
            ].map(r => (
              <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 200, fontSize: 24, color: r.rank === 1 ? 'var(--gold)' : 'var(--ink-4)', minWidth: 24 }}>{r.rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.song}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.artist}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold-100)' }}>{r.score}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('Historial reciente','Recent history')}</div>
          <div className="t-display" style={{ fontSize: 18, marginBottom: 12 }}>{t('Sesiones','Sessions')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('Fecha','Date'), t('Canción','Song'), t('Duración','Duration'), 'Score', t('Precisión','Accuracy')].map((h,i) => (
                  <th key={i} className="t-eyebrow" style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, borderBottom: '1px solid var(--stroke-faint)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK.sessions.map((s, i) => (
                <tr key={i}>
                  <td style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{s.date}</td>
                  <td style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-1)' }}>{s.song}</td>
                  <td style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{s.duration}</td>
                  <td style={{ padding: '12px 0', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--gold-100)' }}>{s.score}</td>
                  <td style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{s.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, eyebrow, value, unit, delta }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold-100)', marginBottom: 10 }}>
        {icon}
        <span className="t-eyebrow" style={{ color: 'var(--ink-3)' }}>{eyebrow}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="t-display" style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em' }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{unit}</span>}
      </div>
      {delta && <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{delta}</div>}
    </div>
  );
}

function ScoreChart({ data }) {
  const w = 400, h = 140, pad = 8;
  const min = Math.min(...data) - 4;
  const max = Math.max(...data) + 4;
  const points = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / (max - min)) * (h - pad * 2),
  ]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaPath = `${path} L ${w-pad} ${h-pad} L ${pad} ${h-pad} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold)" stopOpacity="0.3"/>
          <stop offset="1" stopColor="var(--gold)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={pad} x2={w-pad} y1={pad + (i/3)*(h-pad*2)} y2={pad + (i/3)*(h-pad*2)} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4"/>
      ))}
      <path d={areaPath} fill="url(#chartGrad)"/>
      <path d={path} fill="none" stroke="var(--gold)" strokeWidth="1.5"/>
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 4 : 2} fill={i === points.length - 1 ? 'var(--gold-50)' : 'var(--gold)'} stroke="var(--gold-700)"/>
      ))}
    </svg>
  );
}

function RecordingsTab({ language }) {
  const t = (es, en) => language === 'es' ? es : en;
  if (MOCK.recordings.length === 0) {
    return <EmptyState
      icon={<I.Mic size={32}/>}
      title={t('Sin grabaciones todavía','No recordings yet')}
      desc={t('Graba tu primer performance pulsando el botón de grabación durante la práctica.','Record your first performance by pressing the record button during practice.')}
    />;
  }
  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {MOCK.recordings.map(r => (
        <div key={r.id} className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: '40px 1fr auto auto', alignItems: 'center', gap: 16 }}>
          <button className="play-btn" style={{ width: 40, height: 40 }}><I.Play size={14}/></button>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-1)', marginBottom: 2 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', gap: 12, fontFamily: 'var(--font-mono)' }}>
              <span>{r.date}</span>
              <span>{Math.floor(r.duration/60)}:{(r.duration%60).toString().padStart(2,'0')}</span>
              {r.song && <span style={{ color: 'var(--ink-2)' }}>{r.song}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {r.score && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--gold-100)' }}>{r.score}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{r.accuracy}% {t('precisión','accuracy')}</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-icon btn-ghost" title={t('Exportar MIDI','Export MIDI')}><I.Download size={14}/></button>
            <button className="btn btn-icon btn-ghost"><I.More size={14}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, desc, cta, illustration }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', display: 'grid', placeItems: 'center', marginBottom: 20, background: 'linear-gradient(180deg, rgba(201,169,110,0.06), transparent)', border: '1px solid var(--stroke-faint)', color: 'var(--gold-100)' }}>
        {icon}
      </div>
      <div className="t-display" style={{ fontSize: 20, marginBottom: 8, fontWeight: 300 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 360, lineHeight: 1.5, marginBottom: cta ? 20 : 0 }}>{desc}</div>
      {cta}
    </div>
  );
}

window.StatsScreen = StatsScreen;
window.EmptyState = EmptyState;
