import React, { useRef, useEffect, useState } from 'react';
import { Message, Participant } from '../types';
import { GoogleGenAI } from "@google/genai";
import { decryptData } from '../utils/crypto';

interface SidebarProps {
  messages: Message[];
  participants: Participant[];
  pendingRequests?: Participant[];
  isOpen: boolean;
  isHost: boolean;
  activeTab: 'chat' | 'participants';
  meetingCode: string;
  onTabChange: (tab: 'chat' | 'participants') => void;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onInviteClick?: () => void;
  onRemoveParticipant?: (id: string) => void;
  onMuteParticipant?: (id: string) => void;
  onAdmitParticipant?: (id: string) => void;
  onDenyParticipant?: (id: string) => void;
}

const ChatMessage: React.FC<{ msg: Message; secret: string }> = ({ msg, secret }) => {
  const [decrypted, setDecrypted] = useState<string>("Decrypting...");

  useEffect(() => {
    decryptData(msg.text, secret).then(setDecrypted);
  }, [msg.text, secret]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className={`text-[10px] font-black uppercase tracking-tighter ${msg.sender === 'You' ? 'text-blue-400' : 'text-gray-500'}`}>
          {msg.sender}
        </span>
        <span className="text-[10px] text-gray-700 font-medium">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className={`p-3 rounded-2xl max-w-[95%] text-sm leading-relaxed border ${
        msg.sender === 'You' 
          ? 'bg-blue-600/10 border-blue-500/20 text-blue-50 rounded-tl-none' 
          : 'bg-white/5 border-white/5 text-gray-200 rounded-tl-none'
      }`}>
        {decrypted}
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ 
  messages, participants, pendingRequests = [], isOpen, isHost, activeTab, meetingCode,
  onTabChange, onClose, onSendMessage, onInviteClick, onRemoveParticipant, onMuteParticipant, onAdmitParticipant, onDenyParticipant
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages, activeTab, isOpen]);

  const handleGenerateSummary = async () => {
    if (messages.length === 0) return;
    setIsSummarizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const decryptedMessages = await Promise.all(
        messages.map(async m => {
          const text = await decryptData(m.text, meetingCode);
          return `${m.sender}: ${text}`;
        })
      );
      const transcript = decryptedMessages.join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Summarize this meeting chat log briefly in bullet points:\n\n${transcript}`,
        config: { temperature: 0.5 }
      });
      setSummary(response.text || "No summary available.");
    } catch (error) {
      console.error("AI Summary Error:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const filteredParticipants = participants
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return a.name.localeCompare(b.name);
    });

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[#1a1c1e] border-l border-gray-800 z-[100] flex flex-col shadow-2xl transition-all animate-in slide-in-from-right duration-500">
      <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#1a1c1e]/80 backdrop-blur-md">
        <h2 className="font-black text-xs uppercase tracking-widest flex items-center gap-3 text-gray-100">
           <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center"><i className="fas fa-users text-blue-400"></i></div>
           Meeting Hub
        </h2>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all text-gray-500"><i className="fas fa-times"></i></button>
      </div>

      <div className="flex border-b border-gray-800 bg-[#1a1c1e]">
        <button onClick={() => onTabChange('chat')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'chat' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Chat</button>
        <button onClick={() => onTabChange('participants')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 relative ${activeTab === 'participants' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>People ({participants.length})</button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-[#0f1115]">
        {activeTab === 'chat' ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 scroll-smooth custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-10">
                  <i className="fas fa-comment-dots text-5xl mb-4"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">Wait for input</p>
                </div>
              ) : (
                messages.map((msg) => <ChatMessage key={msg.id} msg={msg} secret={meetingCode} />)
              )}
            </div>

            <div className="p-4 md:p-6 bg-[#1a1c1e] border-t border-gray-800 space-y-4 pb-safe">
              <div className="bg-gradient-to-br from-blue-900/10 to-transparent border border-blue-500/10 rounded-2xl p-4 group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">AI Context</span>
                  <button onClick={handleGenerateSummary} className="text-gray-500 hover:text-blue-400 transition-colors"><i className="fas fa-magic text-[10px]"></i></button>
                </div>
                <div className="max-h-[60px] overflow-y-auto text-[11px] text-gray-500 leading-relaxed italic font-medium">
                  {isSummarizing ? "Synthesizing chat history..." : (summary || "Ask AI to recap the meeting.")}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Send to everyone..." className="flex-1 bg-white/5 border border-gray-800 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-blue-600 focus:bg-white/10 transition-all pr-12 text-gray-100" />
                <button type="submit" disabled={!inputText.trim()} className="absolute right-2 w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white disabled:opacity-20 active:scale-90 transition-all shadow-lg shadow-blue-900/30"><i className="fas fa-paper-plane text-xs"></i></button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-800">
               <div className="relative">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 100 participants..." 
                    className="w-full bg-white/5 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 transition-all"
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
              {isHost && pendingRequests.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] px-1">Verification Required</span>
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm bg-amber-600/20 text-amber-500 border border-amber-500/20">{req.name.charAt(0)}</div>
                        <div className="flex flex-col truncate">
                          <span className="text-[11px] font-bold text-gray-100 truncate">{req.name}</span>
                          <span className="text-[8px] text-amber-500/60 font-black uppercase">Wait List</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => onAdmitParticipant?.(req.id)} className="w-8 h-8 flex items-center justify-center bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all"><i className="fas fa-check text-[10px]"></i></button>
                        <button onClick={() => onDenyParticipant?.(req.id)} className="w-8 h-8 flex items-center justify-center bg-white/5 text-gray-500 rounded-lg"><i className="fas fa-times text-[10px]"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] px-1">Participant List</span>
                {filteredParticipants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] transition-all group/p">
                    <div className="flex items-center gap-3 truncate">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs bg-gray-800 text-gray-400 border border-white/5">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f1115] ${p.audioEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <div className="flex flex-col truncate">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-bold text-gray-200 truncate">{p.name}</span>
                          {p.isMe && <span className="text-[7px] font-black bg-blue-500 text-white px-1 py-0.5 rounded uppercase">You</span>}
                        </div>
                        {p.isHost && <span className="text-[8px] text-amber-500 font-black uppercase tracking-tighter">Meeting Host</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-40 group-hover/p:opacity-100 transition-opacity">
                      {p.isHandRaised && <i className="fas fa-hand text-amber-500 text-[10px] animate-bounce"></i>}
                      {isHost && !p.isMe && (
                        <button onClick={() => onRemoveParticipant?.(p.id)} className="w-7 h-7 flex items-center justify-center bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all"><i className="fas fa-user-minus text-[9px]"></i></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onInviteClick} className="w-full py-5 border-2 border-dashed border-gray-800 rounded-[2rem] text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:border-blue-500/30 hover:text-blue-500 transition-all bg-white/[0.01]">
                <i className="fas fa-plus-circle mr-3"></i> Add Users
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;