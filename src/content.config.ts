import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    pillar: z.enum(['systems-power', 'skills-agency']),
    format: z.enum(['essay', 'note', 'map', 'deconstruct', 'research', 'ai-domain', 'capability', 'field-note', 'question', 'video']).default('essay'),
    status: z.enum(['draft', 'published']).default('draft'),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    sources: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
  }),
});
export const collections = { articles };
