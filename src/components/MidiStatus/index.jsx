import React from 'react';
import styles from './index.module.css';

/**
 * Displays the current MIDI connection status and device selector.
 */
export default function MidiStatus({
    enabled,
    error,
    inputs,
    selectedInput,
    onSelectInput,
    sustainPedal,
    sostenutoPedal,
    softPedal,
}) {
    const isConnected = !!selectedInput;

    // MIDI not supported (mobile / Firefox / Safari)
    if (!enabled && error) {
        return (
            <div className={styles.midiStatus}>
                <div className={styles.midiUnavailable}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M6 6v12M10 6v8M14 6v12M18 6v8" />
                    </svg>
                    <span>No MIDI</span>
                    <svg className={styles.midiInfoIcon} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span className={styles.midiTooltip}>Requires Chrome or Edge on desktop</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.midiStatus}>
            <div className={`${styles.statusIndicator} ${isConnected ? styles.connected : styles.disconnected}`}>
                <div className={styles.statusDot} />
                <span className={styles.statusText}>
                    {isConnected ? selectedInput.name : enabled ? 'No Device' : 'MIDI Disabled'}
                </span>
            </div>

            {inputs.length > 1 && (
                <select
                    className={styles.midiSelect}
                    value={selectedInput?.id || ''}
                    onChange={(e) => onSelectInput(e.target.value)}
                >
                    {inputs.map(input => (
                        <option key={input.id} value={input.id}>
                            {input.name}
                        </option>
                    ))}
                </select>
            )}

            {/* <div className={styles.pedalGroup}>
                {sustainPedal && (
                    <div className={`${styles.pedalIndicator} ${styles.pedalSustain}`}>
                        <span>SUS</span>
                    </div>
                )}
                {sostenutoPedal && (
                    <div className={`${styles.pedalIndicator} ${styles.pedalSostenuto}`}>
                        <span>SOS</span>
                    </div>
                )}
                {softPedal && (
                    <div className={`${styles.pedalIndicator} ${styles.pedalSoft}`}>
                        <span>SOFT</span>
                    </div>
                )}
            </div> */}
        </div>
    );
}
