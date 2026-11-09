# Humanizer

Next.js on Node.js, deployed to a GCP Compute Engine e2-micro VM.

## Development

Run `bun install --frozen-lockfile`, copy `apps/client/.env.example` to `apps/client/.env.local`, configure credentials, then run `bun run dev`.

## VM deployment

Run one Node process behind Nginx with HTTPS. Use hosted MongoDB Atlas and Upstash rather than installing databases on this small VM. Build on a Linux x64 CI runner or larger Linux machine, then transfer the standalone artifact. Do not deploy Windows artifacts to Linux or build alongside production on the VM.

Set `NEXT_PUBLIC_APP_BASE_URL` to the production HTTPS origin before building. All `NEXT_PUBLIC_*` variables are embedded at build time and require a rebuild to change.

```sh
bun install --frozen-lockfile
bun run build
cp -r apps/client/public apps/client/.next/standalone/apps/client/public
cp -r apps/client/.next/static apps/client/.next/standalone/apps/client/.next/static
```

Copy the contents of `apps/client/.next/standalone/` into `/opt/humanizer/` on the VM, preserving its directory structure. The entry point is `/opt/humanizer/apps/client/server.js`. Install a supported Node.js version compatible with the dependencies (Node 22.12+), Nginx, and create a dedicated `humanizer` system user with access to the artifact and write access to `.next/cache`.

Create `/etc/humanizer.env` using `.env.example`, with production values and `NODE_ENV=production`; restrict it to root with `chmod 600`. Copy `deploy/humanizer.service` to `/etc/systemd/system/`, then run:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now humanizer
sudo journalctl -u humanizer
```

The service runs one process with a 512 MiB V8 heap limit. This does not cap total process memory. Monitor memory and latency; increase VM size if traffic or document processing exhausts capacity.

Adapt `deploy/nginx.conf` to your domain and configure HTTPS certificates. Open public ports 80/443; keep port 3000 private. The example assumes clients connect directly to Nginx and overwrites forwarded IP headers for trustworthy anonymous rate limits. Adjust proxy trust if adding a load balancer.

## Database and APIs

- `MONGODB_URI`: Atlas URI including a database name. Allow the VM's static egress IP in Atlas network access. MongoDB shares a pool of at most five connections per process with bounded connection/pool wait timeouts. Automatic indexing is disabled; provision schema indexes separately.
- `NEXT_PUBLIC_APP_BASE_URL`: same production HTTPS origin at build and runtime.
- `BETTER_AUTH_SECRET`: random secret of at least 32 characters.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: configure the production origin and callback `https://YOUR_DOMAIN/api/auth/callback/google` in Google OAuth settings.
- `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`: valid provider credentials and available model.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: required for production AI endpoints. Missing or unreachable Redis returns HTTP 503.
- `SERPER_API_KEY`, `SERPER_BASE_URL`: optional plagiarism web search settings.

Do not set `SKIP_ENV_VALIDATION` or `ALLOW_UNLIMITED_IN_PRODUCTION` in production. Deployment does not migrate the database or create external services.

## Verification

Run `bun run test:db`, `bun test apps/client/scripts/test-pr-review-regression.test.ts`, and `bun run build`. From `apps/client`, run `node --import tsx scripts/check-services.ts` with the target environment loaded to check MongoDB/Redis pings and DeepSeek model availability without generating text. It does not verify database write permissions or Google OAuth redirects.

After deployment, test Google login, document create/edit/reload, each AI tool, plagiarism retrieval, and rate limiting through the HTTPS domain. Local checks cannot verify the VM's network access or production domain configuration.
