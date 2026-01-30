export interface Participant {
  id: string;
  name: string;
  isMe: boolean;
  isAI: boolean;
  isHost?: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isHandRaised?: boolean;
  isSharingScreen?: boolean;
  avatar?: string;
}

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isAI: boolean;
}

export enum MeetingStatus {
  HOME = 'HOME',
  LOBBY = 'LOBBY',
  WAITING_ROOM = 'WAITING_ROOM',
  JOINED = 'JOINED',
  ENDED = 'ENDED'
}