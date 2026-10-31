import { featuredArticles as loadFeaturedArticles, publishedArticles as loadPublishedArticles } from './articles';
import { formatDate as formatLocalizedDate, type Locale } from './i18n';

export const publishedArticles = loadPublishedArticles;
export const featuredArticles = loadFeaturedArticles;

export const formatDate = (date: Date, locale: Locale = 'de') => formatLocalizedDate(date, locale);
