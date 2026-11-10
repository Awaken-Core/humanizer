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

Copy the contents of `apps/client/.next/standalone/` into `/opt/humanizer/` on the VM, preserving its directory structure. The entry point is `/opt/humanizer/apps/client/server.js`. Install a supported Node.js version compatible with the dependencies (Node 22.12+), Nginx, and create a dedicated `humarizer` system user with access to the artifact and write access to `.next/cache`.

The GitHub deployment workflow runs the app through PM2 as `humarizer` and writes runtime configuration into the private release directory. It disables the previous `humanizer.service` during migration, configures PM2 startup on reboot, and saves the process list. Inspect the app as `humarizer` (without sudo):

```sh
pm2 status humanizer
pm2 logs humanizer
```

PM2 runs one process with a 512 MiB V8 heap limit. This does not cap total process memory. Monitor memory and latency; increase VM size if traffic or document processing exhausts capacity.

Configure Nginx for your domain with HTTPS certificates and proxy requests to `127.0.0.1:3000`. Open public ports 80/443; keep port 3000 private. Overwrite `X-Forwarded-For` with `$remote_addr` for trustworthy anonymous rate limits when clients connect directly to Nginx. Allow a 180-second proxy read timeout for AI tools and disable proxy buffering. Adjust proxy trust if adding a load balancer.

## GitHub Actions deployment

For temporary access without a domain, set the GitHub Secret `NEXT_PUBLIC_APP_BASE_URL` to `http://34.170.152.179` and `GCP_HOST` to `34.170.152.179`, then redeploy. Manage Nginx directly on the VM: proxy port 80 to `127.0.0.1:3000`. Deployment does not modify Nginx. Allow inbound TCP 80 in GCP and any VM firewall. Google OAuth requires a suitable domain/HTTPS configuration and will not work with this temporary public HTTP IP origin. Use HTTPS before handling sensitive production data.

`.github/workflows/deploy.yml` runs on pushes to `release/prod` and manual dispatch. It builds on Ubuntu, connects as `humarizer`, and deploys to `/home/humarizer/apps/humanizer/releases/`. A `current` symlink selects the active release. The workflow replaces only the PM2 process named `humanizer`, checks `/api/auth/ok` (including MongoDB initialization), and restores the previous release if the check fails. Old releases are retained; remove obsolete releases periodically to manage disk usage.

Before the first deployment, install Node.js 22.12+ (Node 22 is used by CI), PM2, curl, tar, and Nginx on the VM. Ensure `node` and `pm2` are available on the noninteractive SSH PATH. Ensure `humarizer` can SSH with the installed public key, write to its home directory, and use passwordless sudo for PM2 boot setup and migration from the old service. Allow SSH from the GitHub runner; ordinary GitHub-hosted runners do not have a single fixed source IP. This workflow uses direct SSH, not GCP service-account authentication or IAP.

In GitHub repository Settings → Secrets and variables → Actions, add:

- Secret `GCP_SSH_PRIVATE_KEY`: the complete private key matching the public key installed on the VM.
- Secret `GCP_SSH_PASSPHRASE`: the private key's passphrase. The workflow unlocks the key in a temporary SSH agent; leave this secret unset for an unencrypted key.
- Secret `GCP_SSH_KNOWN_HOSTS`: the VM's trusted SSH host-key entry. Obtain it through a trusted connection and verify its fingerprint with the VM. For a non-default SSH port, use a `[HOST]:PORT` known-hosts entry.
- Secret `GCP_HOST`: VM external IPv4 address or hostname. Secret `SSH_PORT`: SSH port, usually `22`.
- Add all application settings listed below as repository Secrets, using their exact environment variable names. The workflow reads only Secrets, including public settings such as `NEXT_PUBLIC_APP_BASE_URL` and `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

Runtime credentials are written as JSON with restricted permissions and loaded before the standalone server starts. They are transferred over SSH separately from the build archive. The workflow does not configure DNS, Nginx, TLS, Atlas network access, or GCP firewall rules. Do not trigger deployment until those VM prerequisites are ready.

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
