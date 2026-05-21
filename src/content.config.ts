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
	}),
});

export const collections = { blog };
