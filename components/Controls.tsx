'use client';

import React, { useState, useRef, useEffect } from 'react';
import Tooltip from './Tooltip';
import { Participant } from '../types';

interface MeetingPermissions {
  isLocked: boolean;
  allowChat: boolean;
  allowScreenShare: boolean;
  allowVideo: boolean;
}

interface ControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isSidebarOpen: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isHost: boolean;
  participants: Participant[];
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSidebar: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaised: () => void;
  onEndCall: () => void;
  onAddParticipant?: () => void;
  onMuteAll?: () => void;
  onDisableAllVideo?: () => void;
  onRemoveParticipant?: (id: string) => void;
  onReaction?: (emoji: string) => void;
  // Host Control Specific
  meetingPermissions?: MeetingPermissions;
  onUpdatePermissions?: (perms: MeetingPermissions) => void;
  unreadCount: number;
}

const Controls: React.FC<ControlsProps> = ({
  isMuted, isVideoOff, isSidebarOpen, isScreenSharing, isHandRaised, isHost, participants,
  onToggleMute, onToggleVideo, onToggleSidebar,
  onToggleScreenShare, onToggleHandRaised, onEndCall, onAddParticipant, onMuteAll,
  onDisableAllVideo, onRemoveParticipant, onReaction,
  meetingPermissions, onUpdatePermissions, unreadCount
}) => {
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowHostMenu(false);
      }
      if (reactionRef.current && !reactionRef.current.contains(event.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const emojis = ['❤️', '🔥', '😂', '👏', '🎉', '😮', '💯', '🙏'];

  const filteredParticipants = participants
    .filter(p => !p.isMe && p.name.toLowerCase().includes(participantSearch.toLowerCase()));

  const togglePerm = (key: keyof MeetingPermissions) => {
    if (meetingPermissions && onUpdatePermissions) {
      onUpdatePermissions({
        ...meetingPermissions,
        [key]: !meetingPermissions[key]
      });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 md:h-28 flex items-center justify-center px-4 md:px-6 z-50 pointer-events-none pb-safe">
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 xs:gap-3 md:gap-4 p-2.5 md:p-4 rounded-[2.5rem] bg-[#1a1c1e]/90 backdrop-blur-3xl border border-white/10 shadow-2xl pointer-events-auto max-w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
      >

        {/* Quick Add */}
        <div className="snap-center shrink-0">
          <Tooltip content="Invite people">
            <button
              onClick={onAddParticipant}
              aria-label="Invite people"
              className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-all active:scale-90"
            >
              <i className="fas fa-user-plus text-sm"></i>
            </button>
          </Tooltip>
        </div>

        <div className="h-6 w-[1px] bg-white/10 mx-1 shrink-0"></div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="snap-center shrink-0">
            <Tooltip content={isMuted ? 'Unmute' : 'Mute'}>
              <button
                onClick={onToggleMute}
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${isMuted ? 'bg-red-500 border-red-400/50' : 'bg-gray-700 hover:bg-gray-600 border-white/5'}`}
              >
                <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-base text-white`}></i>
              </button>
            </Tooltip>
          </div>

          <div className="snap-center shrink-0">
            <Tooltip content={isVideoOff ? 'Cam On' : 'Cam Off'}>
              <button
                onClick={onToggleVideo}
                aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${isVideoOff ? 'bg-red-500 border-red-400/50' : 'bg-gray-700 hover:bg-gray-600 border-white/5'}`}
              >
                <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-base text-white`}></i>
              </button>
            </Tooltip>
          </div>

          <div className="relative snap-center shrink-0" ref={reactionRef}>
            <Tooltip content="Reactions">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                aria-label="Open reaction picker"
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${showReactionPicker ? 'bg-blue-600 border-blue-400/50' : 'bg-gray-700 hover:bg-gray-600 border-white/5'}`}
              >
                <i className="fas fa-smile text-base text-white"></i>
              </button>
            </Tooltip>
            {showReactionPicker && (
              <div className="absolute bottom-18 md:bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1c1e] border border-white/10 p-2.5 rounded-2xl shadow-2xl flex gap-1.5 animate-in slide-in-from-bottom-2 fade-in zoom-in">
                {emojis.map(e => (
                  <button
                    key={e}
                    onClick={() => { onReaction?.(e); setShowReactionPicker(false); }}
                    aria-label={`Send ${e} reaction`}
                    className="w-9 h-9 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all hover:scale-125"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="snap-center shrink-0">
            <Tooltip content={isHandRaised ? 'Lower Hand' : 'Raise Hand'}>
              <button
                onClick={onToggleHandRaised}
                aria-label={isHandRaised ? "Lower your hand" : "Raise your hand"}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${isHandRaised ? 'bg-amber-500 text-white border-amber-400/50' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-white/5'}`}
              >
                <i className="fas fa-hand text-base"></i>
              </button>
            </Tooltip>
          </div>

          <div className="snap-center shrink-0">
            <Tooltip content="Share Screen">
              <button
                onClick={onToggleScreenShare}
                aria-label={isScreenSharing ? "Stop sharing screen" : "Share your screen"}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${isScreenSharing ? 'bg-cyan-600 border-cyan-400/50' : 'bg-gray-700 hover:bg-gray-600 border-white/5'}`}
              >
                <i className="fas fa-desktop text-base text-white"></i>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-white/10 mx-1 shrink-0"></div>

        <div className="snap-center shrink-0">
          <Tooltip content="Chat & Participants">
            <div className="relative">
              <button
                onClick={onToggleSidebar}
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${isSidebarOpen ? 'bg-blue-600 border-blue-400/50' : 'bg-white/5 hover:bg-white/10 border-white/5'}`}
              >
                <i className="fas fa-message text-base text-white"></i>
              </button>
              {unreadCount > 0 && !isSidebarOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full border-2 border-[#1a1c1e] shadow-lg animate-in zoom-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </Tooltip>
        </div>

        {isHost && (
          <div className="relative snap-center shrink-0" ref={menuRef}>
            <Tooltip content="Host Controls">
              <button
                onClick={() => setShowHostMenu(!showHostMenu)}
                aria-label="Open host management hub"
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl border ${showHostMenu ? 'bg-amber-600 border-amber-400/50' : 'bg-gray-700 hover:bg-gray-600 border-white/5'}`}
              >
                <i className="fas fa-user-shield text-base text-white"></i>
              </button>
            </Tooltip>
            {showHostMenu && (
              <div className="fixed sm:absolute bottom-24 sm:bottom-18 md:bottom-20 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-80 md:w-96 bg-[#1a1c1e] border border-white/10 rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-4 fade-in zoom-in-95 pointer-events-auto max-h-[70vh] flex flex-col overflow-hidden z-[60]">
                <div className="flex items-center justify-between px-2 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <i className="fas fa-crown text-amber-500 text-sm"></i>
                    </div>
                    <span className="text-[11px] font-black text-gray-100 uppercase tracking-widest">Host Management</span>
                  </div>
                  <button onClick={() => setShowHostMenu(false)} aria-label="Close host hub" className="text-gray-500 hover:text-white transition-colors"><i className="fas fa-times text-xs"></i></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { onMuteAll?.(); }} className="p-4 bg-red-500/10 hover:bg-red-500 rounded-3xl flex flex-col items-center gap-3 transition-all border border-red-500/20 group">
                      <i className="fas fa-microphone-slash text-red-500 group-hover:text-white"></i>
                      <span className="text-[10px] font-black uppercase text-gray-200 group-hover:text-white">Mute All</span>
                    </button>
                    <button onClick={() => { onDisableAllVideo?.(); }} className="p-4 bg-red-500/10 hover:bg-red-500 rounded-3xl flex flex-col items-center gap-3 transition-all border border-red-500/20 group">
                      <i className="fas fa-video-slash text-red-500 group-hover:text-white"></i>
                      <span className="text-[10px] font-black uppercase text-gray-200 group-hover:text-white">Stop Videos</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Permissions</span>
                    <div className="bg-black/20 rounded-3xl p-2 border border-white/5 space-y-1">
                      {[
                        { key: 'isLocked', label: 'Lock Meeting', icon: 'fa-lock' },
                        { key: 'allowChat', label: 'Allow Chat', icon: 'fa-message' },
                        { key: 'allowScreenShare', label: 'Allow Sharing', icon: 'fa-desktop' }
                      ].map(perm => (
                        <button
                          key={perm.key}
                          onClick={() => togglePerm(perm.key as keyof MeetingPermissions)}
                          className={`w-full p-4 text-left rounded-2xl flex items-center justify-between transition-all hover:bg-white/5 ${meetingPermissions?.[perm.key as keyof MeetingPermissions] ? 'text-gray-200' : 'text-gray-500'}`}
                        >
                          <div className="flex items-center gap-3">
                            <i className={`fas ${perm.icon} text-[10px]`}></i>
                            <span className="text-[11px] font-bold uppercase tracking-wider">{perm.label}</span>
                          </div>
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${meetingPermissions?.[perm.key as keyof MeetingPermissions] ? 'bg-blue-600' : 'bg-gray-700'}`}>
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${meetingPermissions?.[perm.key as keyof MeetingPermissions] ? 'right-1' : 'left-1'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Manage Participants</span>
                    <div className="bg-black/20 rounded-3xl p-3 border border-white/5 space-y-3">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 transition-all font-medium text-gray-200"
                      />
                      <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-2">
                        {filteredParticipants.length === 0 ? (
                          <div className="text-center py-4 text-[10px] text-gray-600 font-bold uppercase tracking-wider">No matches</div>
                        ) : (
                          filteredParticipants.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors group">
                              <div className="flex items-center gap-2 truncate">
                                <div className="w-6 h-6 rounded-lg bg-gray-700 flex items-center justify-center text-[9px] font-black">{p.name.charAt(0)}</div>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[80px]">{p.name}</span>
                              </div>
                              <button
                                onClick={() => onRemoveParticipant?.(p.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                title="Remove User"
                              >
                                <i className="fas fa-times text-[9px]"></i>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="snap-center shrink-0">
          <Tooltip content="Leave Call">
            <button
              onClick={onEndCall}
              aria-label="Leave or end the meeting"
              className="w-14 md:w-20 h-12 md:h-14 rounded-2xl flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all ml-1 active:scale-95 shadow-xl shadow-red-900/30 border border-red-400/30"
            >
              <i className="fas fa-phone-slash text-base text-white"></i>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default Controls;