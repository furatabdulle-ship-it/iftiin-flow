import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export const UIElements: React.FC = () => {
  return (
    <div className="animate-in fade-in duration-700 space-y-24 pb-24">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-[2px] bg-iftiin-gold"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-warm-grey">05 · KOMPONENTEN</span>
        </div>
        <h2 className="font-serif text-6xl font-bold tracking-tight text-black">
          Bausteine des <span className="text-iftiin-gold italic">Systems.</span>
        </h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* BUTTONS SECTION */}
        <div className="bg-white p-12 rounded-[32px] border border-gray-100 shadow-sm space-y-12">
          <div className="space-y-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-warm-grey">BUTTONS · CALL TO ACTION</span>
            <div className="flex flex-wrap gap-4 items-center">
              {/* JETZT STARTEN */}
              <button className="bg-black text-white px-8 py-3.5 rounded-full font-bold text-[13px] tracking-wide hover:bg-iftiin-gold transition-all duration-300 active:scale-95">
                Jetzt starten
              </button>
              
              {/* MATERIALIEN */}
              <button className="bg-iftiin-gold text-black px-8 py-3.5 rounded-full font-bold text-[13px] tracking-wide hover:bg-black hover:text-white transition-all duration-300 active:scale-95">
                Materialien
              </button>

              {/* WORKSHOP BUCHEN */}
              <button className="bg-terrakotta text-white px-8 py-3.5 rounded-full font-bold text-[13px] tracking-wide hover:opacity-90 transition-all duration-300 active:scale-95">
                Workshop buchen
              </button>

              {/* COMMUNITY */}
              <button className="bg-forest-green text-white px-8 py-3.5 rounded-full font-bold text-[13px] tracking-wide hover:opacity-90 transition-all duration-300 active:scale-95">
                Community
              </button>

              {/* MEHR ERFAHREN */}
              <button className="bg-white border border-gray-200 text-black px-8 py-3.5 rounded-full font-bold text-[13px] tracking-wide hover:border-black transition-all duration-300 active:scale-95">
                Mehr erfahren
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT TAGS SECTION */}
        <div className="bg-white p-12 rounded-[32px] border border-gray-100 shadow-sm space-y-12">
          <div className="space-y-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-warm-grey">CONTENT TAGS · KATEGORIEN</span>
            
            <div className="flex flex-wrap gap-3">
              <span className="bg-tag-green-bg text-tag-green-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                Einstieg
              </span>
              <span className="bg-tag-yellow-bg text-tag-yellow-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                Praxis
              </span>
              <span className="bg-tag-red-bg text-tag-red-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                Kritisch
              </span>
              <span className="bg-tag-teal-bg text-tag-teal-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                NGO
              </span>
              <span className="bg-tag-pink-bg text-tag-pink-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                Rechte
              </span>
              <span className="bg-tag-grey-bg text-tag-grey-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                Mehrsprachig
              </span>
              <span className="bg-tag-purple-bg text-tag-purple-text px-4 py-1.5 text-[11px] font-bold tracking-widest rounded-md uppercase">
                Fortgeschritten
              </span>
            </div>
          </div>
        </div>

        {/* MATERIAL CARD EXAMPLE */}
        <div className="bg-white p-12 rounded-[32px] border border-gray-100 shadow-sm space-y-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-warm-grey">MATERIAL CARD · BEISPIEL</span>
          
          <div className="bg-[#F5F4F0] rounded-2xl p-8 relative overflow-hidden border-l-4 border-iftiin-gold shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-iftiin-gold/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-warm-grey uppercase">
                <span>Material 03</span>
                <span>·</span>
                <span>Praxis</span>
              </div>
              
              <h3 className="font-serif text-3xl font-bold text-warm-grey tracking-widest leading-tight uppercase">
                Prompt Engineering<br />Cheat Sheet
              </h3>
              
              <p className="text-sm text-black/70 leading-relaxed max-w-xs">
                Die 5 Komponenten eines guten Prompts – klar, kompakt, sofort anwendbar.
              </p>
              
              <div className="flex items-center gap-4 pt-4">
                <span className="text-[10px] font-bold text-iftiin-gold uppercase tracking-widest">Praxis</span>
                <span className="text-[10px] text-warm-grey uppercase tracking-widest">PDF · 2 Seiten · DE/EN</span>
              </div>
            </div>
          </div>
        </div>

        {/* QUOTE BLOCK EXAMPLE */}
        <div className="bg-white p-12 rounded-[32px] border border-gray-100 shadow-sm space-y-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-warm-grey">ZITAT-BLOCK · IMPULS</span>
          
          <div className="bg-terrakotta rounded-2xl p-12 relative overflow-hidden group">
            {/* Large Quote Mark Background */}
            <div className="absolute top-8 right-8 text-white/10 font-serif text-[120px] leading-none select-none">
              ”
            </div>
            
            <div className="relative z-10 space-y-8">
              <p className="font-serif text-3xl md:text-4xl text-white italic leading-snug">
                Technologie wurde nicht für alle gebaut. Aber wir können sie zu unserem Werkzeug machen.
              </p>
              
              <div className="flex items-center gap-4 text-[10px] font-bold text-white/60 tracking-[0.3em] uppercase">
                <span>Iftiin Flow</span>
                <span>·</span>
                <span>Impuls Workshop</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
