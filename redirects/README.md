# redirects/

301s every old `blog.hungovercoders.com/datagriff/...` URL to its new home on `hungovercoders.com/blog/...`. The Worker that does this is deployed separately from the main site Worker — it's bound to the `blog.hungovercoders.com/*` route while the main site owns the apex + `www`.

Unknown paths under the subdomain fall back to the apex homepage.

## Source of truth

`redirect-map.csv` — one row per old URL, with the new path and the redirect status code. `src/index.js` is generated from it; never hand-edit the JS.

## How to update redirects

1. Edit `redirect-map.csv` (add rows, fix typos, etc.)
2. `npm run redirects:generate` from the site root — regenerates `redirects/src/index.js`
3. Commit both files
4. `npm run redirects:deploy` from the site root — runs the generator and `wrangler deploy` against `redirects/wrangler.jsonc`

## First-time deploy

```bash
cd ~/dev/hungovercoders/site
npm install                       # wrangler is in the site devDeps
npm run redirects:deploy
```

Wrangler picks up the route from `redirects/wrangler.jsonc` (`blog.hungovercoders.com/*` on the `hungovercoders.com` zone). The zone must be active in Cloudflare with a DNS record for `blog` — a placeholder `AAAA 100::` set to Proxied is enough to attach the route to.

## Verifying after deploy

```bash
curl -sI https://blog.hungovercoders.com/datagriff/2022/07/19/environment-variables.html
# Expect: HTTP/2 301 with location: https://hungovercoders.com/blog/2022-07-19-environment-variables/

curl -sI https://blog.hungovercoders.com/some-nonsense
# Expect: HTTP/2 301 with location: https://hungovercoders.com/
```
