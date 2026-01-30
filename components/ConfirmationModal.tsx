'use client';

import React from 'react';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: 'red' | 'blue';
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  title, 
  message, 
  confirmText, 
  confirmVariant = 'red',
  icon = 'fa-door-open',
  onConfirm, 
  onCancel 
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-gray-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl ${
          confirmVariant === 'red' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
        }`}>
          <i className={`fas ${icon}`}></i>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
        <p className="text-gray-400 text-center text-sm leading-relaxed mb-8">
          {message}
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className={`w-full py-4 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
              confirmVariant === 'red' 
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
            }`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 bg-transparent border border-gray-800 text-gray-300 hover:bg-white/5 rounded-2xl font-bold transition-all active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;