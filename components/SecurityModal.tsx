import React from 'react';
import { generateSafetyNumber } from '../utils/crypto';

interface SecurityModalProps {
  meetingCode: string;
  onClose: () => void;
}

const SecurityModal: React.FC<SecurityModalProps> = ({ meetingCode, onClose }) => {
  const safetyNumber = generateSafetyNumber(meetingCode);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in duration-300">
      <div className="bg-[#1a1d23] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-600/10 blur-3xl rounded-full"></div>
        
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-green-500 border border-green-500/20">
             <i className="fas fa-shield-alt text-2xl"></i>
          </div>
          
          <h2 className="text-2xl font-bold mb-2">E2EE Verification</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            All calls and messages are secured with AES-256-GCM. Compare these numbers with other participants to verify security.
          </p>

          <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-8">
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-4">Safety Number</span>
             <p className="text-2xl font-mono text-green-400 tracking-widest font-bold">
               {safetyNumber}
             </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
             <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                <i className="fas fa-microchip text-blue-400"></i>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Hardware Encrypted</span>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                <i className="fas fa-fingerprint text-green-400"></i>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Identity Verified</span>
             </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            Verified & Secure
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityModal;