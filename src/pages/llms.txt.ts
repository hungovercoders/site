import { getCollection } from 'astro:content';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET() {
	const [posts, projects, lessons] = await Promise.all([
		getCollection('blog'),
		getCollection('projects'),
		getCollection('training'),
	]);

	const blogLines = posts
		.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
		.map((post) => `- [${post.data.title}](/blog/${post.id}/): ${post.data.description}`);

	const projectLines = projects
		.sort(
			(a, b) =>
				(a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER) ||
				a.data.title.localeCompare(b.data.title),
		)
		.map((project) => {
			const label = project.data.url
				? `[${project.data.title}](${project.data.url})`
				: `**${project.data.title}**`;
			return `- ${label}: ${project.data.description}`;
		});

	const trainingLines = [...new Set(lessons.map((lesson) => lesson.data.series))]
		.sort()
		.map((series) => `- [${series}](/training/${series}/)`);

	const body = `# ${SITE_TITLE}

> ${SITE_DESCRIPTION}

The site of dataGriff — writing on full-stack development, data engineering, DevOps and building with AI. This file follows the llmstxt.org convention: a curated map of the site's content for AI assistants. It is generated at build time from the site's content collections, so it always reflects what is currently published.

## Core pages

- [Home](/): The front page
- [About](/about/): Who dataGriff is and what this site is for
- [Blog](/blog/): All posts, newest first
- [Training](/training/): Hands-on tutorial series sourced from the learn.* repos
- [Projects](/projects/): Things built and shipped
- [Privacy](/privacy/): How the site handles data

## Blog

${blogLines.join('\n')}

## Training

${trainingLines.join('\n')}

## Projects

Every project is listed on the [projects page](/projects/).

${projectLines.join('\n')}
`;

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
