# Humanizer

Next.js application deployed to Cloudflare Workers using [OpenNext](https://opennext.js.org/cloudflare/get-started).

## Development

Run `bun install`, copy `apps/client/.env.example` to `apps/client/.env.local`, configure credentials, then run `bun run dev` from the repository root.

## Cloudflare Workers

- `bun run build:worker`: build the Next.js app and Workers bundle.
- `bun run preview`: build and run locally in the Workers runtime at port 8787.
- `bun run check:worker`: build and validate deployment with Wrangler's dry run.
- `bun run test:workers`: test request isolation and database connection cleanup.
- `bun run cf-typegen`: regenerate Cloudflare binding types after configuration changes.
- `bun run deploy`: build and deploy to Cloudflare.

Use Linux, macOS, or WSL for OpenNext builds; native Windows is not fully supported by the adapter. `bun run build` remains the regular Next.js build. Node.js 22 or newer and Bun are required for builds.

### Configuration

The Worker configuration is `apps/client/wrangler.jsonc`. If you rename `humanizer`, also change the `WORKER_SELF_REFERENCE` service name to match. Static assets and Cloudflare Images are configured. No R2 bucket is required by the current configuration; add an incremental cache before introducing ISR or persistent revalidation.

For Workers preview, copy `apps/client/.dev.vars.example` to `apps/client/.dev.vars` and provide real credentials. Next.js development uses `.env.local`; Workers preview uses `.dev.vars`. These files are ignored by Git.

Set `NEXT_PUBLIC_APP_BASE_URL` to your production HTTPS origin at **build time and runtime**. Set any other `NEXT_PUBLIC_*` analytics values at build time as well; Next.js embeds them in the browser bundle. Do not deploy a build made with a localhost origin.

Configure these runtime secrets in the Cloudflare dashboard, or run `bunx wrangler secret put NAME` from `apps/client` for each:

- `MONGODB_URI`: a reachable MongoDB Atlas connection string with a database name, TLS, and network access configured for Workers.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- `DEEPSEEK_API_KEY`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: required by the existing production rate limiter; AI endpoints return 503 without them.

Configure `NEXT_PUBLIC_APP_BASE_URL` as a runtime variable too. Optional runtime settings include `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, `SERPER_API_KEY`, and `SERPER_BASE_URL`. Configure Google's authorized JavaScript origin to your production origin and callback URL to `https://YOUR-DOMAIN/api/auth/callback/google`.

MongoDB connections and authentication initialize lazily within a request. API handlers use `withDatabaseScope`, and models resolve against that request's connection. Connections close when the handler finishes, avoiding cross-request socket reuse. Wrap future database API handlers in `withDatabaseScope` too. Automatic index creation is disabled for request connections; provision the indexes declared in the model schemas as a separate database administration step before production traffic.

### Workers Builds (Git integration)

`keep_vars: true` in `apps/client/wrangler.jsonc` preserves runtime variables managed in the Cloudflare dashboard during deployments, including automatic deployments from `main`. Restore any variables removed by earlier deployments once. Store credentials as runtime Secrets, and keep public build variables configured separately in Workers Builds. Avoid adding a `vars` block for dashboard-managed values; values declared in the configuration take precedence over dashboard values.

Use repository root `/`, install command `bun install --frozen-lockfile`, build command `bun run build:worker`, and deploy command `cd apps/client && bunx opennextjs-cloudflare deploy`. Add public environment variables to build settings and runtime secrets to the Worker settings before deployment. The deploy command uses the bundle produced by the build step.

Cloudflare's Node.js compatibility flag is enabled. [MongoDB runtime guidance](https://developers.cloudflare.com/workers/databases/third-party-integrations/mongodb/) describes connection and network requirements. Live MongoDB, Google OAuth, AI, and rate limiting need to be smoke-tested with your production services after deployment.
