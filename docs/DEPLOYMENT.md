# Run and deploy TerraEcho

Requirements: Node.js 22 or later, npm. Python is only required to regenerate scientific exports; the existing exported JSON supports the website independently.

From repository root:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Data preparation runs automatically and copies the existing JSON, department polygons and EIC image into ignored public folders. The Earth texture is shipped locally.

```bash
npm run test:web
npm run typecheck
npm run build
npm start
```

For optional API integration, copy `web/.env.example` to `web/.env.local` and set `FIRMS_MAP_KEY` and/or `TERRAECHO_PYTHON_API_URL`. Restart the development server. Do not use a `NEXT_PUBLIC_` prefix for these values.

## Vercel configuration

Import `Yamile26/TerraEcho` and select the implementation branch or merge its PR first. Select **Root Directory: `web`**, **Framework: Next.js**, **Build Command: `npm run build`**, and the default **Output Directory: `.next`**. The repository uses npm workspaces and has a root lockfile; install from the workspace root (`cd .. && npm ci` if an explicit install override is needed). Enable **Include source files outside of the Root Directory in the Build Step** so `prepare-data.mjs` can read sibling `data/` exports. This follows the [Vercel monorepo guidance](https://vercel.com/docs/monorepos/monorepo-faq). Verify the build log includes the data preparation message. `outputFileTracingIncludes` keeps the exported score JSON available to the server route. These settings are prepared for a future deployment; they have not been validated against a live Vercel project.

Set secrets in the hosting provider's environment settings, never in GitHub source or client code. For production use with many visitors, replace the per-process FIRMS budget with a shared limiter/cache and restrict deployment logs from capturing credential-bearing upstream URLs.

## Node host or Docker host

This is a standard Next.js application. It needs a Node runtime for `/api/fires`; a static-only export does not preserve API routes. Run `npm ci && npm run build` from repository root, then `npm start`, with `PORT` set by your host. Retain `web/public/` and `.next/` together with dependencies. Existing Python processing can run on a separate host or as a scheduled batch; the web page does not require Python to start.

## Verification after deployment

1. `/api/health` returns 200 without exposing secrets.
2. `/api/fires?year=2026` returns 44 weeks; 2025 returns 52. Unexported years return 404.
3. Explorer, regional selection, timeline, CSV and EIC audio work over HTTPS.
4. Test the accelerated Three.js scene on a WebGL-capable device and the compatible renderer on another device.
5. Check mobile width and keyboard focus; audio starts only after a visitor action.

No production deployment was created with this implementation. Hosting remains a separate step, as requested.
