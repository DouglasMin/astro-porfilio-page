import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { notionLoader } from 'notion-astro-loader';
import { rehypeNotionImages } from '../lib/rehype-notion-images';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.date(),
    featured: z.boolean().default(false),
    tags: z.array(z.string()),
    github: z.string().url().optional(),
    demo: z.string().url().optional(),
    order: z.number().default(999),
    category: z.enum(['personal', 'client', 'portfolio']).default('personal'),
  }),
});

const blog = defineCollection({
  loader: notionLoader({
    auth: import.meta.env.NOTION_TOKEN,
    database_id: import.meta.env.NOTION_DATABASE_ID,
    filter: {
      property: 'Published',
      checkbox: { equals: true },
    },
    sorts: [{ property: 'Published Date', direction: 'descending' }],
    // Swap expiring Notion S3 URLs for the WebP copies from scripts/sync-notion-images.ts
    rehypePlugins: [rehypeNotionImages],
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experience' }),
  schema: z.object({
    title: z.string(),
    company: z.string(),
    period: z.string(),
    role: z.string().optional(),
    type: z.enum(['work', 'project', 'research']),
    order: z.number(),
    featured: z.boolean().default(false),
    lang: z.enum(['ko', 'en']),
  }),
});

export const collections = { projects, blog, experience };
