// Helpers shared by the listing pages (home, blog, tags).
import readingTime from 'reading-time';

// Collapsed <details> blocks are left out, as they are on the post's own page
// (scripts/remark-reading-time.mjs): code a reader has to open is not reading.
export function minutesToRead(body?: string): number {
	const read = (body ?? '').replace(/<details[\s>][\s\S]*?<\/details>/g, '');
	return Math.max(1, Math.round(readingTime(read).minutes));
}

export const tagSlug = (tag: string) => tag.toLowerCase().replace(/\s+/g, '-');

// The site-wide "hungovercoders" tag is on every post and says nothing.
export const visibleTags = (tags?: string[]) =>
	(tags ?? []).filter((t) => t.toLowerCase() !== 'hungovercoders');
