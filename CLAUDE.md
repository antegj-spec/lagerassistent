# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Lagerassistent is a single-page web app (Swedish) for managing an event equipment warehouse. It tracks notes/tasks, physical inventory, returns, and work planning. Deployed on Netlify with a Supabase backend.

## No build step

This is a plain HTML/CSS/JS project — no bundler, no npm, no compilation. Development is done by opening `index.html` in a browser or serving via a local HTTP server (e.g. `npx serve .` or Python's `http.server`). Deployment happens by pushing to the Netlify-connected git repository.

## JavaScript load order

Scripts in `index.html` must remain in this exact order — each file depends on the previous:

1. `js/config.js` — constants, enums, global state variables
2. `js/supabase.js` — all database/storage functions
3. `js/auth.js` — PIN login flow
4. `js/ui.js` — helpers (modal, toast, filters, AI chat)
5. `js/render.js` — HTML generation for each tab view
6. `js/actions.js` — user action handlers (CRUD operations)

## Architecture

The app uses a simple shared-state pattern — all data lives as module-level `let` variables in `config.js` (e.g. `notes`, `materials`, `tasks`). Functions in other files read and mutate these directly; there is no framework.

**Data flow for every user action:**
1. User triggers an `actions.js` function
2. Function calls `supabase.js` to write to Supabase
3. Then calls the matching `load*()` function to refresh the in-memory state
4. Then calls `render()` to rebuild the current tab's HTML

**render() pattern:** `render.js` builds full innerHTML strings for each tab. After every `render()` call, `bindEvents()` re-attaches non-inline event listeners (e.g. the note-input auto-classifier).

## Supabase tables

| Table | Purpose |
|---|---|
| `notes` | Warehouse observations; soft-deleted via `deleted_at` |
| `materials_v2` | Material types (two kinds: `is_article_based` and count-based) |
| `material_items` | Individual tracked articles (for article-based materials) |
| `material_counts` | Status counts per material (for count-based materials) |
| `material_history` | Audit log for status changes |
| `borrowed_material` | Rented-in materials from external suppliers |
| `returns` | Returned equipment records |
| `tasks` | Work planning tasks with assignment and status log |
| `task_status_log` | Audit trail for task status changes |
| `user_pins` | PIN codes per user (stored in plain text) |
| `comments` | Comments on notes |

All Supabase calls go through the `sb(path, opts)` wrapper in `supabase.js`, which adds auth headers using the anon key from `config.js`.

## Users and roles

Users are hardcoded in `config.js` (`USERS` array). The only role distinction is `isAdmin` (set when `user === "Admin"`). Admin-only features: Export tab, Trash tab, AI chat tab, archived tasks/returns, and setting item status to "tillgänglig".

## XSS safety

All user-generated content inserted into HTML **must** be wrapped with `esc()` (for text nodes) or `escAttr()` (for HTML attribute values). Both helpers are defined in `ui.js`. Never insert raw user data into innerHTML.

## AI integration

The AI chat and summary features call a Netlify serverless function at `/.netlify/functions/claude`, which proxies requests to the Anthropic API. The function code lives in `netlify/`. The app currently uses `claude-sonnet-4-5` — update this to the latest model when upgrading.

## Material types

Two fundamentally different tracking modes:
- **Count-based** (`is_article_based: false`): Tracks quantities per status (e.g. 50 pall EPS PRO: 40 tillgänglig, 8 uthyrd, 2 reparation). Counts live in `material_counts`.
- **Article-based** (`is_article_based: true`): Each physical item has its own ID and status (e.g. LD20-19). Items live in `material_items`.
