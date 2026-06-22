import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Library from '@/components/Library';

export default function LibraryPage() {
  const { handleSelectSong, currentSongId } = useOutletContext();

  return (
    <Library
      onSelectSong={handleSelectSong}
      currentSongId={currentSongId}
    />
  );
}
