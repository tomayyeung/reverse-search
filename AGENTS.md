# AGENTS.md

## Repo Shape
- Rust workspace members are `reweave` and `frontend`; `wordlist` is intentionally excluded from the workspace.
- `reweave/` is both the shared Rust game logic crate and the Vercel backend. Shared logic lives in `reweave/src/common/`; Vercel function binaries live in `reweave/api/`.
- `frontend/` has React/Vite source in `frontend/src/` plus a Rust `cdylib` in `frontend/src/lib.rs` compiled to WASM.
- Frontend pages live under `frontend/src/pages/`; shared UI components live in `frontend/src/components/`.
- `frontend/pkg/` is wasm-pack output and ignored by `frontend/pkg/.gitignore`; regenerate it instead of editing it.
- Vite/TS aliases are `@` -> `frontend/src`, `@components` -> `frontend/src/components`, `@wasm` -> `frontend/pkg`, and `@public` -> `frontend/public`.
- The frontend uses React 19 with the React Compiler configured in `frontend/vite.config.ts` via `reactCompilerPreset()`.

## Frontend Style
- Use CSS Modules for page/component styles; shared theme tokens and element defaults live in `frontend/src/index.css`.
- Preserve the calm puzzle-game visual language: soft neutral backgrounds, green/teal accents, rounded corners, light borders, and subtle shadows.
- Add or adjust shared colors/radii/shadows as CSS variables in `frontend/src/index.css`; avoid one-off hard-coded palettes in components.
- Avoid gradients, glassmorphism, neon/glow effects, oversized hero sections, product-marketing landing-page patterns, and generic SaaS-style cards unless the user explicitly asks for a redesign.
- Button styling should stay simple and functional: default buttons are primary actions; secondary, danger, and menu variants belong in the local CSS Module near the component/page using them.
- Prefer existing path aliases over deep relative imports from pages/components.
- Keep word-list shapes discriminated: `CreateWords` has `kind: "create"` and `all`; `PlayWords` has `kind: "play"`, `found`, `missing`, and `extra`.
- `WordList` props are also discriminated by `listType`; do not reintroduce optional word arrays plus non-null assertions.
- With React Compiler enabled, do not add `useMemo`, `useCallback`, or `memo` just for referential stability; the current frontend has no such pattern.
- TypeScript is strict and uses `erasableSyntaxOnly`; use type-only imports for types and avoid runtime enums/namespaces.

## Commands
- The root `package.json` only declares `packageManager: pnpm@10.28.0`; it has no scripts.
- Install frontend deps from the repo root with `pnpm --dir frontend install`.
- Build WASM before Vite build: `wasm-pack build frontend --target bundler --out-dir pkg`.
- Build frontend like deploy: `wasm-pack build frontend --target bundler --out-dir pkg && pnpm --dir frontend run build`.
- Type-check/build the current checked-in frontend package with `pnpm --dir frontend run build`; this assumes `frontend/pkg/` already exists.
- Run frontend dev server: `pnpm --dir frontend run dev`.
- Lint frontend: `pnpm --dir frontend run lint`.
- Run backend locally from `reweave/` with `DATABASE_URL=... vc dev` or `DATABASE_URL=... vercel dev`; use a local PostgreSQL database URL for development.
- Test shared/backend Rust crate: `cargo test -p reweave`.
- Run one Rust test with a filter, for example `cargo test -p reweave common::board::tests::find1`.
- Check the WASM crate against its real target with `cargo check -p frontend --target wasm32-unknown-unknown`.
- Check Rust formatting with `cargo fmt --check`; run `cargo fmt` if Rust edits need formatting.

## Runtime And Deploy
- Root `vercel.json` deploys the frontend, installs `wasm32-unknown-unknown`, downloads a prebuilt `wasm-pack`, enables Corepack, then builds `frontend/dist`.
- Backend is deployed separately from `reweave/`; `reweave/vercel.json` rewrites `/api/puzzle/:puzzle_id` to `/api/puzzle?puzzle_id=:puzzle_id` and includes CORS headers for `/api/(.*)`.
- Vite proxies `/api` to `http://localhost:3000`; run the backend dev server there when testing frontend API calls locally.
- Frontend API base is `VITE_API_URL`; if unset it uses same-origin/proxied `/api`.
- Frontend routes in `App.tsx` are `/`, `/how-to-play`, `/create`, and `/play/:puzzleId`.

## Data And Env
- Backend DB code always requires `DATABASE_URL`.
- The database code expects the `puzzles`, `puzzle_stats`, and `puzzle_completion_events` tables defined in `schema.sql`; puzzle IDs are returned as UUID strings.
- No migration runner is present in the repo; local databases should be initialized from `schema.sql`.

## Game And API Shape
- `POST /api/create` accepts JSON with `name`, `width`, `height`, `letters`, `words`, and `answer`, then returns `{ "id": string }` or `{ "error": string }`.
- `GET /api/puzzle` reads `puzzle_id` from the query string; `GET /api/puzzle/:puzzle_id` is supported by Vercel rewrite and by a fallback path-segment parser.
- `GET /api/puzzles` returns camelCase puzzle summaries for the home page; `description` is currently always `null`.
- Rust `Puzzle` stores `letters` as the starting puzzle state, `answer` as the solved board, and `words` as a `HashSet<String>`.

## Gotchas
- Board/trie logic expects lowercase ASCII letters; blanks and holes are represented by `_` and `!` in Rust board creation.
- `Board::create` and `Puzzle::create` return `Result`; invalid board dimensions or invalid letters should be handled as errors, not panics.
- The WASM `check` return type is `any` in generated typings; cast it at frontend boundaries into `PlayWords` rather than spreading `any` through component props.
- The WASM crate embeds `wordlist/wordlist.txt` with `include_str!`; update that file before rebuilding WASM if changing the playable dictionary.
- The word list generator in `wordlist/` depends on local `CSW24.txt` and `blacklist.txt`; those inputs are gitignored.
- `frontend/pkg/` and `frontend/dist/` are generated. Do not manually edit generated WASM package files or built assets.
