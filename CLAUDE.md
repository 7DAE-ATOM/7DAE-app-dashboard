# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

A single Next.js 15 / React 19 app at the repo root, plus a lightweight specification folder:

- Root — the **`app-dashboard`** application. Visual dashboard of Airbus **Lab Test Means** (LTM) backed by the live `atom-synchronizer-dev` API. Runs on port **3001**.
- `_specification/vibe coding/` — lightweight feature specs, one file per feature. This is where `/sweetforge.vibe` writes new specs.
- `deployment/nextjs-hello-chart/` — Helm chart for AFTER (Airbus Kubernetes platform). Service expects the container to listen on **8080** and exposes `/health` for liveness/readiness probes.

Implementation plans produced by Plan mode are written to `C:\Users\olivi\.claude\plans\` (outside this workspace), not under `_specification/`.

## Commands

Plain Next.js project, no test or lint script defined.

```bash
npm install
npm run dev              # dev server on 3001
npm run build            # production build (static export to out/)
npm start                # serve out/ on 3001 — see the caveat below
npm run generate:map     # regenerate lib/world-map.generated.ts (by hand, not in the build)
npm run collect:licenses # copy redistributed licences into out/licenses/
npm run check:external-urls  # fail if the deliverable would contact a third party
```

**`npm start` caveat**: it serves `out/` at the root, so it is only meaningful
for a build made WITHOUT `BASE_HREF`. A build made with the gateway prefix puts
every asset under `/atom-app-dashboard/_next/…`, which 404s when served at the
root and renders the page unstyled — a symptom that looks like broken fonts and
has nothing to do with them. Production serves `out/` through nginx, not this.

When a refactor deletes routes or pages, `.next/` often holds stale chunks and dev/build will throw `Cannot find module './<hash>.js'`. Fix by removing `.next/` before rebuilding: `rm -rf .next`.

## Architecture

### Routes
- `/` → catalogue grid (`CatalogueClient`), paginated 6/page, URL-synced via `?page=`.
- `/map` → MapLibre full-screen view (`MapClient` + `MapView`), with a nested `app/map/layout.tsx` that scopes the `theme-map-first` class.
- `/labtestmean?id=<externalId>` → detail page with photo gallery, security/access, lifecycle timeline, people, programs/projects. This is a **single static page** (`app/labtestmean/page.tsx`) that reads the `id` query param via `useSearchParams()` and fetches client-side. It is intentionally **not** a dynamic `[externalId]` route: under `output: "export"` a dynamic segment would require pre-generating every id (or breaks on unknown ids), so the query-param form keeps it fully dynamic with zero pre-generation.
- `/health` → static JSON `{ "status": "ok" }`, used by the Helm chart's liveness/readiness probes.

There is **no** mock JSON, **no** `/bench/` segment, **no** `/d/<direction>` segment, and **no** panorama viewer. All three belonged to earlier iterations and have been deleted — do not reintroduce.

### Data flow
- Pages are server components (`export const dynamic = "force-dynamic"`) that call `getLabTestMeans()` once and pass arrays to client components as props.
- `lib/atom-api.ts` — `fetch` against `${ATOM_API_BASE_URL}/api/infos/labtestmeans` (defaults to `http://localhost:8080/atom-synchronizer-dev`). Throws `AtomApiError` with `status: 0` on network failure; `app/error.tsx` matches the message to render a backend-down screen.
- `lib/labtestmean-adapter.ts` — maps the backend `LabTestMeanDto` → frontend `LabTestMean`. Derives `status` from lifecycle dates (`dismantled` → `out-of-service`, `mothballed` → `mothballed`, missing `eisdateyear` → `in-project`, else `operational`). Uppercases the `category` enum (formerly `testMeanType` upstream). Hardcodes country/city/geo lookup for the four known sites: **TLS, HMB, FIL, BRE** — anything else falls through to `Unknown` and is silently filtered out of `/map`.
- All cards/galleries currently use placeholder cover SVGs in `public/covers/` because the DTO has no photo fields. The detail-page gallery shows the same covers.
- Filtering happens client-side over the array passed from the server component.

### Two orthogonal theming axes
This is the single most important architectural idea and is easy to misread:

