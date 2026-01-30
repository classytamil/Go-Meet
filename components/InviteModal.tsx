'use client';

import React, { useState } from 'react';

interface InviteModalProps {
  meetingCode: string;
  onClose: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ meetingCode, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  // Use useEffect to access window in client component
  React.useEffect(() => {
    setMeetingUrl(`${window.location.origin}/#${meetingCode}`);
  }, [meetingCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailInvite = () => {
    const subject = encodeURIComponent("Meeting Invitation: Go Meet");
    const body = encodeURIComponent(
      `Hi there,\n\nI'm inviting you to a video meeting on Go Meet.\n\nJoin the meeting here:\n${meetingUrl}\n\nMeeting Code: ${meetingCode}\n\nSee you soon!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in duration-300">
      <div className="bg-[#1a1d23] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">Invite participants</h2>
              <p className="text-gray-400 text-sm">Share this link to let others join the meeting.</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Meeting Link</label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-2xl p-2 pl-4">
                <span className="flex-1 text-sm font-mono text-blue-400 truncate py-2">
                  {meetingUrl}
                </span>
                <button 
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    copied ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
              <button 
                onClick={handleEmailInvite}
                className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-3 text-gray-300 group"
              >
                <i className="fas fa-envelope text-blue-400 group-hover:scale-110 transition-transform"></i>
                Send via Email
              </button>
              
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex items-start gap-3">
                <i className="fas fa-shield-check text-blue-400 mt-1"></i>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Only people with the link or the code <span className="text-white font-mono font-bold">{meetingCode}</span> can ask to join the meeting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;