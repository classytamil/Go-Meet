'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LiveKitRoom, useRoomContext, useTracks, useParticipants, useLocalParticipant, RoomAudioRenderer } from '@livekit/components-react';
import { RoomEvent, Track, ConnectionQuality } from 'livekit-client';
import '@livekit/components-styles';
import { Participant, Message } from '../types';
import VideoTile from './VideoTile';
import Controls from './Controls';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';
import InviteModal from './InviteModal';
import SecurityModal from './SecurityModal';
import Tooltip from './Tooltip';
import { encryptData } from '../utils/crypto';

interface MeetingRoomProps {
    token: string;
    serverUrl: string;
    meetingCode: string; // The URL/Room name
    username: string;
    onLeave: () => void;
    isHost?: boolean; // Passed from lobby if user created it?
}

export default function MeetingRoomWrapper({ token, serverUrl, meetingCode, username, onLeave, isHost }: MeetingRoomProps) {
    if (!token) return <div className="flex items-center justify-center h-screen text-white">Loading meeting...</div>;

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            data-lk-theme="default"
            style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
            onDisconnected={onLeave}
        >
            <ActiveMeetingContent meetingCode={meetingCode} isHost={isHost} />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
}

function ActiveMeetingContent({ meetingCode, isHost: initialIsHost }: { meetingCode: string, isHost?: boolean }) {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const remoteParticipants = useParticipants();

    // We get tracks to render video tiles
    // We get tracks to render video tiles
    const tracks = useTracks(
        [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.ScreenShareAudio],
        { onlySubscribed: true }
    );

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants'>('chat');
    const [messages, setMessages] = useState<Message[]>([]);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [meetingDuration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(ConnectionQuality.Excellent);
    const [unreadCount, setUnreadCount] = useState(0);
    const [localStatus, setLocalStatus] = useState<'active' | 'waiting'>(initialIsHost ? 'active' : 'waiting');

    // On mount, if not host, update metadata to waiting
    useEffect(() => {
        if (!room.localParticipant) return;

        const updateStatus = async () => {
            if (initialIsHost) {
                // Host is always active
                await room.localParticipant.setMetadata(JSON.stringify({ status: 'active' }));
            } else {
                // Guest defaults to waiting, unless already admitted (re-join)
                // For this impl, always wait on clean join.
                await room.localParticipant.setMetadata(JSON.stringify({ status: 'waiting' }));
            }
        };
        updateStatus();
    }, [room, initialIsHost]);

    // Refs for accessing state inside event listeners
    const isSidebarOpenRef = React.useRef(isSidebarOpen);
    const sidebarTabRef = React.useRef(sidebarTab);

    useEffect(() => {
        isSidebarOpenRef.current = isSidebarOpen;
        sidebarTabRef.current = sidebarTab;
        if (isSidebarOpen && sidebarTab === 'chat') {
            setUnreadCount(0);
        }
    }, [isSidebarOpen, sidebarTab]);

    // Network Quality Listener
    useEffect(() => {
        const handleQuality = (quality: ConnectionQuality, participant: any) => {
            if (participant === room.localParticipant) {
                setConnectionQuality(quality);
            }
        };

        const handleMetadata = (metadata: string | undefined, participant: any) => {
            if (metadata && participant !== room.localParticipant) {
                try {
                    const data = JSON.parse(metadata);
                    if (data.isHandRaised) {
                        setToast(`${participant.name || 'Someone'} raised their hand`);
                        setTimeout(() => setToast(null), 3000);
                    }
                } catch (e) { }
            }
        };

        room.on(RoomEvent.ConnectionQualityChanged, handleQuality);
        room.on(RoomEvent.ParticipantMetadataChanged, handleMetadata);
        return () => {
            room.off(RoomEvent.ConnectionQualityChanged, handleQuality);
            room.off(RoomEvent.ParticipantMetadataChanged, handleMetadata);
        };
    }, [room]);

    // Initial DB Call & Timer
    React.useEffect(() => {
        // Start duration timer
        const timer = setInterval(() => setDuration(prev => prev + 1), 1000);

        // Log meeting start if host? Or just log "someone joined"?
        // Protocol: If I am the first one (or host), create meeting record.
        // For simplicity, just ping the create endpoint.
        fetch('/api/meetings', {
            method: 'POST',
            body: JSON.stringify({ meetingCode, roomId: room.name }),
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.error("Failed to log meeting start", err));

        return () => {
            clearInterval(timer);
        };
    }, []);

    // End meeting log on unmount
    React.useEffect(() => {
        return () => {
            fetch('/api/meetings', {
                method: 'PATCH',
                body: JSON.stringify({ meetingCode, durationSeconds: meetingDuration }),
                headers: { 'Content-Type': 'application/json' }
            }).catch(e => console.error("Failed to update duration", e));
        };
    }, [meetingDuration]);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Sync Messages
    useEffect(() => {
        const handleData = (payload: Uint8Array, participant?: any) => {
            const str = new TextDecoder().decode(payload);
            try {
                const msg = JSON.parse(str);

                if (msg.type === 'reaction') {
                    const reactionId = Date.now().toString() + Math.random();
                    setReactions(prev => [...prev, { id: reactionId, emoji: msg.emoji, senderId: msg.senderId }]);
                    setTimeout(() => {
                        setReactions(prev => prev.filter(r => r.id !== reactionId));
                    }, 4000);
                    return;
                }

                if (msg.type === 'ADMIT_PARTICIPANT') {
                    // Check if it's for me
                    if (msg.targetId === localParticipant.identity) {
                        setLocalStatus('active');
                        localParticipant.setMetadata(JSON.stringify({ status: 'active' }));
                        setToast("You have been admitted to the meeting!");
                        setTimeout(() => setToast(null), 3000);
                    }
                    return;
                }

                // The received msg.text is already encrypted.
                // We construct a Message object.
                const newMessage: Message = {
                    id: msg.id || Date.now().toString(),
                    sender: msg.sender || 'Unknown',
                    text: msg.text, // Encrypted
                    timestamp: new Date(msg.timestamp),
                    isAI: false
                };
                setMessages(prev => [...prev, newMessage]);

                if ((!isSidebarOpenRef.current || sidebarTabRef.current !== 'chat') && msg.sender !== (localParticipant.name || 'Guest')) {
                    setUnreadCount(prev => prev + 1);
                }
            } catch (e) { }
        };
        room.on(RoomEvent.DataReceived, handleData);
        return () => { room.off(RoomEvent.DataReceived, handleData); };
    }, [room]);


    const [isHandRaised, setIsHandRaised] = useState(false);

    // Toggle Hand Raise
    const handleToggleHandRaised = () => {
        const newState = !isHandRaised;
        setIsHandRaised(newState);
        if (localParticipant) {
            localParticipant.setMetadata(JSON.stringify({ isHandRaised: newState }));
        }
    };

    // Map LiveKit participants to UI Participants
    const participants: Participant[] = useMemo(() => {
        const all: Participant[] = [];
        // Local
        if (localParticipant) {
            all.push({
                id: 'me',
                name: localParticipant.name || 'You',
                isMe: true,
                isHost: !!initialIsHost,
                isAI: false,
                videoEnabled: localParticipant.isCameraEnabled,
                audioEnabled: localParticipant.isMicrophoneEnabled,
                isHandRaised: isHandRaised,
                isSharingScreen: localParticipant.isScreenShareEnabled,
                status: 'active' // Helper: local user always sees themselves as active in their logic, visibility handled by view
            });
        }
        // Remote
        remoteParticipants.forEach(p => {
            if (!p.isLocal) {
                let remoteHandRaised = false;
                if (p.metadata) {
                    try {
                        const meta = JSON.parse(p.metadata);
                        remoteHandRaised = !!meta.isHandRaised;
                    } catch (e) { }
                }

                // Read status from metadata
                let status: 'active' | 'waiting' = 'active'; // Default for safety? or waiting?
                // Actually if no metadata, assume active (retro-compatibility) OR assume waiting?
                // Let's assume active if missing, to prevent breaking old rooms.
                // But for THIS logic, we set 'waiting' explicitly.
                if (p.metadata) {
                    try {
                        const meta = JSON.parse(p.metadata);
                        status = meta.status || 'active';
                    } catch (e) { }
                }

                all.push({
                    id: p.identity,
                    name: p.name || 'Guest',
                    isMe: false,
                    isHost: false, // Metadata needed
                    isAI: false,
                    videoEnabled: p.isCameraEnabled,
                    audioEnabled: p.isMicrophoneEnabled,
                    isHandRaised: remoteHandRaised,
                    isSharingScreen: p.isScreenShareEnabled,
                    status: status
                });
            }
        });
        return all;
    }, [localParticipant, remoteParticipants, initialIsHost, isHandRaised, localStatus]);

    // Derived lists
    // Visible: Active participants (plus myself if I am active, or even if I am waiting I see myself?)
    // While waiting, I probably shouldn't see anyone.
    // Host sees everyone? No, Host sees active in Grid, waiting in Sidebar.
    const activeParticipants = participants.filter(p => p.status === 'active' || p.isMe); // I am always in my list, but visibility handled below
    const pendingParticipants = participants.filter(p => p.status === 'waiting' && !p.isMe); // Only show OTHERS who are waiting


    // Derived state
    const isMuted = !localParticipant.isMicrophoneEnabled;
    const isVideoOff = !localParticipant.isCameraEnabled;
    const isScreenSharing = localParticipant.isScreenShareEnabled;
    const screenShareTrack = tracks.find(t => t.source === Track.Source.ScreenShare);
    const isPresentation = !!screenShareTrack;

    // Handlers
    const handleToggleMute = () => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
    const handleToggleVideo = () => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
    const handleToggleScreenShare = async () => {
        try {
            const newState = !localParticipant.isScreenShareEnabled;
            if (newState) {
                await localParticipant.setScreenShareEnabled(true, { audio: true });
            } else {
                await localParticipant.setScreenShareEnabled(false);
            }
        } catch (error) {
            console.error("Screen share error:", error);
            alert("Unable to share screen. Your browser might not support it, or permission was denied.");
        }
    };
    const handleEndCall = () => { room.disconnect(); };

    const handleSendMessage = async (text: string) => {
        const encryptedText = await encryptData(text, meetingCode);
        const msg: Message = {
            text: encryptedText,
            sender: 'You',
            timestamp: new Date(),
            id: Date.now().toString(),
            isAI: false
        };

        setMessages(prev => [...prev, msg]);

        const payload = new TextEncoder().encode(JSON.stringify({
            text: encryptedText,
            sender: localParticipant.name || 'Guest',
            timestamp: Date.now(),
            id: Date.now().toString()
        }));

        room.localParticipant.publishData(payload, { reliable: true });
    };

    const handleToggleSidebar = (tab: 'chat' | 'participants') => {
        if (isSidebarOpen && sidebarTab === tab) setIsSidebarOpen(false);
        else { setSidebarTab(tab); setIsSidebarOpen(true); }
    };

    const getGridClass = () => {
        if (isPresentation) return 'presentation-mode';
        const count = participants.length;
        if (count <= 1) return 'grid-1-participant';
        if (count === 2) return 'grid-2-participants';
        if (count === 3) return 'grid-3-participants';
        if (count === 4) return 'grid-4-participants';
        return 'grid-many-participants';
    };

    // Filter visible participants for the grid
    const visibleParticipants = activeParticipants;

    const handleAdmitParticipant = async (id: string) => {
        // Send a data message to everyone (simplest) or specific user
        const payload = new TextEncoder().encode(JSON.stringify({
            type: 'ADMIT_PARTICIPANT',
            targetId: id
        }));
        // Send reliably
        await room.localParticipant.publishData(payload, { reliable: true });

        // Optimistic UI update not easily possible since we derive from metadata, 
        // but the Guest will receive it and update their metadata, which will reflect back to us.
    };

    const renderTile = (p: Participant) => {
        // Find track for this participant
        let videoTrack: MediaStreamTrack | undefined;

        if (p.isMe) {
            const vidPub = localParticipant.getTrackPublication(Track.Source.Camera);
            if (vidPub && vidPub.track) videoTrack = vidPub.track.mediaStreamTrack;

            const screenPub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
            if (screenPub && screenPub.track && p.isSharingScreen) videoTrack = screenPub.track.mediaStreamTrack;
        } else {
            const t = tracks.find(tr => tr.participant.identity === p.id && tr.source === (p.isSharingScreen ? Track.Source.ScreenShare : Track.Source.Camera));
            if (t && t.publication.track) videoTrack = t.publication.track.mediaStreamTrack;
        }

        return (
            <VideoTile
                key={p.id}
                participant={p}
                isActiveSpeaker={room.activeSpeakers.some(s => s.identity === p.id)}
                isLocalHost={!!initialIsHost}
                videoTrack={videoTrack}
                onMuteParticipant={() => { }} // Host controls need implementation via API/RPC
                onRemoveParticipant={() => { }}
                onToggleLocalMute={handleToggleMute}
                onToggleLocalVideo={handleToggleVideo}
            />
        );
    };

    // WAITING ROOM VIEW
    if (localStatus === 'waiting' && !initialIsHost) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in bg-[#0f1115] text-white h-screen w-screen absolute inset-0 z-[100]">
                <div className="w-24 h-24 mb-6 rounded-[2rem] bg-gray-800 flex items-center justify-center animate-pulse">
                    <i className="fas fa-lock text-4xl text-gray-500"></i>
                </div>
                <h2 className="text-3xl font-extrabold mb-3">Waiting for Host</h2>
                <p className="text-gray-400 max-w-md mx-auto">You will be admitted to the meeting shortly. Please stay on this page.</p>
                <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-0"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-100"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-200"></div>
                </div>
            </div>
        );
    }

    // Special handling for screen share tile
    // If someone is sharing, we might want to show their screen as the "Main" tile and their camera as a sidebar tile
    // Original Code: 
    // const visibleParticipants = ...
    // renderVideoTile(visibleParticipants.find(p => p.id === 'screen-share'))

    // In LiveKit, we need to extract the screen share track and create a fake participant for it if we want to reuse the exact Logic.
    // Or just pass the screen share stream to the main view.

    const screenShareParticipant = participants.find(p => p.isSharingScreen);

    let mainTile: React.ReactNode | null = null;
    if (screenShareParticipant) {
        // Create a synthetic stream for the screen share
        let screenTrack: MediaStreamTrack | undefined;
        if (screenShareParticipant.isMe) {
            const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
            if (pub && pub.track) screenTrack = pub.track.mediaStreamTrack;
        } else {
            const tr = tracks.find(t => t.participant.identity === screenShareParticipant.id && t.source === Track.Source.ScreenShare);
            if (tr && tr.publication.track) screenTrack = tr.publication.track.mediaStreamTrack;
        }

        if (screenTrack) {
            // Fake participant for value
            const fakeP = { ...screenShareParticipant, id: 'screen-share', name: `${screenShareParticipant.name}'s Screen`, videoEnabled: true };
            mainTile = (
                <VideoTile
                    participant={fakeP}
                    isActiveSpeaker={false}
                    videoTrack={screenTrack}
                    isLocalHost={false}
                />
            );
        }
    }



    const [toast, setToast] = useState<string | null>(null);
    const [reactions, setReactions] = useState<{ id: string; emoji: string; senderId: string }[]>([]);

    const handleReaction = (emoji: string) => {
        const reactionId = Date.now().toString();
        const reaction = { id: reactionId, emoji, senderId: localParticipant.identity };

        setReactions(prev => [...prev, reaction]);

        // Remove after animation
        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 4000);

        const payload = new TextEncoder().encode(JSON.stringify({
            type: 'reaction',
            emoji,
            senderId: localParticipant.identity
        }));
        room.localParticipant.publishData(payload, { reliable: true });
    };

    // ... (existing helper methods)

    // Render Reaction Overlay
    const renderReactions = () => (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {toast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl border border-white/10 shadow-2xl animate-in slide-in-from-top-5 fade-in z-[60]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                            <i className="fas fa-hand text-sm animate-bounce"></i>
                        </div>
                        <span className="text-sm font-bold">{toast}</span>
                    </div>
                </div>
            )}
            {reactions.map(r => (
                <div
                    key={r.id}
                    className="absolute bottom-20 left-1/2 text-6xl animate-float-up"
                    style={{
                        left: `${50 + (Math.random() * 40 - 20)}%`, // Randomize horizontal start slightly
                        animationDuration: `${3 + Math.random()}s`
                    }}
                >
                    {r.emoji}
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-[#0f1115] text-white overflow-hidden relative">
            {renderReactions()}

            {/* Header */}
            <header className="h-16 px-6 flex items-center justify-between border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-4">


                    {/* Network Indicator */}
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/5" title="Connection Quality">
                        <div className={`w-2 h-2 rounded-full ${connectionQuality === ConnectionQuality.Excellent || connectionQuality === ConnectionQuality.Good
                            ? 'bg-green-500'
                            : connectionQuality === ConnectionQuality.Poor
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`} />
                        <i className="fas fa-wifi text-[10px] text-gray-400"></i>
                    </div>

                    <div className="h-4 w-[1px] bg-gray-800"></div>
                    <span className="text-sm font-black text-gray-500">{currentTime.toLocaleTimeString([], { timeStyle: 'short' })}</span>
                </div>
                <div className="px-4 py-1.5 bg-red-500/10 rounded-full border border-red-500/20 flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-red-500 tracking-wider">
                        {new Date(meetingDuration * 1000).toISOString().substr(11, 8)}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleToggleSidebar('participants')} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 relative">
                        <i className="fas fa-users text-sm text-gray-400"></i>
                        {pendingParticipants.length > 0 && initialIsHost && (
                            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-[#0f1115] animate-pulse">
                                {pendingParticipants.length}
                            </span>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-blue-500 text-[8px] px-1 rounded-full border border-black">{visibleParticipants.length}</span>
                    </button>
                    <button onClick={() => handleToggleSidebar('chat')} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 relative">
                        <i className="fas fa-comment text-sm text-gray-400"></i>
                        {unreadCount > 0 && !isSidebarOpen && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-[#0f1115]">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Main Grid */}
            <main className="flex-1 relative flex overflow-hidden">
                <div className={`flex-1 min-h-0 transition-all duration-300 ${isSidebarOpen ? 'mr-[400px]' : ''}`}>
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-2 py-4 pb-32">
                        <div className="min-h-full w-full flex items-center justify-center">
                            <div className={`video-grid ${getGridClass()}`}>
                                {isPresentation && mainTile ? (
                                    <>
                                        <div className="presentation-main">{mainTile}</div>
                                        <div className="presentation-sidebar">
                                            {visibleParticipants.filter(p => p.id !== screenShareParticipant?.id).map(p => renderTile(p))}
                                        </div>
                                    </>
                                ) : (
                                    visibleParticipants.map(p => renderTile(p))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <Sidebar
                    isOpen={isSidebarOpen}
                    activeTab={sidebarTab}
                    onTabChange={setSidebarTab}
                    messages={messages}
                    participants={visibleParticipants} // Show active in main list
                    pendingRequests={pendingParticipants} // Show waiting in pending list
                    isHost={!!initialIsHost}
                    meetingCode={meetingCode}
                    onClose={() => setIsSidebarOpen(false)}
                    onSendMessage={handleSendMessage}
                    onInviteClick={() => setShowInviteModal(true)}
                    onRemoveParticipant={() => { }} // Needs impl
                    onMuteParticipant={() => { }}
                    onAdmitParticipant={handleAdmitParticipant}
                    onDenyParticipant={() => { }}
                    unreadCount={unreadCount}
                />
            </main>

            {/* Controls */}
            <Controls
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                isScreenSharing={isScreenSharing}
                isHandRaised={isHandRaised}
                isSidebarOpen={isSidebarOpen}
                isHost={!!initialIsHost}
                participants={visibleParticipants}
                onToggleMute={handleToggleMute}
                onToggleVideo={handleToggleVideo}
                onToggleScreenShare={handleToggleScreenShare}
                onToggleHandRaised={handleToggleHandRaised}
                onReaction={handleReaction}
                onToggleSidebar={() => handleToggleSidebar('chat')}
                onEndCall={() => setShowExitConfirm(true)}
                onAddParticipant={() => { }} // Invite only
                unreadCount={unreadCount}
            />

            {showExitConfirm && <ConfirmationModal title="Leave Meeting" message="Are you sure?" onConfirm={handleEndCall} onCancel={() => setShowExitConfirm(false)} confirmText="Leave" />}
            {showInviteModal && <InviteModal meetingCode={meetingCode} onClose={() => setShowInviteModal(false)} />}
        </div>
    );
}
