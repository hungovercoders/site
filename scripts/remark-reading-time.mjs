import { toString } from 'mdast-util-to-string';
import getReadingTime from 'reading-time';

// Code a reader has to open is reference, not reading, so nothing between a
// <details> and its </details> counts towards the reading time.
function withoutCollapsed(tree) {
	const kept = [];
	let depth = 0;
	for (const node of tree.children ?? []) {
		if (node.type === 'html') {
			const opens = (node.value.match(/<details[\s>]/g) ?? []).length;
			const closes = (node.value.match(/<\/details>/g) ?? []).length;
			if (depth === 0 && opens === 0) kept.push(node);
			depth = Math.max(0, depth + opens - closes);
			continue;
		}
		if (depth === 0) kept.push(node);
	}
	return { ...tree, children: kept };
}

export function remarkReadingTime() {
	return function (tree, { data }) {
		const text = toString(withoutCollapsed(tree));
		const { minutes } = getReadingTime(text);
		data.astro.frontmatter.minutesRead = Math.max(1, Math.round(minutes));
	};
}
