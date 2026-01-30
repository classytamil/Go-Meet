'use client';

import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800'
  };

  // On mobile, tooltips can be annoying. We only show them on hover, 
  // not on touch to keep the UI clean.
  return (
    <div 
      className={`relative flex items-center group/tooltip ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`hidden md:block absolute z-[150] pointer-events-none ${positionClasses[position]} animate-in fade-in zoom-in-95 slide-in-from-bottom-1 duration-200`}>
          <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-2xl whitespace-nowrap">
            {content}
          </div>
          <div className={`absolute w-0 h-0 border-[6px] border-transparent ${arrowClasses[position]}`}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;