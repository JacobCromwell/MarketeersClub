# AGENTS.md

Working conventions for this repository, for both human contributors and AI coding agents.

## Project in one paragraph

Marketeers Club is a React 19 + TypeScript single-page app served by Cloudflare Pages, talking directly
to Supabase (Postgres, Auth, Realtime). There is no custom backend. Friends form teams, post sales trips,
and lend each other merchandise under mutually approved terms.

## Setup

```bash
pnpm install
cp .env.example .env    # fill in Supabase URL + anon key
pnpm dev
```

**Use pnpm, never npm or yarn.** Only `pnpm-lock.yaml` is committed.

The Supabase CLI is a dev dependency. Use the `db:*` scripts or `pnpm exec supabase ...` — do not use
`pnpm dlx supabase` (it re-downloads the CLI and can drift from the pinned version) and do not instruct
users to install it globally.

**Docker is not required.** It is needed only for `db:start`, `db:stop`, and `db:reset`. The default
workflow targets a hosted Supabase project via `db:link` and `db:push`. Never make Docker a prerequisite
in docs or scripts.

## Validation

Run before considering any change complete:

```bash
pnpm check    # lint + test + build
```

Individually: `pnpm lint`, `pnpm test`, `pnpm build`. The build must stay warning-free — including
Vite's bundle-size warning, which is currently held in check by lazy-loading routes in
[src/App.tsx](src/App.tsx).

There is no local Postgres in the default setup, so **SQL changes cannot be executed locally without
Docker or a linked project**. Review migrations carefully and verify against a linked development
project before pushing.

## Invariants — do not break these

1. **Money is integer cents.** Never store or compute currency as a float. Convert at the UI edge with
   `dollarsToCents` / `formatMoney` in [src/lib/format.ts](src/lib/format.ts).
2. **The database enforces authorization, not the client.** Every table has Row Level Security. The
   client holds only the anon key. A UI check is a convenience, never a control.
3. **Agreement state changes go through `SECURITY DEFINER` RPCs.** Users hold only `select`/`insert` on
   `agreements`. Never grant `update`/`delete` on it, and never move a state transition into the client.
4. **Changing terms invalidates the other party's approval.** Any edit increments `terms_version`, records
   the editor's approval at the new version, and clears the other side's. Approval requires both parties
   at the *same* version.
5. **Inventory decrements exactly once, at settlement, by the owner only.** No other code path may change
   `inventory_items.quantity` as part of the agreement flow.
6. **Inventory stays private.** Only the owner can read their catalog, plus a seller with an agreement for
   that specific item. Member search exposes display names only.
7. **Timestamps are minute-precision `timestamptz`**, and pickup/return time and location are separate
   fields. Do not collapse them.
8. **Only the publishable anon key reaches the browser.** The `service_role` key must never appear in the
   client, `.env`, or the repo.

## Code conventions

**TypeScript**
- Strict mode. Do not introduce `any`; prefer `unknown` with narrowing.
- Shared row types live in [src/types.ts](src/types.ts) and must match the migration.

**React**
- Function components with hooks. Named exports for pages and components; `App` is the one default export.
- Authenticated pages are lazy-loaded in [src/App.tsx](src/App.tsx) — keep new routes lazy.
- `AuthProvider.tsx` exports only the component; the context and `useAuth` live in `auth.ts`. This split
  keeps React Fast Refresh working — do not merge them.
- Initial data loads are scheduled off the synchronous effect body so state updates happen after the
  effect settles. Follow the existing pattern in the pages rather than calling `setState` synchronously
  during an effect.
- Handle promises explicitly in event handlers (`void someAsyncFn()`), matching existing code.

**Business logic**
- Framework-free rules belong in [src/domain](src/domain) and must have Vitest coverage. Keep them pure so
  they are testable without mocking Supabase.

**Styling**
- One stylesheet, [src/styles.css](src/styles.css), using CSS custom properties. No CSS-in-JS or utility
  frameworks. Every screen must work on phone and desktop widths.

**Comments**
- Only where code cannot explain itself. Do not narrate changes or restate the next line.

## Database changes

```bash
pnpm exec supabase migration new short_description
# edit the generated file
pnpm db:push
```

- **Never edit an applied migration.** Add a new one; applied migrations are tracked by filename.
- New tables need `enable row level security`, explicit policies, and explicit `grant`s.
- New functions need `set search_path = ''` and fully schema-qualified identifiers.
- Revoke `execute` from `public` and `anon` on every new function, then grant only to `authenticated` for
  intentional RPCs. Internal helpers and trigger functions get no grants.
- Take `for update` locks before read-modify-write sequences, as the existing workflow functions do.

## Repository layout

```
src/App.tsx          Route table (lazy-loaded authenticated pages)
src/auth.ts          Auth context + useAuth
src/AuthProvider.tsx Session provider (component only)
src/components/      Layout shell, shared UI primitives
src/domain/          Pure business rules + tests
src/lib/             Supabase client, formatting helpers
src/pages/           One screen per route
src/types.ts         Shared database row types
supabase/migrations/ Schema, RLS, workflow functions
public/_redirects    SPA fallback for Cloudflare Pages
```

## Pull request expectations

- `pnpm check` passes.
- Business rule changes ship with tests.
- Schema changes ship as a new migration, with the security checklist above satisfied.
- User-visible changes update [docs/USER_GUIDE.md](docs/USER_GUIDE.md); setup or infrastructure changes
  update [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- Do not commit `.env`, `dist/`, or `.supabase/`.

## Scope discipline

Make the change that was asked for. Do not opportunistically refactor, restyle, add abstractions for
single call sites, or add dependencies without a clear need — the dependency list is deliberately small.
