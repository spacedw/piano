// Shared UI primitives: Stars, Difficulty bars, Toggle, Avatar, ProgressRing, Slider.

const Stars = ({ value, max = 5, size = 12, gold = true, onChange }) => (
  <div className="stars" style={{ display: 'inline-flex', gap: 2 }}>
    {[...Array(max)].map((_, i) => {
      const filled = i < Math.round(value);
      return (
        <span
          key={i}
          onClick={onChange ? () => onChange(i+1) : undefined}
          style={{
            width: size, height: size,
            color: filled ? (gold ? 'var(--gold)' : 'var(--ink-2)') : 'var(--ink-5)',
            cursor: onChange ? 'pointer' : 'default',
            display: 'inline-flex',
          }}
        >
          <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 1.5l2.6 5.2 5.7.8-4.1 4 1 5.7L10 14.6 4.8 17.2l1-5.7-4.1-4 5.7-.8L10 1.5z" />
          </svg>
        </span>
      );
    })}
  </div>
);

const Difficulty = ({ value, max = 5 }) => (
  <div style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
    {[...Array(max)].map((_, i) => {
      const active = i < value;
      return (
        <span
          key={i}
          style={{
            width: 3,
            height: 4 + i * 2,
            background: active ? 'var(--gold)' : 'rgba(255,255,255,0.10)',
            borderRadius: 1,
          }}
        />
      );
    })}
  </div>
);

const Toggle = ({ checked, onChange, size='md' }) => {
  const w = size === 'sm' ? 28 : 36;
  const h = size === 'sm' ? 16 : 20;
  return (
    <button
      onClick={() => onChange?.(!checked)}
      style={{
        width: w, height: h, borderRadius: 999,
        background: checked ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
        border: '1px solid ' + (checked ? 'var(--gold-600)' : 'var(--stroke-soft)'),
        position: 'relative',
        transition: 'all 200ms var(--ease-out)',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 1, left: checked ? w - h + 1 : 1,
        width: h - 4, height: h - 4,
        background: checked ? '#1A1408' : '#E8E5DE',
        borderRadius: 999,
        transition: 'left 200ms var(--ease-out)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
};

const Avatar = ({ initial, size = 28, gold = false }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: size * 0.42,
    background: gold ? 'linear-gradient(135deg, var(--gold-100), var(--gold-700))' : 'linear-gradient(135deg, #2A2A33, #15151A)',
    color: gold ? '#1A1408' : 'var(--ink-2)',
    border: '1px solid var(--stroke-soft)',
    flexShrink: 0,
    letterSpacing: '0.02em',
  }}>{initial}</div>
);

const Slider = ({ value, min = 0, max = 100, step = 1, onChange, label, suffix }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="t-label">{label}</span>
          <span className="t-mono" style={{ fontSize: 11, color: 'var(--gold-100)' }}>{value}{suffix}</span>
        </div>
      )}
      <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'linear-gradient(90deg, var(--gold-700), var(--gold))', borderRadius: 999 }} />
        <div style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: 'var(--gold-100)', border: '1px solid var(--gold-700)', boxShadow: '0 0 0 4px rgba(201,169,110,0.12)' }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange?.(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};

const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs">
    {tabs.map(t => (
      <button
        key={t.id}
        className={`tab ${value === t.id ? 'tab-active' : ''}`}
        onClick={() => onChange(t.id)}
      >
        {t.icon}
        <span>{t.label}</span>
        {t.count != null && <span className="tab-count">{t.count}</span>}
      </button>
    ))}
  </div>
);

// Modal scaffold
const Modal = ({ open, onClose, children, width = 720, padding = 0 }) => {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal-shell glass-strong fade-up"
        style={{ maxWidth: width, padding }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const SectionTitle = ({ eyebrow, title, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
    <div>
      {eyebrow && <div className="t-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
      <h2 className="t-display" style={{ fontSize: 26, margin: 0, fontWeight: 300 }}>{title}</h2>
    </div>
    {action}
  </div>
);

const Pill = ({ children, tone='neutral' }) => {
  const tones = {
    neutral: { bg: 'rgba(255,255,255,0.04)', fg: 'var(--ink-2)', bd: 'var(--stroke-faint)' },
    gold: { bg: 'rgba(201,169,110,0.10)', fg: 'var(--gold-100)', bd: 'rgba(201,169,110,0.25)' },
    rose: { bg: 'rgba(194,138,138,0.10)', fg: '#D9B4B4', bd: 'rgba(194,138,138,0.25)' },
    ok: { bg: 'rgba(143,180,138,0.10)', fg: '#B0CDAB', bd: 'rgba(143,180,138,0.22)' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', height: 20, borderRadius: 999,
      fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
      fontFamily: 'var(--font-mono)', fontWeight: 500,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
    }}>{children}</span>
  );
};

window.UI = { Stars, Difficulty, Toggle, Avatar, Slider, Tabs, Modal, SectionTitle, Pill };
