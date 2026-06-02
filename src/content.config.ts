import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.md' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		author: z.string().default('dataGriff'),
		tags: z.array(z.string()),
		description: z.string(),
		image: z.object({ path: z.string() }).optional(),
	}),
});

const training = defineCollection({
	loader: glob({
		pattern: '**/docs/*/README.md',
		base: './training-repos',
	}),
	schema: z.object({
		title: z.string(),
		series: z.string(),
		order: z.number(),
		description: z.string(),
		canonical_url: z.string().url(),
	}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		url: z.string().url().optional(),
		repo: z.string().url().optional(),
		status: z.enum(['live', 'wip', 'archived']),
		started: z.coerce.date(),
		tags: z.array(z.string()).optional(),
		order: z.number().optional(),
	}),
});

export const collections = { blog, training, projects };
