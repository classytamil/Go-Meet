'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LiveKitRoom, useRoomContext, useTracks, useParticipants, useLocalParticipant } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
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
        </LiveKitRoom>
    );
}

function ActiveMeetingContent({ meetingCode, isHost: initialIsHost }: { meetingCode: string, isHost?: boolean }) {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const remoteParticipants = useParticipants();

    // We get tracks to render video tiles
    const tracks = useTracks(
        [Track.Source.Camera, Track.Source.ScreenShare],
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
                isSharingScreen: localParticipant.isScreenShareEnabled
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

                all.push({
                    id: p.identity,
                    name: p.name || 'Guest',
                    isMe: false,
                    isHost: false, // Metadata needed
                    isAI: false,
                    videoEnabled: p.isCameraEnabled,
                    audioEnabled: p.isMicrophoneEnabled,
                    isHandRaised: remoteHandRaised,
                    isSharingScreen: p.isScreenShareEnabled
                });
            }
        });
        return all;
    }, [localParticipant, remoteParticipants, initialIsHost, isHandRaised]);

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
        const enable = !localParticipant.isScreenShareEnabled;
        await localParticipant.setScreenShareEnabled(enable, { audio: true });
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

    // Filter visible participants
    // If screen share is active, prioritize screen share
    const visibleParticipants = participants;

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
            const fakeP = { ...screenShareParticipant, id: 'screen-share', name: `${screenShareParticipant.name}'s Screen` };
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


    return (
        <div className="flex-1 flex flex-col h-full bg-[#0f1115] text-white overflow-hidden relative">
            {/* Header */}
            <header className="h-16 px-6 flex items-center justify-between border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-green-500/50" />
                        <span className="text-[9px] font-black uppercase text-gray-400">Live</span>
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
                        <span className="absolute -bottom-1 -right-1 bg-blue-500 text-[8px] px-1 rounded-full border border-black">{participants.length}</span>
                    </button>
                    <button onClick={() => handleToggleSidebar('chat')} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10">
                        <i className="fas fa-comment text-sm text-gray-400"></i>
                    </button>
                </div>
            </header>

            {/* Main Grid */}
            <main className="flex-1 relative flex overflow-hidden">
                <div className={`flex-1 min-h-0 transition-all duration-300 ${isSidebarOpen ? 'mr-[400px]' : ''}`}>
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-2 py-4 pb-32">
                        <div className="min-h-full w-full flex items-start justify-center">
                            <div className={`video-grid ${getGridClass()}`}>
                                {isPresentation && mainTile ? (
                                    <>
                                        <div className="presentation-main">{mainTile}</div>
                                        <div className="presentation-sidebar">
                                            {participants.filter(p => p.id !== screenShareParticipant?.id).map(p => renderTile(p))}
                                        </div>
                                    </>
                                ) : (
                                    participants.map(p => renderTile(p))
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
                    participants={participants}
                    pendingRequests={[]} // Pending requests not implemented in basic LiveKit flow without backend queue
                    isHost={!!initialIsHost}
                    meetingCode={meetingCode}
                    onClose={() => setIsSidebarOpen(false)}
                    onSendMessage={handleSendMessage}
                    onInviteClick={() => setShowInviteModal(true)}
                    onRemoveParticipant={() => { }} // Needs impl
                    onMuteParticipant={() => { }}
                    onAdmitParticipant={() => { }}
                    onDenyParticipant={() => { }}
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
                participants={participants}
                onToggleMute={handleToggleMute}
                onToggleVideo={handleToggleVideo}
                onToggleScreenShare={handleToggleScreenShare}
                onToggleHandRaised={handleToggleHandRaised}
                onToggleSidebar={() => handleToggleSidebar('chat')}
                onEndCall={() => setShowExitConfirm(true)}
                onAddParticipant={() => { }} // Invite only
            />

            {showExitConfirm && <ConfirmationModal title="Leave Meeting" message="Are you sure?" onConfirm={handleEndCall} onCancel={() => setShowExitConfirm(false)} confirmText="Leave" />}
            {showInviteModal && <InviteModal meetingCode={meetingCode} onClose={() => setShowInviteModal(false)} />}
        </div>
    );
}
