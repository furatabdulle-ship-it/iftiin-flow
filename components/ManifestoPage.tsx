import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const ManifestoPage: React.FC = () => {
  const { t } = useLanguage();
  const [openSections, setOpenSections] = useState<number[]>([]);

  const toggleSection = (index: number) => {
    setOpenSections(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-24 pt-12">
        <div className="mb-8">
          <span className="inline-block border border-black text-black px-4 py-1.5 rounded-full font-bold text-[10px] tracking-[0.3em] uppercase">
            Our Philosophy
          </span>
        </div>
        <h2 className="font-serif text-6xl md:text-7xl font-medium leading-none mb-8 text-black">
          {t.manifesto.title}
        </h2>
        <div className="w-24 h-1 bg-black mx-auto"></div>
      </div>

      {/* Intro Text */}
      <div className="max-w-3xl mx-auto mb-24 space-y-6">
        {t.manifesto.intro.map((paragraph, idx) => (
          <p 
            key={idx} 
            className={`font-serif text-xl leading-relaxed text-black ${
              idx === t.manifesto.intro.length - 1 ? 'font-bold text-black border-l-4 border-iftiin-gold pl-6 py-2' : ''
            }`}
          >
            {paragraph}
          </p>
        ))}
      </div>

      {/* Collapsible Sections */}
      <div className="max-w-3xl mx-auto space-y-4 pb-32">
        {t.manifesto.sections.map((section, index) => {
          const isOpen = openSections.includes(index);
          return (
            <div 
              key={index} 
              className={`border border-gray-200 transition-all duration-300 rounded-2xl overflow-hidden ${isOpen ? 'bg-gray-50 border-black shadow-sm' : 'bg-warm-white hover:border-gray-400'}`}
            >
              <button 
                onClick={() => toggleSection(index)}
                className="w-full flex justify-between items-center p-6 text-left focus:outline-none group"
              >
                <h3 className={`font-serif text-xl md:text-2xl font-bold transition-colors ${isOpen ? 'text-gold-dark' : 'text-black group-hover:text-iftiin-gold'}`}>
                  {section.title}
                </h3>
                {isOpen ? (
                  <ChevronUp className="w-6 h-6 text-gold-dark" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-warm-grey group-hover:text-iftiin-gold" />
                )}
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="p-6 pt-0 space-y-6 border-t border-gray-100">
                  {section.content.map((paragraph, pIndex) => (
                    <p 
                      key={pIndex} 
                      className="font-serif text-lg leading-relaxed text-black"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Sign-off */}
      <div className="text-center pb-24 border-t border-gray-100 pt-16 max-w-xl mx-auto">
        <h4 className="font-serif text-2xl font-bold italic mb-4">Iftiin Flow</h4>
        <p className="text-xs uppercase tracking-[0.2em] text-warm-grey">Context • Orientation • Autonomy</p>
      </div>
    </div>
  );
};