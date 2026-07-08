"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  Headphones,
} from "lucide-react";
import { formatCallDuration } from "@/lib/call-data";

// ============================================================
// CallRecordingPlayer — waveform-style audio player UI
// ============================================================
export function CallRecordingPlayer({
  contactName,
  duration,
  date,
  recordingUrl,
  onClose,
}: {
  contactName: string;
  duration: number;
  date: string;
  recordingUrl?: string;
  onClose?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Simulated waveform bars
  const waveformBars = Array.from({ length: 80 }, (_, i) => {
    const variation = Math.sin(i * 1.7 + duration * 0.013) * 10;
    const height = Math.max(8, Math.sin(i * 0.3) * 30 + variation + 20);
    const isPlayed = (i / 80) * 100 <= progress;
    return { height, isPlayed };
  });

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Simulate playback progress
      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            clearInterval(interval);
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
  };

  const speeds = [0.5, 1, 1.5, 2];
  const cycleSpeed = () => {
    const idx = speeds.indexOf(playbackSpeed);
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
  };

  return (
    <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(110,106,232,0.08)] flex items-center justify-center">
            <Headphones className="w-5 h-5 text-[#6E6AE8]" />
          </div>
          <div>
            <p className="font-semibold text-sm text-[#111111]">
              Call Recording
            </p>
            <p className="text-xs text-[#6B7280]">
              {contactName} · {date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recordingUrl ? (
            <a
              href={recordingUrl}
              download
              className="p-1.5 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors"
              aria-label="Download recording"
            >
              <Download className="w-4 h-4 text-[#6B7280]" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Recording download is not available for this call."
              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
              aria-label="Recording download unavailable"
            >
              <Download className="w-4 h-4 text-[#6B7280]" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors text-[#6B7280] hover:text-[#111111]"
              aria-label="Close recording player"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div className="px-5 py-6">
        <div
          className="flex items-center gap-[2px] h-16 cursor-pointer"
          role="slider"
          aria-label="Recording progress"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setCurrentTime(Math.floor(pct * duration));
          }}
        >
          {waveformBars.map((bar, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                bar.isPlayed ? "bg-[#6E6AE8]" : "bg-[rgba(0,0,0,0.08)]"
              }`}
              style={{ height: `${bar.height}%`, minWidth: "2px" }}
            />
          ))}
        </div>

        {/* Time labels */}
        <div className="flex items-center justify-between mt-2 text-xs text-[#6B7280]">
          <span>{formatCallDuration(currentTime)}</span>
          <span>{formatCallDuration(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-[#6B7280]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#6B7280]" />
            )}
          </button>
          <button
            onClick={cycleSpeed}
            className="px-2 py-1 rounded-lg bg-[rgba(110,106,232,0.08)] hover:bg-[rgba(110,106,232,0.15)] text-xs font-medium text-[#6E6AE8] transition-colors"
            aria-label={`Playback speed: ${playbackSpeed}x. Click to change`}
          >
            {playbackSpeed}x
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTime(Math.max(0, currentTime - 15))}
            className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors"
            aria-label="Skip back 15 seconds"
          >
            <SkipBack className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-[#6E6AE8] hover:bg-[#5A56D4] flex items-center justify-center transition-colors shadow-md"
            aria-label={isPlaying ? "Pause recording" : "Play recording"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setCurrentTime(Math.min(duration, currentTime + 15))}
            className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors"
            aria-label="Skip forward 15 seconds"
          >
            <SkipForward className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>
        <div className="w-[72px]" /> {/* Spacer for centering */}
      </div>

      {/* Transcript teaser */}
      <div className="px-5 pb-5">
        <div className="bg-[#FAF8F5] border border-[rgba(0,0,0,0.04)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#6B7280] uppercase tracking-wider font-medium">
              AI Transcript
            </p>
            <span className="badge-coming-soon text-[9px]">Coming Soon</span>
          </div>
          <p className="text-sm text-[#6B7280] italic">
            Automatic call transcription and AI summary will be available here.
            Key topics, action items, and sentiment analysis extracted from
            every recorded call.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MiniRecordingPlayer — compact inline player for tables/lists
// ============================================================
export function MiniRecordingPlayer({
  duration,
  className = "",
}: {
  duration: number;
  className?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsPlaying(!isPlaying);
        }}
        className="w-7 h-7 rounded-full bg-[rgba(110,106,232,0.08)] hover:bg-[rgba(110,106,232,0.15)] flex items-center justify-center transition-colors"
        aria-label={isPlaying ? "Pause recording" : "Play recording"}
      >
        {isPlaying ? (
          <Pause className="w-3 h-3 text-[#6E6AE8]" />
        ) : (
          <Play className="w-3 h-3 text-[#6E6AE8] ml-0.5" />
        )}
      </button>
      <div className="flex-1 h-1 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden min-w-[40px]">
        <div
          className="h-full bg-[#6E6AE8] rounded-full"
          style={{ width: isPlaying ? "45%" : "0%" }}
        />
      </div>
      <span className="text-xs text-[#6B7280]">
        {formatCallDuration(duration)}
      </span>
    </div>
  );
}
