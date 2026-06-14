# Security

Three slopstopper-managed surfaces here: response headers (in
[`public/_headers`](../../public/_headers)), secrets allowlist (in
[`.gitleaks.toml`](../../.gitleaks.toml)), and DAST suppressions (in
[`.zap/rules.tsv`](../../.zap/rules.tsv)). Every per-path CSP relaxation is documented in
[`CSP_EXCEPTIONS.md`](CSP_EXCEPTIONS.md) and cross-checked against the headers file by
`ss:hygiene:csp-exceptions`.

## Response headers

`public/_headers` ships at the root and Cloudflare reads it per path. Two concerns mixed
into one file:

- **Cache policy** — HTML revalidates against the Worker (`Cache-Control: public, max-age=0,
  must-revalidate`) so a deploy clears stale pages from the edge; content-hashed assets under
  `/_astro/*` are immutable.
- **Security baseline** — CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS. Site-wide rules go under the `/*` path; per-path overrides go under their own path.

The site-wide baseline is documented inline in `public/_headers`; the per-path relaxations
are documented (and validated against) `CSP_EXCEPTIONS.md`.

## Secrets allowlist

`.gitleaks.toml` extends the default Gitleaks ruleset with project-specific allowlists for
content that *looks* like a credential but isn't:

- Documented vendor sample keys (e.g. the Cosmos DB Emulator account key, which is published
  by Microsoft and not a real credential).
- Tutorial files that need to show fake credentials for the lesson to make sense.

Every allowlist entry has a `description` field naming *what* it's allowing and *why*.
Don't add an entry without one — the next person reviewing this file should be able to tell
the difference between a deliberate exemption and a missed credential leak in two lines of
context.

## DAST suppressions

`.zap/rules.tsv` lists OWASP ZAP plugin IDs to mark `IGNORE` for known-and-accepted
findings. Each entry has a comment line above it explaining the policy choice:

- `10049 IGNORE` (Storable but Non-Cacheable Content) — deliberate HTML revalidation policy.
- `10055 IGNORE` (CSP: script-src unsafe-inline) — GTM bootstraps via an inline script;
  acceptable trade-off vs the alternative (nonce dance for a static site).

The `ss:security:dast` task reads this file and silences matching findings before reporting.
Don't add an entry without the policy justification above it.
