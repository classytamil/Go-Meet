'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Participant } from '../types';

interface VideoTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  isActiveSpeaker: boolean;
  isLocalHost?: boolean;
  volume?: number; // 0 to 1
  onMuteParticipant?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
  onToggleLocalMute?: () => void;
  onToggleLocalVideo?: () => void;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  participant, stream, isActiveSpeaker, isLocalHost, volume = 0,
  onMuteParticipant, onRemoveParticipant, onToggleLocalMute, onToggleLocalVideo
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isScreenShare = participant.id === 'screen-share';
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream && participant.videoEnabled) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, participant.videoEnabled]);

  useEffect(() => {
    if (isActiveSpeaker) {
      setHasStartedSpeaking(true);
      const timer = setTimeout(() => setHasStartedSpeaking(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isActiveSpeaker]);

  const scaleEffect = isActiveSpeaker ? 1 + volume * 0.012 : 1;

  // Accessibility helpers
  const handleToggleMute = () => {
    if (participant.isMe) {
      onToggleLocalMute?.();
    } else if (isLocalHost) {
      onMuteParticipant?.(participant.id);
    }
  };

  const handleRemove = () => {
    if (isLocalHost && !participant.isMe) {
      onRemoveParticipant?.(participant.id);
    }
  };

  const isSharingScreen = participant.isSharingScreen || isScreenShare;

  return (
    <div 
      className={`group video-tile-container transition-all duration-300 ease-out ${isActiveSpeaker ? 'z-10' : 'z-0'}`}
      style={{ transform: `scale(${scaleEffect})` }}
    >
      <div 
        className={`relative rounded-xl md:rounded-2xl overflow-hidden bg-[#1a1c1e] border-2 transition-all duration-300 w-full h-full shadow-lg flex items-center justify-center ${
          hasStartedSpeaking ? 'animate-speaker-pop' : ''
        } ${
          isPinned ? 'ring-4 ring-blue-500/50' : ''
        } ${
          isSharingScreen 
            ? 'border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.2)]' 
            : isActiveSpeaker 
              ? 'border-blue-500' 
              : 'border-gray-800/50 hover:border-white/10'
        }`}
      >
        
        {/* Status Indicators Overlay (Top Left) */}
        <div className="absolute top-2 left-2 z-30 flex flex-col gap-1.5 pointer-events-none">
           {participant.isSharingScreen && !isScreenShare && (
              <div className="bg-cyan-500 text-white w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/40 border border-cyan-400/50 animate-in fade-in zoom-in" aria-label="Sharing screen">
                <i className="fas fa-desktop text-[10px]" aria-hidden="true"></i>
              </div>
           )}
           {participant.isHandRaised && !isScreenShare && (
              <div className="bg-amber-500 text-white w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shadow-lg shadow-amber-900/40 border border-amber-400/50 animate-bounce" aria-label="Hand raised">
                <i className="fas fa-hand text-[10px]" aria-hidden="true"></i>
              </div>
           )}
           {!participant.audioEnabled && !isScreenShare && (
              <div className="bg-red-500/80 backdrop-blur-md text-white w-6 h-6 rounded-lg flex items-center justify-center shadow-lg border border-red-400/30" aria-label="Microphone muted">
                <i className="fas fa-microphone-slash text-[8px]" aria-hidden="true"></i>
              </div>
           )}
        </div>

        {/* Quick Action Overlay (Visible on Hover/Focus - Top Right) */}
        {!isScreenShare && (
          <div className="absolute top-2 right-2 z-40 flex flex-col gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
            <button 
              onClick={() => setIsPinned(!isPinned)}
              aria-label={isPinned ? `Unpin ${participant.name}` : `Pin ${participant.name}`}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-xl backdrop-blur-md border ${isPinned ? 'bg-blue-600 border-blue-400/50 text-white' : 'bg-black/60 border-white/10 text-gray-300 hover:text-white hover:bg-black/80'}`}
            >
              <i className={`fas fa-thumbtack text-[10px] ${isPinned ? '' : '-rotate-45'}`} aria-hidden="true"></i>
            </button>

            {(participant.isMe || isLocalHost) && (
              <button 
                onClick={handleToggleMute}
                aria-label={participant.audioEnabled ? `Mute ${participant.isMe ? 'yourself' : participant.name}` : `Unmute ${participant.isMe ? 'yourself' : participant.name}`}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-xl backdrop-blur-md border ${!participant.audioEnabled ? 'bg-red-500 border-red-400/50 text-white' : 'bg-black/60 border-white/10 text-gray-300 hover:text-white hover:bg-black/80'}`}
              >
                <i className={`fas ${participant.audioEnabled ? 'fa-microphone' : 'fa-microphone-slash'} text-[10px]`} aria-hidden="true"></i>
              </button>
            )}

            {isLocalHost && !participant.isMe && (
              <button 
                onClick={handleRemove}
                aria-label={`Remove ${participant.name} from meeting`}
                className="w-8 h-8 rounded-lg bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md border border-red-400/30"
              >
                <i className="fas fa-user-minus text-[10px]" aria-hidden="true"></i>
              </button>
            )}
          </div>
        )}

        {/* Video or Avatar */}
        <div className="w-full h-full relative z-10 flex items-center justify-center overflow-hidden">
          {participant.videoEnabled && (stream || isScreenShare) ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted={participant.isMe} 
              className={`w-full h-full object-cover ${participant.isMe && !isScreenShare ? 'mirror' : ''}`} 
              aria-label={`${participant.name}'s video stream`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full w-full bg-[#121418]" aria-hidden="true">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-900/40 flex items-center justify-center text-lg md:text-xl font-black border border-blue-500/20 shadow-xl text-blue-400">
                {participant.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Name Label Bar - Compact for Large Meetings */}
        <div className="absolute bottom-1.5 md:bottom-2 left-1.5 md:left-2 z-20 flex items-center gap-2 max-w-[90%] pointer-events-none">
          <div className="bg-black/40 backdrop-blur-xl px-2 py-0.5 md:py-1 rounded-lg border border-white/10 flex items-center gap-1.5 truncate">
            {isActiveSpeaker && !isScreenShare && (
              <div className="flex gap-0.5 items-end h-2 w-3 shrink-0" aria-hidden="true">
                {[1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className="w-0.5 bg-blue-500 rounded-full" 
                    style={{ height: `${30 + Math.random() * 70}%` }} 
                  />
                ))}
              </div>
            )}
            <span className="text-[9px] md:text-[11px] font-black truncate text-white/90 uppercase tracking-tighter">
              {participant.isMe ? 'You' : participant.name}
              {participant.isHost && <i className="fas fa-crown ml-1 text-amber-500" aria-hidden="true"></i>}
              {isPinned && <i className="fas fa-thumbtack ml-1 text-[8px] text-blue-400" aria-hidden="true"></i>}
              {participant.isSharingScreen && !isScreenShare && <i className="fas fa-desktop ml-1 text-[8px] text-cyan-400" aria-hidden="true"></i>}
            </span>
          </div>
        </div>

        {/* Glow Ring for active speaker */}
        {isActiveSpeaker && !isScreenShare && (
          <div className="absolute inset-0 pointer-events-none border-[3px] border-blue-500/50 rounded-xl md:rounded-2xl active-glow-overlay" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export default VideoTile;