1. **Light ↔ Dark** — a user preference controlled by `[data-theme="light" | "dark"]` on `<html>`. All color tokens (`--color-bg`, `--color-fg`, `--color-accent`, `--color-success`, etc.) live in two blocks in `app/globals.css`. Structural tokens (`--font-*`, `--radius-*`) stay on bare `:root`. An inline anti-FOUC script in `<head>` (see `app/layout.tsx`) reads `localStorage.theme` or falls back to `prefers-color-scheme` before the first paint; the `ThemeToggle` (in the `Header` right slot) writes back via `lib/useTheme.ts`. Other consumers (notably `MapView` for tile-style selection) read the theme through the same `useTheme()` hook, which uses `useSyncExternalStore` + `MutationObserver` on `html[data-theme]`.

2. **Route theme class** — `theme-industrial-premium` applied on `<body>` in `app/layout.tsx`; `theme-map-first` applied inside `app/map/layout.tsx`. These classes only carry **structural** overrides (the glass panel, the card hover glow). They do **not** redefine color tokens — colors come exclusively from the `[data-theme]` axis. Translucent values use `color-mix(in srgb, var(--color-accent) X%, transparent)` so they adapt automatically.

When you change colors, the default is to edit `:root[data-theme="dark"]` / `:root[data-theme="light"]` in `app/globals.css`. Touch `styles/themes/*.css` only for structural overrides that cannot be expressed as tokens.

### Persisted preferences — one factory, two tiers

Every user preference kept in browser storage goes through **`lib/createPersistedStore.ts`**. The factory owns the plumbing that used to be copy-pasted per store: lazy hydration, a constant server snapshot, snapshot identity (`useSyncExternalStore` loops forever if `getSnapshot` mints a new object per read), forgiving persistence, and the cross-tab `storage` listener. Each store supplies only its key, storage level, default and a **`parse`** function — the per-preference validation stays explicit and must never collapse into a blind `JSON.parse`.

