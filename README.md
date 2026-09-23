# Louisville Brands Outreach CRM

A React + TypeScript + Vite workspace for Louisville Jerky, Pumps, and Gym Snack. Outreach is editable. The Creator Database is derived from Outreach by a sticky Postgres gate. Trybe affiliate tabs are read-only and never feed that database.

## Run locally

1. Install Node 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local`. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `npm run dev` opens a local sample workspace. It persists sample edits in browser storage only. This mode is for interface review, not team use.
3. Run `npm run dev`. Run `npm test` and `npm run build` before deployment.

## Supabase setup

1. Create a Supabase project. Apply `supabase/migrations/001_schema.sql`, then `supabase/seed.sql` on a new project. The seed adds six illustrative Outreach rows, including a creator across two brands. Remove it before importing real data if desired.
2. Under Authentication, enable Google OAuth. Configure Google's consent screen and redirect URL for your Supabase project, and add your frontend origins to Supabase's allowed redirect URLs. Disable other sign-in providers. The database also refuses new users unless their email ends in `@louisvillebrands.com` and their provider is Google.
3. Sign in once with an allowed Google account. Promote the first administrator in the SQL editor: `update public.user_profiles set role = 'admin' where email = 'you@louisvillebrands.com';`. Admins can manage Settings, import, and delete rows. Members can edit Outreach.
4. Set frontend `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project URL and publishable/anon key. Never put service keys or Trybe keys in `VITE_` variables.
5. Set Edge Function secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOWED_EMAIL_DOMAIN`, `INTEGRATION_ENCRYPTION_KEY` (random, at least 32 characters), `RATE_LIMIT_SALT`, and `SYNC_CRON_SECRET` (random). Optionally set all three `TRYBE_API_KEY_*` values, their account IDs, `TRYBE_API_BASE_URL`, and `TRYBE_USE_MOCK=true`. Keys entered in Settings are encrypted with AES-GCM using `INTEGRATION_ENCRYPTION_KEY` and stored in `brand_integrations`. Losing the encryption key makes stored keys unrecoverable.
6. Deploy the four functions with Supabase CLI: `supabase functions deploy trybe-sync`, `supabase functions deploy trybe-admin`, `supabase functions deploy onboard`, and `supabase functions deploy import-commit`. The functions authenticate users themselves; `/onboard` is public. Confirm `supabase/config.toml` is applied.
7. For hourly scheduler checks, enable `pg_cron` and `pg_net` in Supabase. Schedule an hourly POST to `/functions/v1/trybe-sync` with header `x-cron-secret: <SYNC_CRON_SECRET>` and `{}` body. The function reads `app_settings.sync_interval_hours` (default 6) and skips each brand until its own interval elapses. Store the scheduler secret with Supabase Vault and refer to it in the cron SQL rather than embedding plaintext in job definitions. Example:

```sql
select cron.schedule('trybe-sync-check', '0 * * * *', $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/trybe-sync',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='trybe_cron_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);
```

## Frontend deployment

For free-tier deployment, connect this GitHub repository to **Netlify Free**. `netlify.toml` runs `npm run build` and publishes `dist/`; `public/_redirects` provides the SPA route fallback. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify's environment variables before the production build. Add the resulting site URL to the Supabase Auth redirect allowlist and Google OAuth authorized origins. Do not deploy `.env.local` or put service keys in Netlify's `VITE_` variables. A deployed frontend without the Supabase project and its configuration remains a sample workspace, not the shared CRM.

## Data rules

The gate inserts one `creator_memberships` row for an Outreach source when its address is nonblank and its status is Submitted, Approved, Posted, or Complete. This row is retained when status changes or the source is deleted. Identity uses lowercase email and otherwise `h:` plus normalized handle. When a previously handle-keyed record gains an email, `merge_creator_keys` rekeys memberships. The read-only `creator_database` view groups memberships and picks the latest qualifying snapshot. Trybe records have no path into this view.

The public onboarding function hashes IPs for a five-per-hour rate limit, checks a honeypot, validates data, saves the submission and upserts exactly the selected brands in one transaction. `TURNSTILE_SECRET_KEY` is optional; if enabled, add a client Turnstile widget and pass `turnstile_token` in the form payload.

The import tool accepts CSV, maps legacy columns, allows manual status mappings, flags missing handles and duplicates, and previews before commit. A merge fills empty fields on the matched row. It does not overwrite existing nonblank values. The import Edge Function processes rows in order; a later invalid row can leave earlier rows imported, so review the preview and use small batches. For a fully atomic import, move commit into a dedicated Postgres RPC.

## Verification

`npm test` covers gate predicates, identity normalization, onboarding brand routing, CSV parsing, legacy mapping, and duplicate detection. `tests/acceptance.sql` exercises the real trigger and view including status rollback, two-brand dedupe, handle-to-email merge, source deletion, and onboarding through the gate. Run it against a disposable Supabase project with `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/acceptance.sql`; it rolls back its test records. It was not run here because no Supabase project was connected.

## Assumptions and open questions

- The Trybe affiliate API URL, auth scheme, pagination, and response shape were not supplied. `RealTrybeAdapter` has a configurable base URL and a provisional `GET /creators` Bearer request. Confirm the vendor's actual contract before setting `TRYBE_USE_MOCK=false`. Public `docs.try.be` covers an unrelated spa and booking product, so it is not evidence for this affiliate API.
- The `GS Collabs` blank columns are suggested in order as Status, Samples Request?, and Delivered?. Confirm their positions in the mapping screen.
- A creator without email and handle gets a temporary `row:<id>` identity until one is added.
- Deleted source rows retain their last qualifying snapshot. The source detail drawer lists live Outreach rows and indicates that removed sources may still belong to the roster.
- No production Supabase, Google OAuth, Trybe credentials, or hosting account were provided, so remote deployment and live integration tests remain to be completed in those accounts.
