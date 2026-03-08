import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook for a smooth requestAnimationFrame loop.
 * @param {Function} callback - Called every frame with (timestamp, deltaTime)
 * @param {boolean} active - Whether the loop should be running
 */
export function useAnimationLoop(callback, active = true) {
    const callbackRef = useRef(callback);
    const rafRef = useRef(null);
    const lastTimeRef = useRef(null);

    // Keep callback ref up to date
    callbackRef.current = callback;

    const loop = useCallback((timestamp) => {
        const delta = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0;
        lastTimeRef.current = timestamp;
        callbackRef.current(timestamp, delta);
        rafRef.current = requestAnimationFrame(loop);
    }, []);

    useEffect(() => {
        if (active) {
            lastTimeRef.current = null;
            rafRef.current = requestAnimationFrame(loop);
        } else {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            lastTimeRef.current = null;
        }

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [active, loop]);
}
