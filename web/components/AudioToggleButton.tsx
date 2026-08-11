// web/components/AudioToggleButton.tsx
"use client";

import styles from "./AudioToggleButton.module.css";

interface AudioToggleButtonProps {
  isPlaying: boolean;
  hasTrack: boolean;
  onToggle: () => void;
}

export function AudioToggleButton({ isPlaying, hasTrack, onToggle }: AudioToggleButtonProps) {
  if (!hasTrack) return null;
  return (
    <button
      type="button"
      data-track-action="Viewer Audio Toggle"
      data-track-id="audio_toggle"
      className={styles.audioToggle}
      onClick={onToggle}
      aria-label={isPlaying ? "Tắt nhạc" : "Bật nhạc"}
    >
      {isPlaying ? "🔊" : "🔇"}
    </button>
  );
}
