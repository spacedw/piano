// Library, Community, Stats, Settings, Recording, Pricing, Onboarding screens
const { useState: useS, useEffect: useE, useMemo: useM, useRef: useR } = React;

/* ============================================================
   LIBRARY
   ============================================================ */
function LibraryScreen({ onPlay, language }) {
  const [tab, setTab] = useS('mine');
  const [view, setView] = useS('grid');
  const [q, setQ] = useS('');
  const [sort, setSort] = useS('recent');
  const [filterDiff, setFilterDiff] = useS(0);
  const [favOnly, setFavOnly] = useS(false);
  const t = (es, en) => language === 'es' ? es : en;

  const filtered = useM(() => {
    let list = MOCK.songs.filter(s =>
      (q === '' || s.title.toLowerCase().includes(q.toLowerCase()) || s.artist.toLowerCase().includes(q.toLowerCase()))
      && (filterDiff === 0 || s.difficulty === filterDiff)
      && (!favOnly || s.favorite)
    );
    if (sort === 'name') list.sort((a,b) => a.title.localeCompare(b.title));
    if (sort === 'score') list.sort((a,b) => b.lastScore - a.lastScore);
    if (sort === 'difficulty') list.sort((a,b) => b.difficulty - a.difficulty);
    return list;
  }, [q, sort, filterDiff, favOnly]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <UI.SectionTitle
        eyebrow={t('Repertorio · 24 piezas', 'Repertoire · 24 pieces')}
        title={t('Tu librería', 'Your library')}
        action={<button className="btn btn-gold"><I.Upload size={14}/> {t('Importar MIDI', 'Import MIDI')}</button>}
      />

      <UI.Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mine', label: t('Mi librería', 'My library'), icon: <I.Folder size={14}/>, count: 24 },
          { id: 'community', label: t('Comunidad', 'Community'), icon: <I.Users size={14}/> },
        ]}
      />

      {tab === 'mine' && (
        <div style={{ marginTop: 24 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 360 }}>
              <I.Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }}/>
              <input
                className="input"
                placeholder={t('Buscar por título o compositor', 'Search by title or composer')}
                value={q} onChange={e => setQ(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <div className="speed-pills">
              {[
                { id: 0, label: t('Todos','All') },
                ...[1,2,3,4,5].map(d => ({ id: d, label: '★'.repeat(d) }))
              ].map(f => (
                <button key={f.id} className={`speed-pill ${filterDiff === f.id ? 'speed-active' : ''}`} onClick={() => setFilterDiff(f.id)}>{f.label}</button>
              ))}
            </div>
            <button className={`btn btn-sm ${favOnly ? '' : 'btn-ghost'}`} onClick={() => setFavOnly(!favOnly)} style={{ color: favOnly ? 'var(--gold-100)' : undefined }}>
              <I.Star size={14}/> {t('Favoritos','Favorites')}
            </button>
            <select className="input" style={{ width: 160 }} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="recent">{t('Más recientes','Most recent')}</option>
              <option value="name">{t('Nombre','Name')}</option>
              <option value="score">{t('Mejor score','Top score')}</option>
              <option value="difficulty">{t('Dificultad','Difficulty')}</option>
            </select>
            <div className="speed-pills" style={{ marginLeft: 'auto' }}>
              <button className={`speed-pill ${view === 'grid' ? 'speed-active' : ''}`} onClick={() => setView('grid')}><I.Grid size={12}/></button>
              <button className={`speed-pill ${view === 'list' ? 'speed-active' : ''}`} onClick={() => setView('list')}><I.List size={12}/></button>
            </div>
          </div>

          {/* Dropzone */}
          <div className="dropzone" style={{ marginBottom: 24 }}>
            <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('Importa nuevas piezas','Import new pieces')}</div>
            <div className="t-display" style={{ fontSize: 18, marginBottom: 4 }}>{t('Arrastra .mid o .midi aquí','Drop .mid or .midi here')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('o haz clic para seleccionar archivos','or click to select files')}</div>
          </div>

          {/* Grid view */}
          {view === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {filtered.map(s => (
                <div key={s.id} className="song-card" onClick={() => onPlay(s)}>
                  <div className="song-cover">
                    <span className="song-cover-letter">{s.title[0]}</span>
                    {s.favorite && <I.Star size={14} className="song-fav" stroke="none" fill="currentColor"/>}
                    <div className="song-play"><div className="play-btn" style={{ width: 48, height: 48 }}><I.Play size={20}/></div></div>
                  </div>
                  <div className="song-meta">
                    <div className="song-title">{s.title}</div>
                    <div className="song-artist">{s.artist}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {s.tags.slice(0,2).map(tag => <span key={tag} className="chip">{tag}</span>)}
                    </div>
                    <div className="song-foot">
                      <UI.Difficulty value={s.difficulty}/>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                        <span><I.Clock size={10}/> {Math.floor(s.duration/60)}:{(s.duration%60).toString().padStart(2,'0')}</span>
                        <span className="song-score">{s.lastScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {view === 'list' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--stroke-faint)' }}>
                    {['','Título','Compositor','Dif.','Duración','Score','Última práctica',''].map((h,i) => (
                      <th key={i} className="t-eyebrow" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--stroke-faint)', cursor: 'pointer' }} onClick={() => onPlay(s)}>
                      <td style={{ padding: '14px 16px' }}>
                        {s.favorite ? <I.Star size={14} stroke="none" fill="var(--gold)"/> : <span style={{ width: 14, display: 'inline-block' }}/>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-1)' }}>{s.title}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--ink-3)' }}>{s.artist}</td>
                      <td style={{ padding: '14px 16px' }}><UI.Difficulty value={s.difficulty}/></td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{Math.floor(s.duration/60)}:{(s.duration%60).toString().padStart(2,'0')}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-100)' }}>{s.lastScore}</td>
                      <td style={{ padding: '14px 16px', fontSize: 11, color: 'var(--ink-3)' }}>{s.lastPlayed.replace('2026-','').replace(/-/g,'/')}</td>
                      <td style={{ padding: '14px 16px' }}><button className="btn btn-icon btn-ghost" onClick={(e) => e.stopPropagation()}><I.More size={14}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'community' && <CommunityFeed language={language} />}
    </div>
  );
}

/* ============================================================
   COMMUNITY
   ============================================================ */
function CommunityFeed({ language }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [selected, setSelected] = useS(null);
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 360 }}>
          <I.Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }}/>
          <input className="input" placeholder={t('Buscar en la comunidad', 'Search community')} style={{ paddingLeft: 36 }}/>
        </div>
        <div className="speed-pills">
          <button className="speed-pill speed-active">{t('Populares','Popular')}</button>
          <button className="speed-pill">{t('Recientes','Recent')}</button>
          <button className="speed-pill">{t('Mejor rating','Top rated')}</button>
        </div>
        <button className="btn" style={{ marginLeft: 'auto' }}><I.Upload size={14}/> {t('Subir canción','Upload song')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {MOCK.community.map(c => (
          <div key={c.id} className="song-card" onClick={() => setSelected(c)}>
            <div className="song-cover">
              <span className="song-cover-letter">{c.title[0]}</span>
              <div className="song-play"><div className="play-btn" style={{ width: 48, height: 48 }}><I.Play size={20}/></div></div>
            </div>
            <div className="song-meta">
              <div className="song-title">{c.title}</div>
              <div className="song-artist">{c.composer}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <UI.Avatar initial={c.uploader.avatar} size={20} />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>@{c.uploader.name}</span>
              </div>
              <div className="song-foot">
                <UI.Difficulty value={c.difficulty}/>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-3)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <I.Star size={11} stroke="none" fill="var(--gold)"/>
                    <span className="t-mono">{c.rating}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <I.Download size={11}/> <span className="t-mono">{(c.downloads/1000).toFixed(1)}k</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && <CommunityDetail song={selected} onClose={() => setSelected(null)} language={language}/>}
    </div>
  );
}

