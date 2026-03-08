import React, { useState, useEffect, useRef } from 'react';
import './ScoreOverlay.css';

/**
 * ScoreOverlay shows floating score feedback when a note is scored.
 * Displays animated text like "Perfect!", "Great!", etc.
 */
export default function ScoreOverlay({ lastScore }) {
    const [feedbacks, setFeedbacks] = useState([]);
    const idRef = useRef(0);

    useEffect(() => {
        if (!lastScore || lastScore.isExtra) return;

        const id = ++idRef.current;
        const feedback = {
            id,
            label: lastScore.level.label,
            color: lastScore.level.color,
            glow: lastScore.level.glow,
            score: lastScore.totalScore,
            streak: lastScore.streak,
        };

        setFeedbacks(prev => [...prev.slice(-4), feedback]); // Keep last 5

        // Remove after animation
        const timeout = setTimeout(() => {
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        }, 1200);

        return () => clearTimeout(timeout);
    }, [lastScore]);

    return (
        <div className="score-overlay">
            {feedbacks.map((f) => (
                <div
                    key={f.id}
                    className="score-feedback"
                    style={{
                        color: f.color,
                        textShadow: `0 0 20px ${f.glow}`,
                    }}
                >
                    <span className="feedback-label">{f.label}</span>
                    {f.streak > 5 && (
                        <span className="feedback-streak">🔥 {f.streak}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
