import React, { useState } from 'react';
import { Send, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5ap2MxYZps2rTPsQAro6dBm4fkW38p3W851WpYqWJ80zHUq_5WsKhaDPmRqQLqlrO/exec"
export const ContactPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [formState, setFormState] = useState<'IDLE' | 'SUBMITTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const form = e.currentTarget as HTMLFormElement;
    const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement;
    const emailVal = emailInput?.value || '';

    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setEmailError(language === 'DE' ? "Ungültige E-Mail-Adresse" : "Invalid email address");
      return;
    }

    const formData = {
      firstName: (form.querySelectorAll('input[type="text"]')[0] as HTMLInputElement).value,
      lastName: (form.querySelectorAll('input[type="text"]')[1] as HTMLInputElement).value,
      email: emailVal,
      type: (form.querySelector('select') as HTMLSelectElement).value,
      message: (form.querySelector('textarea') as HTMLTextAreaElement).value,
      website: honeypot // Honeypot: echte Nutzer lassen das leer
    };

    setFormState('SUBMITTING');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      // no-cors means we can't read the response, but if no exception = success
      setFormState('SUCCESS');
    } catch (error) {
      console.error('[Contact] Submission error:', error);
      setFormState('ERROR');
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <header className="mb-16 border-b border-black pb-8">
        <span className="inline-block border border-black text-black px-4 py-1.5 rounded-full font-bold text-[10px] tracking-[0.25em] uppercase mb-6">
          {t.contact.label}
        </span>
        <h2 className="font-serif text-5xl font-medium leading-[1.1] mb-6 text-black">
          {t.contact.title}
        </h2>
        <p className="text-gray-600 font-serif text-lg leading-relaxed max-w-2xl">
          {t.contact.desc}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

        {/* Contact Form */}
        <div className="lg:col-span-7">
          {formState === 'SUCCESS' ? (
            <div className="bg-gray-50 border-l-4 border-gold-500 p-8 rounded-2xl">
              <h3 className="font-serif text-2xl font-bold mb-4">{t.contact.successTitle}</h3>
              <p className="text-gray-600 mb-6">{t.contact.successDesc}</p>
              <button
                onClick={() => setFormState('IDLE')}
                className="bg-white border border-gray-200 text-black px-8 py-4 rounded-full font-bold text-[11px] uppercase tracking-[0.2em] hover:border-black transition-all duration-300 active:scale-95"
              >
                {t.contact.sendAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Honeypot - unsichtbar für echte Nutzer, Bots füllen es aus */}
              <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.contact.fName}</label>
                  <input required type="text" className="w-full bg-transparent border-b border-gray-300 py-2 text-black focus:outline-none focus:border-black transition-colors rounded-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.contact.lName}</label>
                  <input required type="text" className="w-full bg-transparent border-b border-gray-300 py-2 text-black focus:outline-none focus:border-black transition-colors rounded-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t.contact.email} <span className="text-gray-300 normal-case tracking-normal opacity-50 ml-1">(Optional)</span>
                </label>
                <input
                  type="email"
                  className={`w-full bg-transparent border-b py-2 text-black focus:outline-none transition-colors rounded-none ${emailError ? 'border-red-500' : 'border-gray-300 focus:border-black'}`}
                  onChange={() => setEmailError(null)}
                />
                {emailError && (
                  <span className="text-red-500 text-[9px] font-bold uppercase tracking-widest">{emailError}</span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.contact.type}</label>
                <select className="w-full bg-transparent border-b border-gray-300 py-2 text-black focus:outline-none focus:border-black transition-colors rounded-none appearance-none">
                  {t.contact.types.map((type, idx) => (
                    <option key={idx}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.contact.brief}</label>
                <textarea required rows={4} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl text-black focus:outline-none focus:border-black transition-colors resize-none"></textarea>
              </div>

              {formState === 'ERROR' && (
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">
                  {language === 'DE' ? 'Fehler beim Senden. Bitte versuche es erneut.' : 'Submission failed. Please try again.'}
                </p>
              )}

              <button
                type="submit"
                disabled={formState === 'SUBMITTING'}
                className="bg-black text-white px-10 py-4 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-iftiin-gold transition-all duration-300 w-full md:w-auto flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                {formState === 'SUBMITTING' ? t.contact.transmitting : t.contact.submit} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-5 space-y-12">

          <div className="border border-gray-200 p-8 rounded-[32px] hover:border-gold-500 transition-colors">
            <h4 className="font-serif text-xl font-bold mb-6 flex items-center gap-3">
              <Mail className="w-5 h-5 text-gold-500" /> {t.contact.sidebar.general}
            </h4>
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-1">General Inquiries</span>
                <a href="mailto:contact@iftiin-flow.com" className="font-serif text-lg hover:text-gold-600 transition-colors">contact@iftiin-flow.com</a>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 p-8 rounded-[32px] hover:border-gold-500 transition-colors">
            <h4 className="font-serif text-xl font-bold mb-6 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gold-500" /> {t.contact.sidebar.office}
            </h4>
            <div className="font-serif text-lg text-gray-600 space-y-1">
              <p>Gärtnerweg 62</p>
              <p>60322 Frankfurt am Main</p>
              <p className="text-xs font-sans text-gray-400 uppercase tracking-widest mt-2">Germany</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
