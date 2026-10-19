# Deployment Standards

## Frontend Cache Strategy

### How it works

Vite bakes a unique content hash into every JS and CSS filename at build time
(e.g. `assets/index-BEUwJNcu.js`).  The hash is derived from the file content,
so it changes automatically whenever the source code changes.

Nginx uses this property to serve two distinct cache policies:

| File | Cache-Control | Reason |
|---|---|---|
| `/app/index.html` | `no-cache, no-store, must-revalidate` | Entry point — always re-fetched so the browser picks up new hashed bundle references |
| `/app/assets/*.js` | `public, max-age=31536000, immutable` | Content-hashed — safe to cache for 1 year |
| `/app/assets/*.css` | `public, max-age=31536000, immutable` | Content-hashed — safe to cache for 1 year |
| `/app/assets/*.map` | `public, max-age=31536000, immutable` | Content-hashed source maps |
| `/app/*.svg`, `/app/*.ico` | `public, max-age=86400` | Not hashed — conservative 1-day TTL |

### When to rebuild the frontend

Run `npm run build` (from the `frontend/` directory) whenever:

- Any TypeScript / React source file changes
- Any `frontend/src/` file changes
- `VITE_API_URL` or any other `VITE_*` env variable changes (they are baked into the bundle at build time)
- `frontend/package.json` dependencies change (run `npm install` first)

The build writes directly to `backend/public/app/` which Nginx serves via the
Docker volume mount.  No container restart is needed after a rebuild.

### When browser cache is invalidated automatically

Because every JS/CSS filename contains a content hash, **browsers automatically
pick up new bundles after the next page load** — no manual cache busting is
needed.  The only file that is re-fetched on every visit is `index.html`
(served with `no-cache`), which then loads the current hashed bundle filenames.

Cache invalidation happens automatically when:

- Any source file changes → Vite emits a new hash → filename changes → browser
  downloads the new file even if the old one is cached.

No action is required from the user or the operations team.

### How to force a hard refresh (troubleshooting)

If you suspect the browser is serving a stale version of the application:

1. **Hard refresh** — `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (macOS).
   Forces the browser to bypass its cache and re-fetch all resources for the current page.

2. **Clear site data** — Open DevTools → Application → Storage → Clear site data.
   Removes all cached files, cookies, and local storage for the origin.

3. **Incognito / private window** — Opens a session with no existing cache.
   Useful for confirming what a first-time visitor sees.

### Deploying a new build

```bash
# 1. Install dependencies (only when package.json changed)
cd frontend && npm install

# 2. Build the SPA
npm run build
# Output goes to: backend/public/app/

# 3. Nginx picks up the new files immediately — no restart needed.
#    The volume mount backend/public/app → /var/www/html/public/app is live.

# 4. Verify the new bundle hash in the built index.html:
grep 'assets/' backend/public/app/index.html
```

### Docker image builds

When building a Docker image for production (`docker compose build`), the
Dockerfile Stage 2 runs `npm run build` inside the image and copies the output
to `/backend/public/app`.  Stage 3 then copies that directory into the runtime
image at `/var/www/html/public/app`.

The Nginx volume mount in `docker-compose.yml` (`./backend/public:/var/www/html/public:ro`)
overrides the image's baked-in files in development.  In production (no bind mount),
the image's own build artefacts are served.
