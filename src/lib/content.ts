import { featuredArticles as loadFeaturedArticles, publishedArticles as loadPublishedArticles } from './articles';

export const publishedArticles = loadPublishedArticles;
export const featuredArticles = loadFeaturedArticles;

export const formatDate = (date: Date) => new Intl.DateTimeFormat('de-DE', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(date);
