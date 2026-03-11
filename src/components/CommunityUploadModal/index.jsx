import React, { useState } from 'react';
import { submitCommunityUpload } from '@/engine/SupabaseClient';
import { useUserTier } from '@/hooks/useUserTier';
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (uploadsLeft <= 0) {
            setError('Upload limit reached. Upgrade to Supporter to continue sharing!');
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
            setError(err.message || 'Error uploading MIDI.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Share with Community</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.infoBanner}>
                        <span className={styles.infoIcon}>☁️</span>
                        <div>
                            {isSupporter
                                ? 'Thanks for being a Supporter! You have unlimited uploads.'
                                : `You have ${uploadsLeft} upload${uploadsLeft !== 1 ? 's' : ''} left this month.`}
                        </div>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.field}>
                        <label>Title</label>
                        <input required value={title} onChange={e => setTitle(e.target.value)} />
                    </div>

                    <div className={styles.field}>
                        <label>Composer / Artist</label>
                        <input required value={composer} onChange={e => setComposer(e.target.value)} />
                    </div>

                    <div className={styles.fieldRow}>
                        <div className={styles.field}>
                            <label>Genre</label>
                            <select value={genre} onChange={e => setGenre(e.target.value)}>
                                <option>Classical</option>
                                <option>Jazz</option>
                                <option>Pop</option>
                                <option>Rock</option>
                                <option>Anime/Game</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Difficulty</label>
                            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                                <option value="1">1 - Beginner</option>
                                <option value="2">2 - Easy</option>
                                <option value="3">3 - Medium</option>
                                <option value="4">4 - Hard</option>
                                <option value="5">5 - Expert</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isSubmitting || uploadsLeft <= 0}
                    >
                        {isSubmitting ? 'Uploading...' : 'Publish to Community'}
                    </button>
                </form>
            </div>
        </div>
    );
}