function CommunityDetail({ song, onClose, language }) {
  const t = (es, en) => language === 'es' ? es : en;
  const [rating, setRating] = useS(0);
  return (
    <UI.Modal open onClose={onClose} width={560}>
      <div className="modal-head">
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('Comunidad','Community')}</div>
          <h3 className="t-display" style={{ fontSize: 22, margin: 0 }}>{song.title}</h3>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose}><I.Close size={14}/></button>
      </div>
      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24 }}>
          <div className="song-cover" style={{ borderRadius: 'var(--r-lg)', aspectRatio: '1' }}>
            <span className="song-cover-letter">{song.title[0]}</span>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>{song.composer}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <UI.Avatar initial={song.uploader.avatar} size={24}/>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('Subido por','Uploaded by')} <span style={{ color: 'var(--ink-1)' }}>@{song.uploader.name}</span></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              <Stat icon={<I.Star size={14}/>} label={t('Rating','Rating')} value={song.rating} mono/>
              <Stat icon={<I.Download size={14}/>} label={t('Guardados','Saved')} value={`${(song.downloads/1000).toFixed(1)}k`} mono/>
              <Stat icon={<I.Note size={14}/>} label={t('Dificultad','Difficulty')} value={'★'.repeat(song.difficulty)}/>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('Tu valoración','Your rating')}</div>
              <UI.Stars value={rating} onChange={setRating} size={20}/>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-gold" style={{ flex: 1 }}><I.Plus size={14}/> {t('Guardar en mi librería','Save to library')}</button>
              <button className="btn btn-ghost"><I.More size={14}/></button>
            </div>
          </div>
        </div>
      </div>
    </UI.Modal>
  );
}

/* Tiny helper */
function Stat({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--stroke-faint)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)' }}>{icon}<span className="t-eyebrow" style={{ fontSize: 9 }}>{label}</span></div>
      <div style={{ fontSize: 16, color: 'var(--ink-1)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)', fontWeight: 300 }}>{value}</div>
    </div>
  );
}

window.LibraryScreen = LibraryScreen;
window.Stat = Stat;
