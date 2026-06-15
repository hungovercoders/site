#!/usr/bin/env node
// Drives chromium headless against the actual GitHub PR + Actions pages
// and captures real screenshots. Uses the playwright chromium browser
// already installed for the smoke tests.

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const OUT_DIR = 'public/assets/2026-06-15-slopstopper-on-tap';
const PR_URL = 'https://github.com/hungovercoders/site/pull/29';

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'dark',
});
const page = await ctx.newPage();

// Dismiss the cookie banner if it appears, and wait for the main content.
async function settle() {
	try {
		await page.waitForLoadState('networkidle', { timeout: 15000 });
	} catch {
		/* GitHub keeps polling check status; networkidle may not fire */
	}
	// Best-effort: hide the cookie-consent banner and the sign-up CTA.
	await page.addStyleTag({
		content: `
			[data-target="cookie-consent-link.cookieConsentBanner"],
			.cookie-consent-banner,
			.js-notice,
			.flash,
			[aria-label="Sign up"],
			.signup-prompt,
			.js-signup-prompt { display: none !important; }
		`,
	}).catch(() => {});
}

async function shot(path, opts = {}) {
	const target = `${OUT_DIR}/${path}`;
	await mkdir(dirname(target), { recursive: true });
	await page.screenshot({ path: target, ...opts });
	console.log(`wrote ${target}`);
}

// 1. PR checks page — full page
await page.goto(`${PR_URL}/checks`, { waitUntil: 'domcontentloaded' });
await settle();
await page.waitForTimeout(2000); // let check icons render
await shot('step-07-pr-checks.png', { fullPage: false });

// 2. Actions tab — runs list for this branch
await page.goto(
	'https://github.com/hungovercoders/site/actions?query=branch%3Aslopstopper%2Ffresh-install-0.6.0',
	{ waitUntil: 'domcontentloaded' },
);
await settle();
await page.waitForTimeout(2000);
await shot('step-08-pr-actions.png', { fullPage: false });

// 3. A single workflow run — pick the DAST run for the latest commit on the branch
const dastRunUrl = await page.evaluate(() => {
	const links = Array.from(document.querySelectorAll('a[href*="/actions/runs/"]'));
	const dast = links.find((a) => /DAST|Dynamic Application Security/i.test(a.textContent || ''));
	return dast ? dast.href : null;
});
if (dastRunUrl) {
	await page.goto(dastRunUrl, { waitUntil: 'domcontentloaded' });
	await settle();
	await page.waitForTimeout(2000);
	// Click the DAST job in the left rail to expand its steps, if available.
	await page.locator('a:has-text("Dynamic Application Security")').first().click({ timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(1500);
	await shot('step-09-workflow-detail.png', { fullPage: false });
} else {
	console.warn('Could not find DAST run on the Actions page — step-09 not regenerated');
}

await browser.close();
console.log('done');
