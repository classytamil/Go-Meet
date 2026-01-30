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
import MeetingRoom from '../components/MeetingRoom';

export default function MeetingPage() {
  const [status, setStatus] = useState<MeetingStatus>(MeetingStatus.HOME);
  const [meetingCode, setMeetingCode] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);

  // LiveKit State
  const [token, setToken] = useState<string>("");
  const [username] = useState(`User-${Math.floor(Math.random() * 1000)}`);

  useEffect(() => {
    return () => {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, [localStream]);

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

  const handleCreateMeeting = async () => {
    setMediaError(null);
    const code = Math.random().toString(36).substring(2, 5) + '-' +
      Math.random().toString(36).substring(2, 6) + '-' +
      Math.random().toString(36).substring(2, 5);

    try {
      // Create meeting in DB
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingCode: code, roomId: code })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create meeting');
      }

      setMeetingCode(code);
      setStatus(MeetingStatus.LOBBY);
      initMedia(true);
    } catch (e: any) {
      console.error("Creation error:", e);
      setMediaError(e.message || "Could not create meeting service");
    }
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
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const isLocalHost = participants.find(p => p.isMe)?.isHost || false;

  const handleJoinNow = async () => {
    // Stop local preview tracks so LiveKit can take over
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }

    try {
      const resp = await fetch(`/api/token?room=${meetingCode}&username=${username}`);
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Failed to join meeting");
      }

      if (data.token) {
        setToken(data.token);
        if (data.room) setMeetingCode(data.room);
        setStatus(MeetingStatus.JOINED);
      }
    } catch (e: any) {
      console.error("Failed to get token", e);
      setMediaError(e.message || "Failed to connect to server");
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
          {mediaError && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4">
              <div className="bg-red-500/90 text-white px-6 py-3 rounded-2xl shadow-xl border border-red-400/30">
                {mediaError}
              </div>
            </div>
          )}
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
            {/* Hero Image / Illustration */}
            <div className="relative glass-panel rounded-[3rem] p-10 border border-white/10 shadow-2xl bg-gray-900/50 h-64 flex items-center justify-center">
              <i className="fas fa-users text-6xl text-gray-700"></i>
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
    // Revert to join now if "simulated admit" happens.
    // But we removed waiting room logic actually? No, status definition is there.
    // If user isn't host, logic dictates waiting room?
    // For now, let's keep it simple: Everyone joins immediately in this LiveKit demo.
    // But preserving UI means keeping the waiting room *view* available.
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1115] p-6 text-white relative">
        <div className="max-w-md w-full p-8 rounded-[2.5rem] bg-[#1a1c1e] text-center border border-white/10">
          <h2 className="text-2xl font-bold mb-4">Waiting Room</h2>
          <p className="text-gray-400 mb-8">Waiting for host to admit you...</p>
          <button onClick={handleJoinNow} className="w-full py-4 bg-blue-600 rounded-xl font-bold">Simulate Admit</button>
        </div>
      </div>
    );
  }

  if (status === MeetingStatus.JOINED) {
    return (
      <MeetingRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || ""}
        meetingCode={meetingCode}
        username={username}
        isHost={isLocalHost}
        onLeave={() => {
          setStatus(MeetingStatus.HOME);
          setToken("");
        }}
      />
    );
  }

  return null;
}