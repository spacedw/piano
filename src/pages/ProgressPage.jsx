import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ProgressDashboard from '@/components/ProgressDashboard';

export default function ProgressPage() {
  const { handlePlayRecording, handleSaveRecordingToLibrary } = useOutletContext();

  return (
    <ProgressDashboard
      onPlayRecording={handlePlayRecording}
      onSaveToLibrary={handleSaveRecordingToLibrary}
    />
  );
}
