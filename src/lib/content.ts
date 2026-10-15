import { getCollection } from 'astro:content';
export async function publishedArticles() {
  const all = await getCollection('articles', ({data}) => data.status === 'published');
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
export const formatDate = (date: Date) => new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(date);
