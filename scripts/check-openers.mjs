// Gate: recent blog posts do not all open the same way.
// The site's listings show the start of each post, so four posts in a row starting
// "I wanted" read as one template. This compares the first words of the newest
// posts and fails when the newest repeats one of the others.
//   node scripts/check-openers.mjs            check the newest post against the 3 before it
//   node scripts/check-openers.mjs --list     print the opening words of the last 8 posts
import { readdirSync, readFileSync } from "node:fs";

const DIR = "src/content/blog";
const WORDS = 2; // how many opening words make "the same opener"
const WINDOW = 3; // how many earlier posts the newest is compared with

/** The first words of a post's body: after the frontmatter, links and markup stripped. */
export function opener(markdown, words = WORDS) {
	const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
	const first = body.split("\n").find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";
	const plain = first.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`>]/g, "");
	return plain.trim().split(/\s+/).slice(0, words).join(" ").toLowerCase().replace(/[.,;:!?]+$/, "");
}

/** The newest post's opener, if one of the earlier posts in the window opens the same way. */
export function repeated(posts) {
	const [newest, ...earlier] = posts;
	if (!newest) return undefined;
	const same = earlier.filter((post) => post.opener === newest.opener);
	return same.length > 0 ? { newest, same } : undefined;
}

const posts = readdirSync(DIR)
	.filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name))
	.sort()
	.reverse()
	.map((name) => ({ name, opener: opener(readFileSync(`${DIR}/${name}`, "utf8")) }));

if (process.argv.includes("--list")) {
	for (const post of posts.slice(0, 8)) console.log(`${post.opener.padEnd(24)} ${post.name}`);
	process.exit(0);
}

const clash = repeated(posts.slice(0, WINDOW + 1));
if (clash) {
	console.error(
		[
			`blog:openers failed - ${clash.newest.name} opens "${clash.newest.opener} ..." like:`,
			...clash.same.map((post) => `  - ${post.name}`),
			`Open it another way that is true for the post (the voice guide's opener formulas), so the listing does not read as one template.`,
		].join("\n"),
	);
	process.exit(1);
}
console.log(`blog:openers ok - "${posts[0]?.opener} ..." differs from the ${Math.min(WINDOW, posts.length - 1)} posts before it`);
