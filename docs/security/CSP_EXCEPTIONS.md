# CSP Exceptions

Per-path Content Security Policy relaxations applied in [`public/_headers`](../../public/_headers).
The `ss:hygiene:csp-exceptions` check parses both this file and the headers file; every
exception must appear in both, or the check fails.

## How it works

`public/_headers` defines a baseline CSP under `/*` and may override it for specific paths.
Each override is an *exception* to the baseline — usually relaxing a directive to allow a
specific vendor's resources.

For every per-path override in the headers file, this document must have a matching
`### /<path>` section explaining:

1. **What's relaxed** — the directive(s) that differ from the baseline.
2. **Why** — the vendor or feature requiring the relaxation.
3. **Risk + mitigation** — what an attacker could do, and what limits that.

## Exceptions

(none yet — the site uses the baseline CSP everywhere)

When the first exception lands, follow this template — the heading must be `### /` followed
by the exact path-pattern from `public/_headers`, so the `ss:hygiene:csp-exceptions` parser
matches the two:

<!-- template-start (parser ignores anything inside an HTML comment) -->
<!--
    ### /admin/*

    **Relaxed:** `script-src` adds `https://vendor.example.com`

    **Reason:** <vendor/feature> requires <reason>.

    **Risk + mitigation:** <attacker scenario>; limited by <what limits it>.
-->
<!-- template-end -->
