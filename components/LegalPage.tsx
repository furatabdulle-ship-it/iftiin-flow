import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { FileText } from 'lucide-react';

interface LegalPageProps {
  type: 'PRIVACY' | 'TERMS' | 'IMPRESSUM' | 'REVOCATION';
}

export const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
  const { t } = useLanguage();
  
  let sections;
  let title;
  let subtitle;

  switch (type) {
    case 'PRIVACY':
      sections = t.legal.privacySections;
      title = t.legal.privacyTitle;
      break;
    case 'TERMS':
      sections = t.legal.termsSections;
      title = t.legal.termsTitle;
      subtitle = t.legal.termsSubtitle;
      break;
    case 'IMPRESSUM':
      sections = t.legal.impressumSections;
      title = t.legal.impressumTitle;
      break;
    case 'REVOCATION':
      sections = t.legal.revocationSections;
      title = t.legal.revocationTitle;
      break;
    default:
      sections = [];
      title = '';
  }

  const scrollToSection = (index: number) => {
    const element = document.getElementById(`legal-section-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Specialized Layout for TERMS (AGB) - Professional Document Style
  if (type === 'TERMS') {
    return (
      <div className="animate-in fade-in duration-500 w-full font-sans bg-white min-h-[80vh] flex flex-col items-center">
        <div className="max-w-3xl w-full px-6 py-20 md:py-24">
          
          <div className="text-center mb-16 md:mb-20 border-b border-black pb-12">
            <span className="text-gold-500 font-bold text-[10px] tracking-[0.25em] uppercase mb-6 block">Legal Agreement</span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-black leading-tight">
              {title}
            </h1>
            {subtitle && (
               <p className="font-serif text-lg md:text-xl text-gray-500 max-w-xl mx-auto italic mb-6">
                 {subtitle}
               </p>
            )}
             <div className="flex items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                <span>{t.legal.updated}</span>
             </div>
          </div>

          <div className="space-y-12">
            {sections && sections.map((section, idx) => (
              <div key={idx} className="space-y-4">
                <h2 className="font-serif text-xl font-bold text-black border-l-4 border-gold-500 pl-4 py-1">
                  {section.title}
                </h2>
                <div className="text-base text-gray-700 leading-8 whitespace-pre-line pl-5">
                  {section.content}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // Specialized Layout for Impressum (Clean, Centered, Minimal)
  if (type === 'IMPRESSUM') {
    return (
      <div className="animate-in fade-in duration-500 w-full font-sans bg-white min-h-[60vh] flex flex-col items-center">
        <div className="max-w-2xl w-full px-6 py-20 md:py-28">
          
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-16 text-center text-black">
            {title}
          </h1>

          <div className="space-y-16 text-center">
            {sections && sections.map((section, idx) => (
              <div key={idx} className="space-y-6">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gold-600">
                  {section.title}
                </h2>
                <div className="font-serif text-lg md:text-xl leading-relaxed text-black whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-24 pt-12 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto mb-4">
               Plattform der EU-Kommission zur Online-Streitbeilegung: <br/>
               <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="underline hover:text-black transition-colors">https://ec.europa.eu/consumers/odr</a>
            </p>
            <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
              Wir sind zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit.
            </p>
          </div>

        </div>
      </div>
    );
  }

  // Standard Layout for Privacy & Revocation (Document Style with Sidebar)
  return (
    <div className="animate-in fade-in duration-500 w-full font-sans">
      
      {/* Header Section */}
      <div className="bg-gray-50 border-b border-gray-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
           <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-6 text-gold-600">
                <FileText className="w-5 h-5" />
                <span className="font-bold text-[10px] tracking-[0.25em] uppercase">{t.legal.label}</span>
              </div>
              <h1 className="font-serif text-4xl md:text-6xl font-medium leading-[1.1] mb-6 text-black">
                {title}
              </h1>
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-gray-500">
                <span>{t.legal.updated}</span>
                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                <span>Iftiin Flow</span>
              </div>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
          
          {/* Sidebar / Table of Contents (Desktop Only) */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-32">
              <h3 className="font-serif text-lg font-bold mb-6 border-b border-black pb-4">Inhalt</h3>
              <nav className="flex flex-col gap-3">
                {sections && sections.map((section, idx) => (
                  <button 
                    key={idx}
                    onClick={() => scrollToSection(idx)}
                    className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-black transition-colors py-2 flex items-start gap-3 group"
                  >
                    <span className="text-gold-500 opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">→</span>
                    <span className="line-clamp-2 leading-relaxed">{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-8">
            <div className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-medium prose-p:font-sans prose-p:text-gray-600 prose-p:leading-8 prose-li:text-gray-600">
              
              <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-12 border-l-2 border-gold-500 pl-6 py-4 bg-gray-50">
                {t.legal.agreement}
              </div>

              {sections && sections.map((section, idx) => (
                <div key={idx} id={`legal-section-${idx}`} className="scroll-mt-32 mb-16 border-b border-gray-100 pb-12 last:border-0 last:pb-0 last:mb-0">
                  <h3 className="text-2xl text-black mb-6">{section.title}</h3>
                  <div className="whitespace-pre-line text-base text-gray-700 leading-relaxed">
                    {section.content}
                  </div>
                </div>
              ))}

              {(!sections || sections.length === 0) && (
                <p className="text-gray-500 italic">Content is currently being updated.</p>
              )}

              {type === 'PRIVACY' && (
                <div className="scroll-mt-32 mb-16 border-b border-gray-100 pb-12">
                  <h3 className="text-2xl text-black mb-6">Google Fonts</h3>
                  <div className="text-base text-gray-700 leading-relaxed space-y-4">
                    <p>
                      Diese Website verwendet Google Fonts. Beim Laden der Seite wird eine Verbindung zu Servern der Google LLC hergestellt, wodurch Ihre IP-Adresse übermittelt werden kann. Google LLC hat seinen Sitz in den USA. Weitere Informationen finden Sie unter:{' '}
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-black font-bold underline decoration-gray-300 underline-offset-4 hover:text-gold-500">
                        policies.google.com/privacy
                      </a>
                    </p>
                    <p>
                      This website uses Google Fonts. When the page loads, a connection is established to servers of Google LLC, which may transmit your IP address. Google LLC is based in the USA. For more information, visit:{' '}
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-black font-bold underline decoration-gray-300 underline-offset-4 hover:text-gold-500">
                        policies.google.com/privacy
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer Note */}
             <div className="mt-16 p-8 bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  Bei Fragen zu diesem Dokument kontaktieren Sie uns bitte unter <a href="mailto:contact@iftiin-flow.com" className="text-black font-bold hover:text-gold-500 underline decoration-gray-300 underline-offset-4">contact@iftiin-flow.com</a>.
                </p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};