import React, { useState, useEffect, useRef } from 'react';
import styles from './index.module.css';

const TIER_CLASSES = {
    Perfect: styles.scoreFloatPerfect,
    Great: styles.scoreFloatGreat,
    Good: styles.scoreFloatGood,
    Miss: styles.scoreFloatMiss,
};

/**
 * ScoreFloat: floating score feedback ("Perfect", "Great", "Good", "Miss")
 * with animations and optional spark particles on correct hits.
 *
 * @param {Object} lastScore - { level: { label, color, glow }, totalScore, streak, isExtra }
 *                              or items-based: { items: [{id, x, y, tier}], onDone }
 * @param {Array} items - alternative: array of {id, x, y, tier} for positioned floats
 * @param {function} onDone - callback(id) when an item animation ends
 */
export default function ScoreFloat({ lastScore, items, onDone }) {
    // Support both legacy (lastScore) and new (items) interface
    const [feedbacks, setFeedbacks] = useState([]);
    const idRef = useRef(0);

    // Legacy mode: convert lastScore events to positioned feedbacks
    useEffect(() => {
        if (!lastScore || lastScore.isExtra || items) return;

        const id = ++idRef.current;
        const label = lastScore.level?.label || 'Good';
        const tier = label === 'Perfect' ? 'Perfect'
            : label === 'Great' ? 'Great'
            : label === 'Good' ? 'Good'
            : 'Miss';

        const feedback = {
            id,
            tier,
            label: lastScore.level?.label,
            color: lastScore.level?.color,
            glow: lastScore.level?.glow,
            score: lastScore.totalScore,
            streak: lastScore.streak,
            // Center position for legacy mode
            x: '50%',
            y: '40%',
        };

        setFeedbacks(prev => [...prev.slice(-4), feedback]);

        const timeout = setTimeout(() => {
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        }, 1200);

        return () => clearTimeout(timeout);
    }, [lastScore, items]);

    // Items mode: render provided items directly
    const renderItems = items || feedbacks;

    const handleAnimationEnd = (id) => {
        if (onDone) {
            onDone(id);
        } else {
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        }
    };

    return (
        <div className={styles.scoreFloatContainer}>
            {renderItems.map(s => {
                const tier = s.tier || s.label || 'Good';
                const tierClass = TIER_CLASSES[tier] || TIER_CLASSES.Good;
                const isPerfect = tier === 'Perfect';

                return (
                    <div
                        key={s.id}
                        className={`${styles.scoreFloatItem} ${tierClass}`}
                        style={{
                            left: s.x || '50%',
                            top: s.y || '40%',
                            // Legacy: apply color/glow if provided
                            ...(s.color && !TIER_CLASSES[tier] ? {
                                color: s.color,
                                textShadow: s.glow ? `0 0 20px ${s.glow}` : undefined,
                            } : {}),
                        }}
                        onAnimationEnd={() => handleAnimationEnd(s.id)}
                    >
                        {tier}
                        {isPerfect && (
                            <span className={styles.scoreFloatStar}>&starf;</span>
                        )}
                        {s.streak > 5 && (
                            <span style={{ fontSize: 14, letterSpacing: '1px', opacity: 0.8 }}>
                                {s.streak}
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Spark particles for Perfect hits */}
            {renderItems
                .filter(s => (s.tier || s.label) === 'Perfect' && s.x && s.y)
                .map(s => (
                    <div
                        key={`spark-${s.id}`}
                        className={styles.sparkCluster}
                        style={{ left: s.x, top: s.y }}
                    >
                        {[...Array(8)].map((_, i) => {
                            const angle = (i / 8) * Math.PI * 2;
                            const dx = Math.cos(angle) * 28;
                            const dy = Math.sin(angle) * 28;
                            return (
                                <span
                                    key={i}
                                    className={styles.sparkParticle}
                                    style={{
                                        '--dx': `${dx}px`,
                                        '--dy': `${dy}px`,
                                        animationDelay: `${i * 8}ms`,
                                    }}
                                />
                            );
                        })}
                        <span className={styles.sparkCore} />
                    </div>
                ))}
        </div>
    );
}
