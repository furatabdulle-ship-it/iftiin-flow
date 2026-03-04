import React, { useState } from 'react';
import { ContactPage } from './components/ContactPage';
import { LegalPage } from './components/LegalPage';
import { GeometricHome } from './components/GeometricHome';
import { ManifestoPage } from './components/ManifestoPage';
import { ServicesPage } from './components/ServicesPage';
import { UIElements } from './components/UIElements';
import { Menu, Search, User, X } from 'lucide-react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

type View = 'HOME' | 'ABOUT' | 'CONTACT' | 'PRIVACY' | 'TERMS' | 'MANIFESTO' | 'SERVICES' | 'IMPRESSUM' | 'REVOCATION' | 'UI_ELEMENTS';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('HOME');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const navigate = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoClick = () => {
    navigate('HOME');
  };

  return (
    <div className="min-h-screen bg-warm-white text-black selection:bg-iftiin-gold selection:text-white flex flex-col font-sans">
      {/* Top Utility Bar (Consultancy Style) */}
      <div className="bg-warm-white border-b border-gray-100 text-black px-6 md:px-12 py-3 flex justify-between items-center text-[10px] tracking-[0.2em] uppercase font-medium">
        <span className="border border-black px-3 py-1 rounded-full font-bold text-black">{t.nav.headerSubtitle}</span>
        <div className="flex gap-6">
           <button 
             onClick={() => navigate('MANIFESTO')}
             className="hover:text-iftiin-gold cursor-pointer transition-colors uppercase"
           >
             {t.nav.manifesto}
           </button>
           <button 
             onClick={() => navigate('SERVICES')}
             className={`hover:text-iftiin-gold cursor-pointer transition-colors uppercase ${currentView === 'SERVICES' ? 'text-black font-bold' : ''}`}
           >
             {t.nav.services}
           </button>
           <button 
            onClick={() => setLanguage(language === 'EN' ? 'DE' : 'EN')}
            className="hover:text-iftiin-gold transition-colors font-bold"
          >
            {language === 'EN' ? 'DE' : 'EN'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`py-6 px-6 md:px-12 sticky top-0 z-50 transition-colors duration-300 ${currentView === 'HOME' ? 'bg-warm-white/80 backdrop-blur-md' : 'bg-warm-white/95 border-b border-black backdrop-blur-md'}`}>
        <div className="flex justify-between items-center">
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-12">
             {/* Logo - Restored to IFTIIN */}
             <h1 className="font-serif text-3xl font-bold tracking-tight cursor-pointer leading-none group" onClick={handleLogoClick}>
               IFTIIN<span className="text-iftiin-gold group-hover:text-black transition-colors">.</span>
             </h1>

             {/* Desktop Links */}
             <div className="hidden md:flex gap-8 text-[11px] font-bold tracking-[0.15em] uppercase text-warm-grey">
               <button 
                onClick={() => navigate('SERVICES')}
                className={`hover:text-black transition-colors ${currentView === 'SERVICES' ? 'text-black border-b border-black pb-0.5' : ''}`}
               >
                 {t.nav.services}
               </button>
               <button 
                onClick={() => navigate('ABOUT')}
                className={`hover:text-black transition-colors ${currentView === 'ABOUT' ? 'text-black border-b border-black pb-0.5' : ''}`}
               >
                 {t.nav.about}
               </button>
             </div>
          </div>
          
          <div className="flex items-center gap-6 text-black">
            <button 
              onClick={() => navigate('CONTACT')}
              className="hidden md:block bg-black text-white px-8 py-3.5 rounded-full font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-iftiin-gold transition-all duration-300 active:scale-95"
            >
               {t.nav.contact}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-black hover:text-iftiin-gold transition-colors" />
              ) : (
                <Menu className="w-6 h-6 hover:text-iftiin-gold transition-colors" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-warm-white border-b border-gray-200 py-8 px-6 flex flex-col gap-6 animate-in slide-in-from-top-2 duration-200 shadow-xl">
             <button onClick={() => navigate('SERVICES')} className="text-left text-sm font-bold tracking-widest uppercase text-black hover:text-iftiin-gold transition-colors">{t.nav.services}</button>
             <button onClick={() => navigate('ABOUT')} className="text-left text-sm font-bold tracking-widest uppercase text-black hover:text-iftiin-gold transition-colors">{t.nav.about}</button>
             <button onClick={() => navigate('CONTACT')} className="text-left text-sm font-bold tracking-widest uppercase text-black hover:text-iftiin-gold transition-colors">{t.nav.contact}</button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow w-full">
        {currentView === 'HOME' && <GeometricHome onNavigate={navigate} />}
        
        {/* Wrap other pages in container */}
        <div className={`${currentView !== 'HOME' ? 'max-w-7xl mx-auto px-6 py-16 md:py-24' : ''}`}>
           {currentView === 'CONTACT' && <ContactPage />}
           {currentView === 'PRIVACY' && <LegalPage type="PRIVACY" />}
           {currentView === 'TERMS' && <LegalPage type="TERMS" />}
           {currentView === 'IMPRESSUM' && <LegalPage type="IMPRESSUM" />}
           {currentView === 'REVOCATION' && <LegalPage type="REVOCATION" />}
           {currentView === 'MANIFESTO' && <ManifestoPage />}
           {currentView === 'SERVICES' && <ServicesPage onNavigateContact={() => navigate('CONTACT')} />}
           {currentView === 'UI_ELEMENTS' && <UIElements />}
           
           {currentView === 'ABOUT' && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-center animate-in fade-in duration-500 border-t border-b border-gray-100 py-20">
                <span className="text-iftiin-gold font-serif text-6xl mb-6">{t.about.title}</span>
                <p className="text-black font-serif text-xl italic max-w-2xl mx-auto mb-8 leading-relaxed">
                  {t.about.mission}
                </p>
                <p className="text-warm-grey max-w-2xl mx-auto leading-relaxed">
                  {t.about.subMission}
                </p>
                <div className="w-12 h-[1px] bg-black my-8"></div>
                <button 
                  onClick={() => navigate('SERVICES')} 
                  className="bg-white border border-gray-200 text-black px-10 py-4 rounded-full font-bold text-[11px] uppercase tracking-[0.2em] hover:border-black transition-all duration-300 active:scale-95"
                >
                  {t.about.returnBtn}
                </button>
              </div>
           )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-warm-white border-t border-gray-200 text-black py-20 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-xs">
            <h3 className="font-serif text-2xl font-bold mb-4">IFTIIN<span className="text-iftiin-gold">.</span></h3>
            <p className="text-warm-grey text-sm leading-relaxed">
              {t.about.mission}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12 md:gap-24 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex flex-col gap-4">
              <span className="text-iftiin-gold mb-2">{t.footer.platform}</span>
              <button onClick={() => navigate('SERVICES')} className="text-left hover:underline">{t.nav.services}</button>
              <button onClick={() => navigate('UI_ELEMENTS')} className="text-left hover:underline">UI Elements</button>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-iftiin-gold mb-2">{t.footer.company}</span>
              <button onClick={() => navigate('ABOUT')} className="text-left hover:underline">{t.nav.about}</button>
              <button onClick={() => navigate('CONTACT')} className="text-left hover:underline">{t.nav.contact}</button>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-iftiin-gold mb-2">{t.footer.legal}</span>
              <button onClick={() => navigate('PRIVACY')} className="text-left hover:underline">{t.footer.privacy}</button>
              <button onClick={() => navigate('TERMS')} className="text-left hover:underline">{t.footer.terms}</button>
              <button onClick={() => navigate('REVOCATION')} className="text-left hover:underline">{t.footer.revocation}</button>
              <button onClick={() => navigate('IMPRESSUM')} className="text-left hover:underline">{t.footer.impressum}</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-gray-100 flex justify-between items-center text-[10px] text-warm-grey uppercase tracking-widest">
          <span>{t.footer.rights}</span>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;