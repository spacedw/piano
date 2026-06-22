import React, { useState } from 'react';
import { submitCommunityUpload } from '@/engine/SupabaseClient';
import { useUserTier } from '@/hooks/useUserTier';
import { useT } from '@/i18n';
import styles from './index.module.css';

async function calculateHash(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function CommunityUploadModal({ song, onClose, onSuccess }) {
    const [title, setTitle] = useState(song.name || '');
    const [composer, setComposer] = useState(song.artist || '');
    const [genre, setGenre] = useState(song.genre || 'Classical');
    const [difficulty, setDifficulty] = useState(song.difficulty || 1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { uploadsLeft, isSupporter } = useUserTier();
    const t = useT();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (uploadsLeft <= 0) {
            setError(t('upload.limitReached'));
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const hash = await calculateHash(song.midiData);
            await submitCommunityUpload({
                title,
                composer,
                genre,
                difficulty: parseInt(difficulty, 10),
            }, song.midiData, hash);

            onSuccess();
        } catch (err) {
            setError(err.message || t('upload.error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{t('upload.title')}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.infoBanner}>
                        <span className={styles.infoIcon}>☁️</span>
                        <div>
                            {isSupporter
                                ? t('upload.supporterUnlimited')
                                : t('upload.uploadsLeft', { count: uploadsLeft, plural: uploadsLeft !== 1 ? t('upload.uploadsLeftPlural') : '' })}
                        </div>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.field}>
                        <label>{t('upload.title_label')}</label>
                        <input required value={title} onChange={e => setTitle(e.target.value)} />
                    </div>

                    <div className={styles.field}>
                        <label>{t('upload.composer')}</label>
                        <input required value={composer} onChange={e => setComposer(e.target.value)} />
                    </div>

                    <div className={styles.fieldRow}>
                        <div className={styles.field}>
                            <label>{t('upload.genre')}</label>
                            <select value={genre} onChange={e => setGenre(e.target.value)}>
                                <option>{t('upload.genreClassical')}</option>
                                <option>{t('upload.genreJazz')}</option>
                                <option>{t('upload.genrePop')}</option>
                                <option>{t('upload.genreRock')}</option>
                                <option>{t('upload.genreAnime')}</option>
                                <option>{t('upload.genreOther')}</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>{t('upload.difficulty')}</label>
                            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                                <option value="1">{t('upload.diff1')}</option>
                                <option value="2">{t('upload.diff2')}</option>
                                <option value="3">{t('upload.diff3')}</option>
                                <option value="4">{t('upload.diff4')}</option>
                                <option value="5">{t('upload.diff5')}</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isSubmitting || uploadsLeft <= 0}
                    >
                        {isSubmitting ? t('upload.publishing') : t('upload.publish')}
                    </button>
                </form>
            </div>
        </div>
    );
}
