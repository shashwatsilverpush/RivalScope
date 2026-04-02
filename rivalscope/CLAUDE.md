# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

All commands below are run from `rivalscope/` (the monorepo root), not the repo root.

## Commands

```bash
# From rivalscope/ — runs frontend (Vite :5173) + backend (Express :3001) concurrently
npm run dev

# Frontend only
npm run dev --prefix frontend

# Backend only (node --watch for auto-reload)
npm run dev --prefix backend

# Run QA test suite (no test runner needed — hits the live API)
curl http://localhost:3001/api/qa/run
# Or open http://localhost:5173/qa in the browser

# Production build (frontend bundle only; backend is served as-is)
npm run build
npm start          # starts backend only; serve frontend/dist separately
```

No lint scripts are configured.

## Architecture

RivalScope is a monorepo with two independent packages: `frontend/` and `backend/`.

### Request flow

1. User submits products + scope in the React UI
2. `POST /api/analysis/run` opens a Server-Sent Events (SSE) stream
3. Backend runs the **analysis pipeline** (`backend/services/analysisPipeline.js`):
   - **Enrich** (sequential, not parallel — parallel bursts trigger Cerebras 429s): looks up or refreshes `product_contexts` cache (7-day TTL). Forces re-enrich if `resolved_name` looks like a domain (`.com`).
   - **Classify**: `productClassifier.js` → primary category + `classifyAllRoles()` for multi-role support (e.g. Magnite = SSP + AD_EXCHANGE). Results stored in `known_roles` column.
   - **Search**: sequential per product; SearXNG + Serper fans out, deduplicated by domain. Cache TTL = **3 days** (not daily — uses epoch-day key).
   - **LLM**: `analyzeWithStream()` → Cerebras API; fast=`llama3.1-8b`, deep=`qwen-3-235b-a22b-instruct-2507`. All calls wrapped in `withRetry()` (up to 4 attempts, 2s→4s→8s backoff on 429).
   - **Normalize**: multi-step cleanup (see pipeline normalization order below)
   - **Save**: stores `result_json` + `result_csv` in SQLite
4. SSE sends progress events; on `step: done`, frontend navigates to `/results/:id`

### Pipeline normalization order (critical — do not reorder)

After `parseWithRetry` produces raw JSON:
1. **Normalize "Field" key** — LLM sometimes uses the actual field name as the row key instead of `"Field"`. Detected by checking `rows[0]` lacks a `'Field'` property. Renames the non-product key to `Field`.
2. **Transpose check** — if columns are field names instead of product names, auto-transposes the table.
3. **Step 6b** — fuzzy-match all column and row keys to canonical resolved brand names (e.g. `magnite.com` → `Magnite`, `pubmatic` → `PubMatic`).
4. **Step 6d** — replace empty/null cell values with `"Unconfirmed"`. **Must run after normalization**, not before — Step 6a previously ran before normalization and caused a bug where `Field: undefined` was set, tricking the normalization check.
5. **Step 6c** — same canonical rename pass for `support_matrix` keys if present.

`parseWithRetry` tries three strategies: direct parse → bracket-salvage of truncated JSON → LLM fix as last resort.

### Frontend pages & key components

- `NewAnalysis.jsx` — product list + scope/weight selector + mode toggle + SSE stream reader
- `Results.jsx` — loads analysis by ID, renders ScoreCard + tabbed views (Comparison Matrix, Feature Comparison, Support Matrix). Shows `known_roles` badges for multi-role products.
- `History.jsx` — lists past analyses
- `Schedules.jsx` — cron job management
- `QA.jsx` — runs `GET /api/qa/run` and displays pass/fail for all 12 deterministic tests

Components live in `frontend/src/components/`. Shared scoring logic is in `frontend/src/lib/scoring.js`.

### Backend services

| File | Role |
|---|---|
| `services/analysisPipeline.js` | Main orchestrator — the only file that touches the database for analysis writes |
| `services/llm.js` | Cerebras client; `withRetry()` wraps all calls; `salvageTruncatedJson()` for truncated responses |
| `services/searchOrchestrator.js` | Fans out to SearXNG + Serper, merges/deduplicates by domain |
| `services/productClassifier.js` | `classify()` → single primary category; `classifyAllRoles()` → JSON array of all matching categories |
| `services/fieldTemplates.js` | Default row fields per category (23 categories, e.g. DSP → 18 fields) |
| `services/qaAgent.js` | 12 deterministic tests covering JSON parsing, normalization, scoring, and cache behaviour |
| `services/diffHighlighter.js` | Compares two result JSONs, marks cells changed/new/removed |
| `services/scheduler.js` | Loads cron schedules from DB on startup, re-runs analyses, emails diffs |
| `services/emailer.js` | Nodemailer SMTP wrapper |

### Database (SQLite — `backend/rivalscope.db`)

Schema is in `backend/db/schema.sql`, auto-applied on first start. Additive column migrations run in `database.js` after schema apply (safe to re-run).

Key tables:
- **`analyses`** — one row per run; `products_json`, `result_json`, `status`, `detected_category`
- **`product_contexts`** — enrichment cache (7-day TTL); `adtech_category` = primary category; `known_roles` = JSON array of all roles
- **`search_cache`** — MD5-keyed 3-day cache for search results (key = `md5(source:query:epochDay)`)
- **`schedules`** — cron jobs linked to a template analysis ID
- **`app_config`** — key/value store for API keys and SMTP settings (overrides `.env`)

### Frontend HTTP client

`frontend/src/lib/api.js` is an Axios instance with a **120-second timeout** (analyses can be slow). All frontend API calls go through it; the Vite dev proxy forwards `/api/*` to `http://localhost:3001`.

### API keys & configuration

Keys can be set in `backend/.env` **or** saved at runtime via the Settings modal (stored in `app_config` table, which takes precedence).

Required:
- `CEREBRAS_API_KEY` — free at cerebras.ai
- `SERPER_API_KEY` — optional (free tier at serper.dev); SearXNG is used as fallback

Optional SMTP fields (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) are only needed for scheduled email delivery.

### Railway deployment

Railway injects `PORT` as a string; `index.js` uses `parseInt(process.env.PORT, 10) || 8080` and binds to `0.0.0.0`. The frontend `dist/` is built during the Nixpacks build phase and served statically by Express whenever the folder exists (no `NODE_ENV` check needed). The SQLite DB is persisted at `/data/rivalscope.db` via a Railway volume.

### Scoring & weighting

`frontend/src/lib/scoring.js` contains pure functions:
- `scoreCell(value)` — heuristic cell score (keywords, richness, negatives)
- `scoreProducts(columns, rows, scopeWeights)` — ranks products; zero-weight scopes are ignored (treated as unweighted)
- `classifySupport(value)` — maps a cell to `yes` / `no` / `unknown`

`scope_weights` is set by the user in `ScopeInput.jsx` and stored in `result_json` so scoring is reproducible on revisit.

`SupportMatrix.jsx` uses its own `classifyCell()` (yes/partial/no/unknown) which is separate from `classifySupport()` in scoring.js — `classifyCell` handles the `"partial"` state for richer visual feedback.
