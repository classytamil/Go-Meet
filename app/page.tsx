'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Participant, Message, MeetingStatus } from '../types';
import VideoTile from '../components/VideoTile';
import Controls from '../components/Controls';
import Sidebar from '../components/Sidebar';
import ConfirmationModal from '../components/ConfirmationModal';
import InviteModal from '../components/InviteModal';
import SecurityModal from '../components/SecurityModal';
import Tooltip from '../components/Tooltip';
import { encryptData } from '../utils/crypto';

export default function MeetingPage() {
  const [status, setStatus] = useState<MeetingStatus>(MeetingStatus.HOME);
  const [meetingCode, setMeetingCode] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Participant[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [speakerVolume, setSpeakerVolume] = useState(0);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [participantToKick, setParticipantToKick] = useState<Participant | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ id: number, emoji: string, left: string }[]>([]);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'fair' | 'poor' | 'offline'>('excellent');

  // Meeting Permissions (Host controlled)
  const [meetingPermissions, setMeetingPermissions] = useState({
    isLocked: false,
    allowChat: true,
    allowScreenShare: true,
    allowVideo: true
  });

  const audioContextInRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakerTimeoutRef = useRef<number | null>(null);
  const simulatedVolumeRef = useRef<number>(0);

  // Network Monitoring
  useEffect(() => {
    const updateNetworkStatus = () => {
      if (!navigator.onLine) {
        setNetworkQuality('offline');
        return;
      }

      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        const { rtt, downlink } = conn;
        if (rtt > 400 || downlink < 1) setNetworkQuality('poor');
        else if (rtt > 150 || downlink < 5) setNetworkQuality('fair');
        else setNetworkQuality('excellent');
      } else {
        setNetworkQuality('excellent'); // Fallback
      }
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      conn.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if (conn) conn.removeEventListener('change', updateNetworkStatus);
    };
  }, []);

  // Reaction cleanup
  useEffect(() => {
    if (reactions.length > 0) {
      const timer = setTimeout(() => {
        setReactions(prev => prev.slice(1));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [reactions]);

  const handleSendReaction = (emoji: string) => {
    const newReaction = {
      id: Date.now(),
      emoji,
      left: `${Math.floor(Math.random() * 80) + 10}%`
    };
    setReactions(prev => [...prev, newReaction]);
  };



  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (status === MeetingStatus.JOINED) {
      interval = window.setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, [localStream]);

  useEffect(() => {
    return () => {
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    };
  }, [screenStream]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (activeSpeakerId && activeSpeakerId !== 'me') {
      const interval = setInterval(() => {
        const target = 0.3 + Math.random() * 0.7;
        simulatedVolumeRef.current = simulatedVolumeRef.current * 0.7 + target * 0.3;
        setSpeakerVolume(simulatedVolumeRef.current);
      }, 100);
      return () => clearInterval(interval);
    } else if (!activeSpeakerId) {
      setSpeakerVolume(0);
      simulatedVolumeRef.current = 0;
    }
  }, [activeSpeakerId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStream && !isMuted && status === MeetingStatus.JOINED) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextInRef.current) {
        audioContextInRef.current = new AudioContextClass({ sampleRate: 16000 });
      }
      const source = audioContextInRef.current.createMediaStreamSource(localStream);
      const analyser = audioContextInRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudio = () => {
        if (!analyserRef.current || status !== MeetingStatus.JOINED) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;

        if (average > 10) {
          if (activeSpeakerId === 'me' || average > 40) {
            const normalized = Math.min(average / 120, 1);
            setSpeakerVolume(normalized);
          }
          if (average > 30) {
            setActiveSpeakerId('me');
            if (speakerTimeoutRef.current) clearTimeout(speakerTimeoutRef.current);
            speakerTimeoutRef.current = window.setTimeout(() => {
              setActiveSpeakerId(prev => prev === 'me' ? null : prev);
            }, 2500);
          }
        } else if (activeSpeakerId === 'me') {
          setSpeakerVolume(0);
        }
        requestAnimationFrame(checkAudio);
      };
      checkAudio();
    }
  }, [localStream, isMuted, status, activeSpeakerId]);

  const initMedia = async (isHost: boolean = false) => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      setLocalStream(stream);
      setParticipants([{
        id: 'me', name: 'You', isMe: true, isAI: false, isHost: isHost,
        videoEnabled: true, audioEnabled: true, isHandRaised: false, isSharingScreen: false
      }]);
    } catch (err: any) {
      console.error("Error accessing media:", err);
      setMediaError(err.message || "Unable to access media devices.");
      setStatus(MeetingStatus.HOME);
    }
  };

  const handleCreateMeeting = () => {
    const code = Math.random().toString(36).substring(2, 5) + '-' +
      Math.random().toString(36).substring(2, 6) + '-' +
      Math.random().toString(36).substring(2, 5);
    setMeetingCode(code);
    setStatus(MeetingStatus.LOBBY);
    initMedia(true);
  };

  const handleJoinByCode = (codeToJoin?: string) => {
    const finalCode = codeToJoin || joinCodeInput;
    if (!finalCode) return;
    setMeetingCode(finalCode);
    setStatus(MeetingStatus.LOBBY);
    initMedia(false);
  };

  const handleToggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        setParticipants(prev => prev.map(p => p.id === 'me' ? { ...p, audioEnabled: audioTrack.enabled } : p));
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        setParticipants(prev => prev.map(p => p.id === 'me' ? { ...p, videoEnabled: videoTrack.enabled } : p));
      }
    }
  };

  const handleToggleHandRaised = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    setParticipants(prev => prev.map(p => p.id === 'me' ? { ...p, isHandRaised: newState } : p));
  };

  const handleMuteAll = () => setParticipants(prev => prev.map(p => p.isMe ? p : { ...p, audioEnabled: false }));
  const handleDisableAllVideo = () => {
    setParticipants(prev => prev.map(p => p.isMe ? p : { ...p, videoEnabled: false }));
    setMeetingPermissions(prev => ({ ...prev, allowVideo: false }));
  };
  const handleMuteParticipant = (id: string) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, audioEnabled: !p.audioEnabled } : p));

  const handleAdmitParticipant = (id: string) => {
    const p = pendingRequests.find(x => x.id === id);
    if (p) {
      setParticipants(prev => [...prev, p]);
      setPendingRequests(prev => prev.filter(x => x.id !== id));
    }
  };

  const handleDenyParticipant = (id: string) => setPendingRequests(prev => prev.filter(x => x.id !== id));

  const handleRemoveParticipantById = (id: string) => {
    const p = participants.find(x => x.id === id);
    if (p) setParticipantToKick(p);
  };

  const confirmKickParticipant = () => {
    if (participantToKick) {
      setParticipants(prev => prev.filter(x => x.id !== participantToKick.id));
      setParticipantToKick(null);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!meetingPermissions.allowScreenShare && !isLocalHost) {
      setMediaError("Screen sharing is disabled by the host.");
      setTimeout(() => setMediaError(null), 3000);
      return;
    }

    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setParticipants(prev => prev.filter(p => p.id !== 'screen-share').map(p => p.isMe ? { ...p, isSharingScreen: false } : p));
    } else {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (e) {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }

        const hasSystemAudio = stream.getAudioTracks().length > 0;
        setScreenStream(stream);

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setParticipants(prev => prev.filter(p => p.id !== 'screen-share').map(p => p.isMe ? { ...p, isSharingScreen: false } : p));
        };

        setParticipants(prev => [
          { id: 'screen-share', name: 'Your Screen', isMe: true, isAI: false, videoEnabled: true, audioEnabled: hasSystemAudio, isSharingScreen: true },
          ...prev.map(p => p.isMe ? { ...p, isSharingScreen: true } : p)
        ]);
      } catch (err: any) {
        console.error("Screen share error:", err);
        if (err.name === 'NotAllowedError') {
          setMediaError("Screen share request was denied.");
          setTimeout(() => setMediaError(null), 5000);
        }
      }
    }
  };

  const handleAddParticipant = () => {
    const names = ['Sarah Wilson', 'Mike Ross', 'Harvey Specter', 'Louis Litt', 'Donna Paulsen', 'Rachel Zane', 'Jessica Pearson'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const id = `p-${Date.now()}`;
    const newP: Participant = { id, name: randomName, isMe: false, isAI: false, videoEnabled: Math.random() > 0.3, audioEnabled: true, isHandRaised: false };

    if (isLocalHost) {
      setPendingRequests(prev => [...prev, newP]);
      setIsSidebarOpen(true);
      setSidebarTab('participants');
    } else {
      setParticipants(prev => [...prev, newP]);
    }
  };

  const handleSimulate100 = () => {
    const newParticipants: Participant[] = [];
    for (let i = 0; i < 99; i++) {
      newParticipants.push({
        id: `sim-${i}`,
        name: `Guest ${i + 1}`,
        isMe: false,
        isAI: false,
        videoEnabled: Math.random() > 0.6,
        audioEnabled: true,
        isHandRaised: Math.random() > 0.9
      });
    }
    setParticipants(prev => [prev[0], ...newParticipants]);
  };

  const handleToggleSidebar = (tab: 'chat' | 'participants') => {
    if (isSidebarOpen && sidebarTab === tab) setIsSidebarOpen(false);
    else { setSidebarTab(tab); setIsSidebarOpen(true); }
  };

  const handleSendMessage = async (text: string) => {
    if (!meetingPermissions.allowChat && !isLocalHost) return;
    const encryptedText = await encryptData(text, meetingCode);
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'You', text: encryptedText, timestamp: new Date(), isAI: false }]);
  };

  const handleEndCall = () => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    window.location.reload();
  };

  const handleJoinNow = () => {
    const me = participants.find(p => p.isMe);
    if (me?.isHost) setStatus(MeetingStatus.JOINED);
    else setStatus(MeetingStatus.WAITING_ROOM);
  };

  const getGridClass = () => {
    if (screenStream) return 'presentation-mode';
    const count = participants.length;
    if (count <= 1) return 'grid-1-participant';
    if (count === 2) return 'grid-2-participants';
    if (count === 3) return 'grid-3-participants';
    if (count === 4) return 'grid-4-participants';
    return 'grid-many-participants';
  };

  const isLocalHost = participants.find(p => p.isMe)?.isHost || false;
  const isPresentation = !!screenStream;

  const visibleParticipants = [...participants].sort((a, b) => {
    if (a.id === activeSpeakerId) return -1;
    if (b.id === activeSpeakerId) return 1;
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;
    return 0;
  });

  const renderVideoTile = (p: Participant) => (
    <VideoTile
      key={p.id} participant={p} isActiveSpeaker={activeSpeakerId === p.id}
      isLocalHost={isLocalHost} volume={activeSpeakerId === p.id ? speakerVolume : 0}
      stream={p.id === 'me' ? localStream : (p.id === 'screen-share' ? screenStream : null)}
      onMuteParticipant={handleMuteParticipant} onRemoveParticipant={handleRemoveParticipantById}
      onToggleLocalMute={handleToggleMute} onToggleLocalVideo={handleToggleVideo}
    />
  );

  const getNetworkColor = () => {
    switch (networkQuality) {
      case 'excellent': return 'bg-green-500 shadow-green-500/50';
      case 'fair': return 'bg-yellow-500 shadow-yellow-500/50';
      case 'poor': return 'bg-red-500 shadow-red-500/50';
      case 'offline': return 'bg-red-600 shadow-red-600/50';
      default: return 'bg-gray-500';
    }
  };

  if (status === MeetingStatus.HOME) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col text-white overflow-y-auto">
        <header className="px-6 py-4 flex items-center justify-between border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20"><i className="fas fa-video"></i></div>
            <span className="text-xl font-bold tracking-tight">Go Meet</span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 text-center lg:text-left">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">Large-scale meetings. <span className="text-blue-500">Engaging</span> for everyone.</h1>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-lg mx-auto lg:mx-0">Host up to 100 participants with crystal clear video, live reactions, and AI summaries.</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button onClick={handleCreateMeeting} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 active:scale-95">
                <i className="fas fa-video"></i> New Meeting
              </button>
              <div className="flex-1 flex gap-2">
                <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value)} className="flex-1 bg-white/5 border border-gray-700 rounded-xl px-4 py-4 outline-none focus:border-blue-500 transition-all text-sm" placeholder="Enter a code or link" />
                <button onClick={() => handleJoinByCode()} className="text-blue-500 font-bold px-6 hover:bg-blue-500/10 rounded-xl transition-all active:scale-95">Join</button>
              </div>
            </div>
          </div>
          <div className="relative group perspective-1000">
            <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full"></div>
            <div className="relative glass-panel rounded-[3rem] p-10 border border-white/10 shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]">
              <div className="grid grid-cols-3 gap-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className={`aspect-video rounded-xl ${i === 4 ? 'bg-blue-600 scale-110 shadow-xl shadow-blue-500/20' : 'bg-gray-800/50'} border border-white/5`}></div>
                ))}
              </div>
              <div className="mt-8 space-y-4">
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full w-2/3 bg-blue-500 rounded-full"></div></div>
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white/5"></div>
                    <div className="h-8 w-8 rounded-lg bg-white/5"></div>
                    <div className="h-8 w-8 rounded-lg bg-white/5"></div>
                  </div>
                  <div className="h-10 w-24 bg-red-500/20 rounded-xl"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (status === MeetingStatus.LOBBY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1115] p-6 text-white overflow-y-auto">
        <div className="max-w-4xl w-full flex flex-col md:flex-row gap-12 items-center">
          <div className="w-full flex-1 aspect-video bg-[#1a1d23] rounded-[2.5rem] border border-gray-800 overflow-hidden relative shadow-2xl">
            {localStream && !isVideoOff ? <video autoPlay playsInline muted ref={v => { if (v) v.srcObject = localStream; }} className="w-full h-full object-cover mirror" /> : <div className="h-full w-full flex items-center justify-center text-4xl font-bold bg-blue-600/20">U</div>}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
              <button onClick={handleToggleMute} className={`w-14 h-14 rounded-2xl border-2 transition-all active:scale-90 ${isMuted ? 'bg-red-500 border-red-500 shadow-lg shadow-red-900/30' : 'bg-black/60 border-gray-500 hover:bg-black/80 hover:border-white/20'}`}><i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i></button>
              <button onClick={handleToggleVideo} className={`w-14 h-14 rounded-2xl border-2 transition-all active:scale-90 ${isVideoOff ? 'bg-red-500 border-red-500 shadow-lg shadow-red-900/30' : 'bg-black/60 border-gray-500 hover:bg-black/80 hover:border-white/20'}`}><i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i></button>
            </div>
          </div>
          <div className="w-full md:w-80 space-y-8 text-center md:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight">Check your setup</h1>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Meeting ID</span>
              <p className="text-xl font-mono text-gray-200 tracking-wider truncate">{meetingCode}</p>
            </div>
            <button onClick={handleJoinNow} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-bold text-lg shadow-2xl shadow-blue-900/30 transition-all active:scale-95">Join Now</button>
            <button onClick={() => setStatus(MeetingStatus.HOME)} className="w-full text-gray-500 font-bold hover:text-white transition-colors text-sm uppercase tracking-widest">Exit</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === MeetingStatus.WAITING_ROOM) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1115] p-6 text-white relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0f1115] to-[#0f1115] animate-spin-slow opacity-50"></div>
        </div>

        <div className="max-w-md w-full relative z-10 p-8 rounded-[2.5rem] bg-[#1a1c1e]/80 backdrop-blur-xl border border-white/10 text-center shadow-2xl space-y-6">
          <div className="w-20 h-20 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center animate-pulse">
            <i className="fas fa-hourglass-half text-3xl text-amber-500"></i>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Waiting for host...</h2>
            <p className="text-gray-400">The meeting host will let you in soon.</p>
          </div>

          <div className="py-6 border-y border-white/5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Meeting ID</span>
              <span className="font-mono text-gray-300 bg-white/5 px-2 py-1 rounded-lg">{meetingCode}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Status</span>
              <span className="text-amber-500 font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></div> Pending</span>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => setStatus(MeetingStatus.JOINED)} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-bold text-gray-300 transition-all border border-white/5 flex items-center justify-center gap-2 group">
              <i className="fas fa-magic text-blue-400 group-hover:rotate-12 transition-transform"></i> Demo: Simulate "Admit"
            </button>
            <button onClick={() => setStatus(MeetingStatus.HOME)} className="w-full text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest py-2">Leave</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1115] text-white overflow-hidden">
      {/* Reaction Particles Layer */}
      {reactions.map(r => (
        <div key={r.id} className="reaction-particle" style={{ left: r.left }}>{r.emoji}</div>
      ))}

      {/* Global Meeting Error Toast */}
      {mediaError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-red-400/30 flex items-center gap-3">
            <i className="fas fa-exclamation-circle"></i>
            <span className="text-xs font-bold uppercase tracking-wider">{mediaError}</span>
          </div>
        </div>
      )}

      <header className="h-16 px-6 flex items-center justify-between border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-40 pt-safe">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Tooltip content={`Connection: ${networkQuality.charAt(0).toUpperCase() + networkQuality.slice(1)}`}>
              <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/5 hover:bg-white/10 transition-colors">
                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] animate-pulse ${getNetworkColor()}`} />
                <span className="text-[9px] font-black uppercase text-gray-400 hidden lg:inline tracking-tighter">Live</span>
              </div>
            </Tooltip>
            <span className="text-sm font-black tracking-tight uppercase text-gray-500">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="h-4 w-[1px] bg-gray-800"></div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer transition-all ${meetingPermissions.isLocked ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`} onClick={() => setShowSecurityModal(true)}>
            <i className={`fas ${meetingPermissions.isLocked ? 'fa-lock text-amber-500' : 'fa-shield-check text-green-400'} text-[10px]`}></i>
            <span className={`text-[10px] font-black uppercase tracking-widest hidden xs:inline ${meetingPermissions.isLocked ? 'text-amber-500' : 'text-green-400'}`}>
              {meetingPermissions.isLocked ? 'Meeting Locked' : 'E2EE Secured'}
            </span>
          </div>
          {isLocalHost && participants.length < 10 && (
            <button onClick={handleSimulate100} className="text-[9px] font-black bg-white/5 border border-white/10 rounded-full px-3 py-1 hover:bg-white/10 transition-colors uppercase tracking-tighter">Demo: Fill 100</button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-1.5 bg-red-500/10 rounded-full border border-red-500/20 flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
            <span className="text-xs font-mono font-bold text-red-500 tracking-wider">{formatDuration(meetingDuration)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => handleToggleSidebar('participants')} className="w-10 h-10 rounded-xl flex items-center justify-center relative bg-white/5 text-gray-400 hover:bg-white/10 active:scale-90 transition-all">
            <i className="fas fa-users text-sm"></i>
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-[8px] min-w-4 h-4 px-1 flex items-center justify-center rounded-full border-2 border-[#0f1115] font-black z-10 animate-pulse">
                {pendingRequests.length}
              </span>
            )}
            <span className="absolute -bottom-1.5 -right-1.5 bg-blue-500 text-[8px] min-w-4 h-4 px-1 flex items-center justify-center rounded-full border-2 border-[#0f1115] font-black">{participants.length}</span>
          </button>
          <button onClick={() => handleToggleSidebar('chat')} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all ${isSidebarOpen && sidebarTab === 'chat' ? 'bg-blue-600' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            <i className="fas fa-comment text-sm"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        <div className={`flex-1 min-h-0 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'lg:mr-[400px]' : ''}`}>
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-2 py-4 pb-32">
            <div className="min-h-full w-full flex items-start justify-center">
              <div key={participants.length} className={`video-grid ${getGridClass()} animate-in fade-in duration-500`}>
                {isPresentation ? (
                  <>
                    <div className="presentation-main">{renderVideoTile(visibleParticipants.find(p => p.id === 'screen-share')!)}</div>
                    <div className="presentation-sidebar">{visibleParticipants.filter(p => p.id !== 'screen-share').slice(0, 16).map(p => renderVideoTile(p))}</div>
                  </>
                ) : (
                  visibleParticipants.map(p => renderVideoTile(p))
                )}
              </div>
            </div>
          </div>
        </div>
        <Sidebar
          isOpen={isSidebarOpen} activeTab={sidebarTab} onTabChange={setSidebarTab}
          messages={messages} participants={participants} pendingRequests={pendingRequests} isHost={isLocalHost}
          meetingCode={meetingCode}
          onClose={() => setIsSidebarOpen(false)} onSendMessage={handleSendMessage}
          onInviteClick={() => setShowInviteModal(true)} onRemoveParticipant={handleRemoveParticipantById}
          onMuteParticipant={handleMuteParticipant} onAdmitParticipant={handleAdmitParticipant} onDenyParticipant={handleDenyParticipant}
        />
      </main>

      <Controls
        isMuted={isMuted} isVideoOff={isVideoOff} isSidebarOpen={isSidebarOpen} isHandRaised={isHandRaised}
        isScreenSharing={!!screenStream} isHost={isLocalHost} participants={participants}
        onToggleMute={handleToggleMute} onToggleVideo={handleToggleVideo}
        onToggleSidebar={() => handleToggleSidebar('chat')} onToggleScreenShare={handleToggleScreenShare}
        onToggleHandRaised={handleToggleHandRaised}
        onEndCall={() => setShowExitConfirm(true)} onAddParticipant={handleAddParticipant}
        onMuteAll={handleMuteAll} onDisableAllVideo={handleDisableAllVideo}
        onRemoveParticipant={handleRemoveParticipantById}
        onReaction={handleSendReaction}
        // Host Menu Props
        meetingPermissions={meetingPermissions}
        onUpdatePermissions={setMeetingPermissions}
      />

      {showExitConfirm && <ConfirmationModal title="End meeting?" message="Are you sure you want to leave the call?" confirmText="End for all" onConfirm={handleEndCall} onCancel={() => setShowExitConfirm(false)} />}
      {participantToKick && <ConfirmationModal title="Remove user?" message={`Remove ${participantToKick.name} from meeting?`} confirmText="Remove" onConfirm={confirmKickParticipant} onCancel={() => setParticipantToKick(null)} />}
      {showInviteModal && <InviteModal meetingCode={meetingCode} onClose={() => setShowInviteModal(false)} />}
      {showSecurityModal && <SecurityModal meetingCode={meetingCode} onClose={() => setShowSecurityModal(false)} />}
    </div>
  );
}