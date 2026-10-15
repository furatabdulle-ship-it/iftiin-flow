/** Edit these settings instead of changing layouts. */
export const site = {
  name: 'iftiin flow.',
  shortDescription: 'Ideen, Analysen und Lernräume für eine Welt im Wandel.',
  mission: 'Wir erkunden, wie Wissen, Technologie und Institutionen unsere Fähigkeit prägen, zu verstehen, zu urteilen und zu handeln.',
  email: '', // verified public contact address; enables Contact link when set
  bookingUrl: '', // later: Calendly, Cal.com or your booking page
  shopUrl: '', // later: Stripe Payment Link, Lemon Squeezy, shop page etc.
  newsletterUrl: '', // later: newsletter signup URL
  showBooking: false,
  showShop: false,
  showNewsletter: false,
  showResearch: false,
  showLearning: false,
  showTools: false,
};

export const pillars = [
  { slug: 'knowledge-agency', number: '01', name: 'Knowledge & Agency', question: 'Wie wird aus Information Verständnis, Urteilskraft und Handlungsfähigkeit?', description: 'Wissen, Expertise, Entscheidungsfähigkeit und menschlicher Handlungsspielraum.' },
  { slug: 'ai-domain', number: '02', name: 'AI × Domain', question: 'Was verändert KI in echten Fachgebieten, Aufgaben und Rollen?', description: 'Fachwissen, Workflows, Verifikation, Verantwortung und neue Kompetenzen.' },
  { slug: 'institutions-work-power', number: '03', name: 'Institutions, Work & Power', question: 'Wie prägen Institutionen und Anreize technologische Veränderungen?', description: 'Governance, Arbeit, Infrastruktur, Regeln und Machtverhältnisse.' },
  { slug: 'human-capability', number: '04', name: 'Human Capability', question: 'Welche Fähigkeiten bleiben wichtig oder werden neu benötigt?', description: 'Lernen, Kommunikation, Kontextdenken, Delegation und Urteilskraft.' },
  { slug: 'culture-meaning', number: '05', name: 'Culture & Meaning', question: 'Wie verändern Technologien Sprache, Kultur und Öffentlichkeit?', description: 'Philosophie, Medien, Sprache, Kunst und gesellschaftliche Narrative.' },
] as const;

export const formatNames: Record<string, string> = {
  essay: 'Essay', note: 'IFTIIN Note', map: 'IFTIIN Map', deconstruct: 'Deconstruct',
  research: 'Research Note', 'ai-domain': 'AI × Domain', capability: 'Capability Note',
  'field-note': 'Field Note', question: 'Questions Worth Asking',
};
