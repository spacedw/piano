import React from 'react';
import './MidiStatus.css';

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
}) {
    const isConnected = !!selectedInput;

    return (
        <div className="midi-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                <div className="status-dot" />
                <span className="status-text">
                    {error ? 'MIDI Error' : isConnected ? selectedInput.name : enabled ? 'No Device' : 'MIDI Disabled'}
                </span>
            </div>

            {inputs.length > 1 && (
                <select
                    className="midi-select"
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

            {sustainPedal && (
                <div className="pedal-indicator">
                    <span>SUSTAIN</span>
                </div>
            )}

            {error && (
                <div className="midi-error">
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
