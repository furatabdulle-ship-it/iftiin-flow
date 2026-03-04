import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Presentation, Compass, FileBox, Mic2, Handshake, ArrowRight } from 'lucide-react';

interface ServicesPageProps {
  onNavigateContact: () => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigateContact }) => {
  const { t } = useLanguage();

  const getIcon = (idx: number) => {
    switch(idx) {
      case 0: return <Presentation className="w-6 h-6" />;
      case 1: return <Compass className="w-6 h-6" />;
      case 2: return <FileBox className="w-6 h-6" />;
      case 3: return <Mic2 className="w-6 h-6" />;
      case 4: return <Handshake className="w-6 h-6" />;
      default: return <Presentation className="w-6 h-6" />;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="mb-12 pt-12">
        <span className="inline-block border border-black text-black px-4 py-1.5 rounded-full font-bold text-[10px] tracking-[0.3em] uppercase mb-8">
          {t.services.label}
        </span>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <h2 className="font-serif text-6xl md:text-7xl font-medium leading-[0.9] text-black tracking-tight">
            {t.services.title}<span className="text-iftiin-gold">.</span>
          </h2>
          <p className="font-serif text-lg leading-relaxed text-black max-w-xl lg:pl-12 border-l border-gray-200">
            {t.services.intro}
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16 mb-32">
        {t.services.list.map((service, idx) => (
          <div 
            key={idx} 
            className="group relative flex flex-col p-8 rounded-[32px] border border-gray-100 hover:border-black transition-all duration-500 bg-white hover:shadow-xl hover:-translate-y-1"
          >
            {/* Index & Icon Header */}
            <div className="flex justify-between items-start mb-8">
              <span className="font-mono text-xs text-gray-300 font-bold">
                {(idx + 1).toString().padStart(2, '0')}
              </span>
              <div className="text-black group-hover:text-iftiin-gold transition-colors duration-300 transform group-hover:scale-110">
                {getIcon(idx)}
              </div>
            </div>

            {/* Content */}
            <h3 className="font-serif text-2xl font-bold mb-4 text-black group-hover:translate-x-1 transition-transform duration-300">
              {service.title}
            </h3>
            <p className="text-sm text-black leading-7 mb-6 flex-grow">
              {service.desc}
            </p>

            {/* Footer / Examples */}
            {service.examples && (
               <div className="pt-6 border-t border-gray-100 mt-auto">
                  <p className="text-[11px] text-warm-grey font-medium italic">
                    {service.examples}
                  </p>
               </div>
            )}

            {/* Decorative Corner */}
            <div className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-r-[20px] border-t-transparent border-r-transparent group-hover:border-r-iftiin-gold transition-all duration-300"></div>
          </div>
        ))}
      </div>

      {/* CTA Section - Minimalist & High Contrast */}
      <div className="bg-black text-white p-12 md:p-24 rounded-[48px] relative overflow-hidden group">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-iftiin-gold/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="relative z-10 max-w-3xl">
           <h3 className="font-serif text-4xl md:text-5xl font-medium mb-6">
             {t.services.ctaBox.title}
           </h3>
           <p className="text-warm-grey text-lg mb-10 leading-relaxed max-w-2xl">
             {t.services.ctaBox.text}
           </p>
           
           <button 
             onClick={onNavigateContact}
             className="inline-flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.2em] bg-iftiin-gold text-black px-10 py-4 rounded-full hover:bg-white transition-all duration-300 active:scale-95"
           >
             {t.services.ctaBox.btn} <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>

    </div>
  );
};