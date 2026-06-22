import React, { useMemo } from 'react';
import { useT } from '@/i18n';
import styles from './index.module.css';

const NOTE_NAMES_ES = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const NOTE_NAMES_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function noteName(midi, lang) {
  if (midi === null || midi === undefined) return null;
  const names = lang === 'es' ? NOTE_NAMES_ES : NOTE_NAMES_EN;
  return names[midi % 12];
}

function octave(midi) {
  if (midi === null || midi === undefined) return null;
  return Math.floor(midi / 12) - 1;
}

export default function FreePractice({ currentNote, currentHz, clarity, language }) {
  const t = useT();
  const hasNote = currentNote !== null && currentNote !== undefined;

  const noteDisplay = useMemo(() => noteName(currentNote, language), [currentNote, language]);
  const octDisplay = useMemo(() => octave(currentNote), [currentNote]);

  return (
    <div className={`${styles.container} ${hasNote ? styles.active : ''}`}>
      <h3 className={styles.title}>{t('freePractice.title')} 🎹</h3>

      <div className={styles.noteDisplay}>
        {hasNote ? (
          <>
            <span className={styles.noteName}>{noteDisplay}</span>
            <span className={styles.octave}>{octDisplay}</span>
          </>
        ) : (
          <span className={styles.waiting}>{t('freePractice.waiting')}</span>
        )}
      </div>

      {hasNote && currentHz && (
        <div className={styles.hzClarity}>
          <span>{Math.round(currentHz)} Hz</span>
          <span className={styles.clarityBarWrap}>
            <span
              className={styles.clarityBar}
              style={{ width: `${Math.min(clarity * 100, 100)}%` }}
            />
          </span>
        </div>
      )}

      <p className={styles.tip}>{t('freePractice.tip')}</p>
    </div>
  );
}
