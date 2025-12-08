import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.date(),
    featured: z.boolean().default(false),
    image: z.string().url(),
    tags: z.array(z.string()),
    github: z.string().url().optional(),
    demo: z.string().url().optional(),
    order: z.number().default(999),
    category: z.enum(['personal', 'client']).default('personal'),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.date(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
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