The rule for the exception: a preference lives in the **DOM** (attribute on `<html>` + `MutationObserver`) **if and only if** it must be correct *before* hydration or be readable by CSS. Only two qualify — `lib/useTheme.ts` (`data-theme`) and `lib/catalogueDensity.ts` (`data-cat-cols` / `--cat-cols`), both written by the inline anti-FOUC script in `app/layout.tsx`. Anything else goes through the factory (`lib/discoverHighlightPanel.ts`, the Discover highlight panel's folded state, is the plainest example). `lib/discoverEdgeCurvature.ts` is neither: per-edge listeners, deliberately not persisted.

Not every module store is a preference. `lib/discoverCanvasContents.ts` uses the same `useSyncExternalStore` shape without the factory, because what it holds is the *content of a canvas*, not a choice: session-only, never persisted. It exists so `DiscoverGraph` can publish upward without a prop — the graph is not memoized and is rendered directly by `DiscoverClient`, so routing this through the parent's state would re-render the graph on every canvas change.

Storage level: `localStorage` for display preferences (they outlive the tab and sync across tabs), `sessionStorage` for the catalogue filters (`lib/appFilters.ts`) — a narrow filter forgotten since yesterday would look like an empty catalogue, and two tabs scoped differently is a legitimate use.

### Client/server boundary
- Page-level files in `app/` stay server components; state, effects, and browser APIs move into a dedicated `Client` component (`CatalogueClient`, `MapClient`, `Header`, `ThemeToggle`).
- `MapView` requires `window` (MapLibre) and is always imported via `dynamic(() => …, { ssr: false })` from `MapClient`. Keep it that way.
- The anti-FOUC script in `app/layout.tsx` is an exception — it ships as raw HTML via `dangerouslySetInnerHTML` so it executes before hydration.

## Deployment

- `next.config.mjs` sets `output: "standalone"` so the build produces `.next/standalone/` (a self-contained Node server) and `.next/static/`.
- `Dockerfile` — multi-stage Node 20 image: builder runs `npm run build`, runtime copies `.next/standalone`, `.next/static`, and `public/` and runs `node server.js` on port 8080.
- `Jenkinsfile` stashes `.next/standalone`, `.next/static`, and `public/` between the build and Docker stages.
- The Helm chart (`deployment/nextjs-hello-chart/`) expects port **8080** and `/health`. The `/health` route is served by `app/health/route.ts`.

## Conventions to preserve

- **Routing is URL-clean**: `/`, `/map`, `/labtestmean` (detail via `?id=<externalId>`), `/health`. No `/d/` prefix, no `/bench/` segment, no direction axis. The `?id=` on the detail page is the **one** intentional query param — it exists because static export can't host a dynamic `[externalId]` segment without pre-generation; it is not a "direction" axis and must not be generalized. If a link needs another view, add a top-level route.
- **Airbus logo**: single asset `public/airbus-logo.svg` using `fill="currentColor"`. It auto-inverts via `--color-fg`. Do not add a separate dark/light logo file unless a branded asset is explicitly required.
- **Header right slot**: reserved for future avatar / global search / notifications. `ThemeToggle` is the only current tenant. Keep the slot dimensioned to avoid reflow when new items are added.
- **Avatars**: never reach out to third-party avatar services (`pravatar.cc`, `gravatar`, etc.) — `components/Avatar.tsx` renders deterministic initials locally. The same component should be used for any new person/role surface.
- **Specs and plans are separate**: `/sweetforge.vibe` writes to `_specification/vibe coding/<slug>.md`; Plan mode writes to `C:\Users\olivi\.claude\plans\`. Never put planning artifacts under `_specification/`.

## Backend dependency

Spring Boot **`atom-synchronizer-dev`** served at `http://localhost:8080/atom-synchronizer-dev` with Springdoc OpenAPI at `/v3/api-docs`. Its `LabTestMean` entity (`GET /api/infos/labtestmeans`) is the single source of truth for the dashboard. The OpenAPI spec covers ~42 endpoints across sync processes, ATOM reads, KPIs, and connectivity healthchecks to LeanIX / Alfabet / ADAM / Google.

Override the base URL via `ATOM_API_BASE_URL` (read in `lib/atom-api.ts`).

## Slash commands

Custom workflows live in `.claude/commands/`. The two most-used in this repo:
- `/sweetforge.vibe <short idea>` — generate a lightweight feature spec under `_specification/vibe coding/`.
- SpecKit suite (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`, etc.) — the heavier spec-kit flow.

Prefer the slash command over hand-writing spec files so the location and format stay consistent.

## No third-party network dependency

The deliverable must contact **no domain other than the backend**. This is not
about offline capability — the cluster has no outbound access but the client
browser does, so a CDN dependency *works* and therefore never reports itself.
It is about not sending employee IPs to Google on every page (the Munich ruling
of January 2022 found embedded Google Fonts to breach the GDPR), not telling a
tile provider which sites are being looked at, and not depending on
infrastructure nobody here controls.

- **Fonts** are self-hosted from `@fontsource-variable/*`, imported in
  `app/layout.tsx`. The family names are `"Inter Variable"` /
  `"JetBrains Mono Variable"` — dropping them from `--font-sans` / `--font-mono`
  renders correctly on any machine with Inter installed (developer laptops) and
  falls back to `system-ui` everywhere else. Never reach for `next/font/google`:
  it downloads during `next build`, which moves the dependency into the build
  instead of removing it.
- **The map** is an SVG generated by `scripts/generate-world-map.mjs` into
  `lib/world-map.generated.ts` and committed. `d3-geo`, `topojson-client` and
  `world-atlas` stay devDependencies, and the generator is deliberately NOT in
  the build path.
- **The one accepted exception** is `lib/google-embed.ts`: Google Docs/Drive
  URLs named by backend data, opened deliberately by the user. The rule is about
  who *commissions* the request — the app fetches nothing for its own account.
- `scripts/check-external-urls.mjs` enforces all of the above on `out/` and is
  wired into the Jenkins Build stage before the stash.

## Network calls — ask first

The user requires **explicit confirmation before every HTTP call**, GET included. This applies to `curl` / `wget` from Bash, `WebFetch`, MCP fetch-style tools, and any HTTP request to `atom-synchronizer-dev`, the internet, or any other service. Reading local files (Read/Glob/Grep) does not count. Writes (POST/PUT/PATCH/DELETE) are always forbidden without explicit authorization.

Authorization is per-call: approval for one URL does not extend to related endpoints.
