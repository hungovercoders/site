// Strip markdown noise from a post body and return the first chunk of prose
// suitable for use as a listing blurb. Stays at a word boundary and appends an
// ellipsis if truncated.

export function excerpt(body: string | undefined, max = 220): string {
	if (!body) return '';
	let s = body;
	// Remove fenced code blocks first (their inner content shouldn't leak)
	s = s.replace(/```[\s\S]*?```/g, ' ');
	// Inline code: keep the text inside
	s = s.replace(/`([^`]+)`/g, '$1');
	// Images: drop entirely
	s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ');
	// Markdown links: keep the visible text
	s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	// Strip HTML tags
	s = s.replace(/<[^>]+>/g, ' ');
	// Headings, blockquote markers, list bullets, table pipes
	s = s.replace(/^#{1,6}\s+/gm, '');
	s = s.replace(/^>\s?/gm, '');
	s = s.replace(/^[-*+]\s+/gm, '');
	s = s.replace(/^\d+\.\s+/gm, '');
	s = s.replace(/^\|.*\|$/gm, ' ');
	// Emphasis markers
	s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
	s = s.replace(/__([^_]+)__/g, '$1');
	s = s.replace(/\*([^*]+)\*/g, '$1');
	s = s.replace(/_([^_]+)_/g, '$1');
	// Collapse whitespace
	s = s.replace(/\s+/g, ' ').trim();
	if (s.length <= max) return s;
	const cut = s.slice(0, max).replace(/\s+\S*$/, '');
	return cut + '…';
}
