/** Edit these settings instead of changing layouts. */
export const site = {
  name: 'iftiin flow.',
  shortDescription: 'Ideen, Analysen und Lernräume für eine Welt im Wandel.',
  mission: 'Wir erkunden, wie Wissen, Technologie und Institutionen unsere Fähigkeit prägen, zu verstehen, zu urteilen und zu handeln.',
  email: 'furat.abdulle@iftiin-flow.com',
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
  { slug: 'systems-power', number: '01', name: 'Systems & Power', question: 'Verstehe, wie Technologie, Arbeit, Medien und Macht zusammenwirken.', description: 'KI und ihre gesellschaftlichen Folgen, Organisationslogiken, Wissensproduktion, Propaganda und kulturelle Narrative.' },
  { slug: 'skills-agency', number: '02', name: 'Skills & Agency', question: 'Denke eigenständig, entwickle Ideen und bringe sie wirksam in die Welt.', description: 'Kritisches Denken, KI-Anwendung, Kreativität, Ausdruck, Storytelling und das Navigieren in Organisationen.' },
] as const;

export const formatNames: Record<string, string> = {
  essay: 'Essay', note: 'IFTIIN Note', map: 'IFTIIN Map', deconstruct: 'Deconstruct',
  research: 'Research Note', 'ai-domain': 'AI × Domain', capability: 'Capability Note',
  'field-note': 'Field Note', question: 'Questions Worth Asking', video: 'Video',
};
