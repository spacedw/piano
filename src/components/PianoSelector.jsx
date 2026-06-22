import React, { useState, useRef, useEffect } from 'react';
import { PIANO_PRESETS } from '@/constants/pianoPresets';
import * as I from '@/components/Icons';

/**
 * PianoSelector — Dropdown to choose between available piano sample presets.
 *
 * Props:
 *   - currentPresetId: string  (active preset id from useAudio)
 *   - onSelect: (presetId) => void  (calls audio.switchPreset)
 *   - disabled?: boolean
 */
export default function PianoSelector({ currentPresetId, onSelect, disabled = false }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const current = PIANO_PRESETS[currentPresetId] || Object.values(PIANO_PRESETS)[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleSelect = (id) => {
    setOpen(false);
    onSelect?.(id);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          color: '#F4F1EA',
          fontSize: '13px',
          fontFamily: 'var(--font-ui)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.15s ease',
        }}
      >
        <I.PianoKeys size={14} />
        <span>{current.name}</span>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: current.loaded ? '#8FB48A' : '#C28A8A',
            boxShadow: current.loaded
              ? '0 0 6px rgba(143,180,138,0.4)'
              : '0 0 6px rgba(194,138,138,0.3)',
          }}
        />
        <I.ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '280px',
            background: '#131318',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            padding: '8px',
            zIndex: 60,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {Object.values(PIANO_PRESETS).map((preset) => {
            const isActive = preset.id === currentPresetId;
            const isLoaded = preset.loaded;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelect(preset.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(201,169,110,0.08)' : 'transparent',
                  color: '#F4F1EA',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    marginTop: '5px',
                    flexShrink: 0,
                    background: isLoaded ? '#8FB48A' : '#C28A8A',
                    boxShadow: isLoaded
                      ? '0 0 6px rgba(143,180,138,0.4)'
                      : '0 0 6px rgba(194,138,138,0.3)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 500 }}>{preset.name}</span>
                    {!isLoaded && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(194,138,138,0.10)',
                          color: '#C28A8A',
                          border: '1px solid rgba(194,138,138,0.20)',
                        }}
                      >
                        Próximamente
                      </span>
                    )}
                    {isActive && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(201,169,110,0.10)',
                          color: '#C9A96E',
                          border: '1px solid rgba(201,169,110,0.20)',
                        }}
                      >
                        Activo
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#908C84',
                      marginTop: '2px',
                      lineHeight: 1.4,
                    }}
                  >
                    {preset.description}
                    {preset.size && (
                      <span style={{ opacity: 0.7 }}> · {preset.size}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
