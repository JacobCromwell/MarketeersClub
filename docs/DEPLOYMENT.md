# Deployment Guide

Takes you from an empty machine to a live deployment. **Docker is not required anywhere in this guide.**

- [Prerequisites](#prerequisites)
- [1. Create the Supabase project](#1-create-the-supabase-project)
- [2. Apply the database schema](#2-apply-the-database-schema)
- [3. Configure the local app](#3-configure-the-local-app)
- [4. Verify locally](#4-verify-locally)
- [5. Deploy to Cloudflare Pages](#5-deploy-to-cloudflare-pages)
- [6. Point Supabase Auth at production](#6-point-supabase-auth-at-production)
- [Ongoing operations](#ongoing-operations)
- [Optional: local stack with Docker](#optional-local-stack-with-docker)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 22.12+ | `node --version` |
| pnpm 10+ | `corepack enable && corepack prepare pnpm@10.19.0 --activate` |
| Supabase account | Free tier is enough — <https://supabase.com> |
| Cloudflare account | Free tier is enough — <https://cloudflare.com> |
| Docker | **Not needed.** Only for the optional local stack |

The Supabase CLI is already a dev dependency of this repo, so there is nothing to install globally and no
`pnpm dlx` downloads. Run it through the `db:*` scripts, or directly with `pnpm exec supabase ...`.

```bash
pnpm install
pnpm exec supabase --version
```

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com/dashboard> and choose **New project**.
2. Set a name (for example `marketeers-club`) and pick a region close to your users.
3. Generate a **database password** and store it in a password manager. You need it once in step 2 and it
   cannot be retrieved later, only reset.
4. Wait for provisioning to finish.

Then collect two values from **Project Settings → API**:

| Value | Used as | Safe in the browser? |
| --- | --- | --- |
| Project URL | `VITE_SUPABASE_URL` | Yes |
| `anon` / publishable key | `VITE_SUPABASE_ANON_KEY` | Yes — protected by Row Level Security |
| `service_role` key | **not used by this app** | **No — never expose it** |

> The `service_role` key bypasses every security policy. It must never appear in `.env`, in the repo, or
> in Cloudflare's build variables.

Email sign-up is enabled by default, **and so is email confirmation** on hosted projects. While testing,
turn confirmation **off** under **Authentication → Sign In / Providers → Email → Confirm email**, then
turn it back on before real users join. With it on, new accounts get no session until the link is clicked,
and Supabase's built-in email service is limited to **2 messages per hour**, after which signups fail with
`email rate limit exceeded`.

The dashboard has renamed this section over time; it is the page at `/auth/providers`, listed in the
sidebar as **Sign In / Providers**.

Check the current setting at any time:

```bash
curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

`"mailer_autoconfirm": true` means confirmation is off and accounts are usable immediately.

## 2. Apply the database schema

The schema in [supabase/migrations](../supabase/migrations) creates every table, index, Row Level Security
policy, and workflow function. Push it to the hosted project:

```bash
pnpm exec supabase login   # opens a browser to authorize the CLI
pnpm db:link               # select your project, then enter the database password
pnpm db:push               # applies all migrations
```

`pnpm db:link` writes local-only linking state to `.supabase/`, which is gitignored.

Confirm success in the dashboard under **Table Editor** — you should see `profiles`, `teams`,
`team_members`, `inventory_items`, `trips`, `agreements`, `agreement_messages`, and `notifications`.

<details>
<summary>Alternative: paste the SQL by hand (no CLI)</summary>

Open **SQL Editor → New query** in the dashboard, paste the entire contents of
`supabase/migrations/202608160001_initial_schema.sql`, and run it. This works fine, but the CLI is
preferred because it records which migrations have been applied.
</details>

### What the migration sets up

- **Row Level Security on every table**, so the anon key is safe in the browser.
- **Private inventory** — readable only by its owner, plus a seller with an agreement for that item.
- **`SECURITY DEFINER` functions** for all state changes: `invite_team_member`, `accept_team_invite`,
  `approve_agreement`, `request_agreement_change`, `report_agreement_sales`, and `settle_agreement`.
  Users hold only `select`/`insert` on `agreements`, so the approval workflow cannot be bypassed with a
  direct `UPDATE`. Internal helpers are revoked from `public` and `anon`.
- **A profile trigger** that creates a `profiles` row whenever a user signs up.
- **Realtime** on `notifications` so alerts arrive without polling.

## 3. Configure the local app

```bash
cp .env.example .env
```

```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

`.env` is gitignored. Vite exposes only variables prefixed with `VITE_`, and those are **compiled into
the JavaScript bundle** — which is exactly why only the publishable key belongs there.

## 4. Verify locally

```bash
pnpm check   # lint, tests, production build
pnpm dev     # http://localhost:5173
```

Smoke test the full loop with two accounts (a second browser profile or an incognito window works):

1. Sign up as **Ann** and as **Bob**.
2. Ann creates a team and invites Bob by display name; Bob accepts.
3. Bob adds an inventory item with quantity 20.
4. Ann publishes a trip with pickup and return times.
5. Bob proposes 10 units at $50.00 with a $5.00 commission.
6. Ann approves. Ann reports 5 sold.
7. Bob settles and confirms his quantity is now 15.

If all seven steps pass, the database, auth, policies, and realtime are wired correctly.

## 5. Deploy to Cloudflare Workers

Push the repository to GitHub first. **`wrangler.jsonc` must be committed** — the deploy step reads it,
and the build fails without it.

Cloudflare now recommends **Workers with static assets** for new projects. Pages still works and is
covered at the end of this section.

The repo already contains [wrangler.jsonc](../wrangler.jsonc):

```jsonc
{
  "name": "marketeersclub",
  "compatibility_date": "2026-08-17",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

`not_found_handling: "single-page-application"` is what makes deep links like `/agreements` resolve
instead of 404ing. There is no Worker script — this is an assets-only deployment, so SPA routes are not
billed as Worker requests.

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Workers**, then **Connect to Git** and
   pick the repository.
2. Configure the build:

| Setting | Value |
| --- | --- |
| Project name | `marketeersclub` (must match `name` in `wrangler.jsonc`) |
| Build command | `pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` |

> Use `pnpm exec wrangler`, not `npx wrangler`. `wrangler` is a pinned dev dependency, so `pnpm exec`
> guarantees the same version locally and in CI.

3. Under **Advanced settings**, add **environment variables**:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | your publishable anon key |

> These are read at **build time** and compiled into the bundle — they are not runtime secrets. Without
> them the deploy succeeds but the app loads with a configuration notice and cannot sign anyone in.
> After changing either value you must trigger a new deployment.

4. Deploy. You can also deploy from your machine with `pnpm build && pnpm deploy`.

<details>
<summary>Alternative: Cloudflare Pages</summary>

Choose **Pages → Connect to Git**, set the build command to `pnpm build` and the output directory to
`dist`, and add the same two environment variables. Pages uses
[public/_redirects](../public/_redirects) (`/* /index.html 200`) for the SPA fallback instead of
`not_found_handling`. That file is kept in the repo so either target works.
</details>

## 6. Point Supabase Auth at production

Once you know your deployed URL, open **Authentication → URL Configuration** in Supabase and set:

- **Site URL** — `https://your-app.pages.dev` (or your custom domain)
- **Redirect URLs** — add both the production URL and `http://localhost:5173` for local development

Skipping this sends confirmation and password-reset emails to the wrong host.

## Ongoing operations

**Schema changes**

```bash
pnpm exec supabase migration new describe_the_change   # creates a timestamped file
# edit the generated SQL
pnpm db:push
```

Always add a new migration file. Never edit an already-applied one — the CLI tracks applied migrations by
name, so edits will not re-run and environments will drift.

`pnpm db:diff` compares your local migrations against the linked database to catch changes made by hand
in the dashboard.

**Application changes**

Every push to the default branch triggers a production deploy; pull requests get preview URLs. Run
`pnpm check` before pushing.

**Backups** — the dashboard provides daily backups on the free tier. Before any risky migration, take a
manual snapshot under **Database → Backups**.

**Costs** — the expected load (10–50 users) sits inside both free tiers. Note that free Supabase projects
pause after a period of inactivity and are resumed from the dashboard.

## Optional: local stack with Docker

Only if you want a database on your own machine. This is the **only** part of the project that needs
Docker.

```bash
pnpm db:start   # starts Postgres, Auth, and the API locally
pnpm db:reset   # rebuilds the local database from migrations
pnpm db:stop
```

Then point `.env` at the local stack using the URL and anon key printed by `pnpm db:start` (typically
`http://127.0.0.1:54321`).

On Windows with WSL, this additionally requires Docker Desktop with **WSL integration enabled** for your
distribution (*Settings → Resources → WSL Integration*). If `docker` is unavailable, these three scripts
are the only things that stop working — the hosted workflow is unaffected.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Sign-in screen shows a configuration notice | `.env` is missing or unset. Add both `VITE_` variables and restart `pnpm dev`. |
| Deployed site works but login fails | Environment variables were not set in Cloudflare, or were added after the last build. Set them and redeploy. |
| Refreshing a route returns 404 | On Workers, `not_found_handling` is missing from `wrangler.jsonc`. On Pages, `public/_redirects` was not published. |
| `Missing entry-point` on deploy | `wrangler.jsonc` was not committed, or the deploy ran from the wrong directory. |
| `row-level security policy` errors | Migrations were not applied, or you are acting as the wrong user. Run `pnpm db:push`. |
| Signup succeeds but the app looks empty | The `profiles` trigger did not run — a sign of a partially applied migration. Re-run `pnpm db:push`. |
| `email rate limit exceeded` on signup | Email confirmation is on, so every signup sends a mail, and the built-in service allows only 2 per hour. Turn off **Confirm email** under **Authentication → Sign In / Providers**, or wait an hour. |
| Confirmation emails never arrive | Check the spam folder, or disable email confirmation while testing. The built-in service is best-effort and capped at 2/hour; configure custom SMTP for production. |
| `Email address ... is invalid` | Supabase rejects domains without real MX records, including `example.com`. Use a genuine domain when creating test accounts. |
| `Cannot connect to the Docker daemon` | Only affects `db:start`/`db:stop`/`db:reset`. Use the hosted workflow instead. |
| CLI cannot link | Re-run `pnpm exec supabase login`, and confirm the database password. Reset it under **Database → Settings** if lost. |
