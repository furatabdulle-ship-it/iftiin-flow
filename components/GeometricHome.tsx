
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface GeometricHomeProps {
  onNavigate: (view: any) => void;
}

export const GeometricHome: React.FC<GeometricHomeProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <div className="relative w-full h-[85vh] overflow-hidden bg-warm-white flex flex-col items-center justify-center">
      
      {/* --- Kinetic Background Layer (Architectural/Premium) --- */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        
        {/* Element 1: The Golden Orbit (Large thin ring) */}
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] animate-orbit opacity-100">
           <svg viewBox="0 0 100 100" className="w-full h-full">
             <circle cx="50" cy="50" r="49.5" fill="none" stroke="#C8A84B" strokeWidth="0.2" />
             <circle cx="50" cy="50" r="40" fill="none" stroke="#0D0D0D" strokeWidth="0.1" strokeDasharray="4 2" opacity="0.5"/>
           </svg>
        </div>

        {/* Element 2: The Structure (Drifting Grid Lines) */}
        <div className="absolute top-0 right-0 w-[50vw] h-[100vh] animate-drift opacity-10">
           <svg viewBox="0 0 100 200" className="w-full h-full">
             <line x1="10" y1="0" x2="10" y2="200" stroke="#0D0D0D" strokeWidth="0.5" />
             <line x1="30" y1="0" x2="30" y2="200" stroke="#0D0D0D" strokeWidth="0.5" />
             <line x1="50" y1="0" x2="50" y2="200" stroke="#0D0D0D" strokeWidth="0.5" />
             <line x1="70" y1="0" x2="70" y2="200" stroke="#0D0D0D" strokeWidth="0.5" />
             <line x1="90" y1="0" x2="90" y2="200" stroke="#0D0D0D" strokeWidth="0.5" />
           </svg>
        </div>

        {/* Element 3: The Eclipse (Solid Black & Gold Interaction) */}
        <div className="absolute bottom-[10%] right-[10%] w-[30vw] h-[30vw] animate-float">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Gold Sun behind */}
            <circle cx="60" cy="40" r="25" fill="#C8A84B" opacity="0.8" />
            {/* Black Moon in front - causing the crescent effect */}
            <circle cx="50" cy="50" r="30" fill="#0D0D0D" />
          </svg>
        </div>

        {/* Element 4: Floating Geometric Primitives */}
        <div className="absolute top-[20%] right-[20%] w-16 h-16 animate-orbit-reverse">
           <svg viewBox="0 0 100 100" className="w-full h-full">
             <rect x="25" y="25" width="50" height="50" fill="none" stroke="#0D0D0D" strokeWidth="2" transform="rotate(45 50 50)" />
           </svg>
        </div>

        <div className="absolute bottom-[30%] left-[15%] w-24 h-24 animate-pulse-slow">
           <div className="w-full h-full rounded-full border border-gold-500 bg-gold-100/20 backdrop-blur-sm"></div>
        </div>
        
        {/* Connecting Lines / Constellation */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
           <path d="M 0,100 C 300,200 600,0 900,100" fill="none" stroke="#0D0D0D" strokeWidth="0.5" />
        </svg>

      </div>

      {/* --- Content Overlay --- */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <div className="bg-warm-white/90 backdrop-blur-md p-12 md:p-20 shadow-2xl border border-gray-100 relative overflow-hidden">
          
          {/* Decorative Gold Bar */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gold-500"></div>

          <h1 className="font-serif font-medium text-5xl md:text-7xl lg:text-8xl tracking-tight mb-6 text-black leading-none">
            {t.home.titleLine1} <span className="italic text-gold-600">{t.home.titleLine2}</span>
          </h1>
          <h2 className="font-sans font-light text-xl md:text-2xl text-gray-600 mt-6 tracking-wide max-w-2xl mx-auto">
            {t.about.mission}
            <span className="block mt-4 text-lg opacity-80">{t.about.subMission}</span>
          </h2>
          
          <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => onNavigate('SERVICES')}
              className="bg-black text-white font-sans font-bold text-xs uppercase tracking-[0.2em] px-10 py-5 hover:bg-gold-500 hover:text-black transition-all duration-300 shadow-xl"
            >
              {t.nav.services}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
