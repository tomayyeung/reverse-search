# Reverse Search

Reverse Search is a word-grid puzzle game inspired by Word Hunt-style adjacency rules. A puzzle gives the player a required word list and a partially empty board. The goal is to reconstruct a board of letters that can spell every required word by tracing adjacent tiles.

Players can create their own puzzles, remove selected letters to set the starting challenge, share the generated puzzle ID, and then play the puzzle through the browser.

## Gameplay

Each puzzle has two board states:

- `answer`: the solved board, containing the full intended layout.
- `letters`: the starting board shown to the player, where some answer letters may be replaced with blanks.

Words are found by walking from tile to adjacent tile, including diagonals, without reusing the same tile in one word. Blank cells and holes do not contribute letters. The puzzle is complete when every required word is found and no extra words are present.

The create flow lets a puzzle author:

- Choose a board size.
- Fill letters and holes on the answer board.
- Generate the complete word list from the board.
- Lock the word list, then hide selected letters to create the starting board.
- Submit the puzzle and receive a play link.

The play flow lets a player:

- Load a puzzle by ID.
- Fill blanks while fixed starting letters stay locked.
- Track found, missing, and extra words live.
- Reveal a selected tile, a random tile, or the full solution if needed.
- Click words to view dictionary definitions and pronunciation data.

## Tech Stack

Core game logic is written in Rust and shared between the backend and frontend.

- Rust workspace with shared logic in the `reweave` crate.
- React 19 and Vite for the browser UI.
- React Compiler enabled through `@vitejs/plugin-react` and `reactCompilerPreset()`.
- WebAssembly generated with `wasm-pack` so the frontend can run Rust board and word-checking logic locally.
- Vercel serverless Rust functions for puzzle creation and loading.
- PostgreSQL via `sqlx` for persisted puzzles.
- `pnpm` for frontend package management.

## Project Structure

```text
.
├── reweave/                 # Shared Rust logic and Vercel backend
│   ├── api/                 # Vercel serverless function entrypoints
│   └── src/
│       ├── common/          # Board, puzzle, and word/trie logic
│       ├── db.rs            # Postgres puzzle persistence
│       └── helper.rs        # API request/response helpers
├── frontend/                # React app plus Rust WASM crate
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/create/    # Puzzle creation page
│   │   ├── pages/play/      # Puzzle play page
│   │   └── lib.rs           # Rust WASM bindings for the frontend
│   └── pkg/                 # Generated wasm-pack output
├── wordlist/                # Standalone word-list generator
├── wordlist/wordlist.txt    # Dictionary embedded into the WASM crate
├── Cargo.toml               # Rust workspace config
├── schema.sql               # PostgreSQL schema for backend persistence
└── vercel.json              # Frontend deploy config
```

The Rust workspace includes `reweave` and `frontend`. The `wordlist` crate is intentionally excluded because it is a standalone generator that depends on local, gitignored source files.

## API Shape

The backend is deployed separately from the frontend under `reweave/`.

- `POST /api/create` accepts `name`, `width`, `height`, `letters`, `words`, and `answer`, then returns `{ "id": string }` or `{ "error": string }`.
- `GET /api/puzzle?puzzle_id=<id>` loads a puzzle by ID.
- `GET /api/puzzle/:puzzle_id` is also supported by the backend Vercel rewrite and fallback path parsing.

The database expects the tables defined in `schema.sql`:

- `puzzles` stores puzzle boards, word lists, and metadata.
- `puzzle_stats` stores aggregate play, completion, and like counts.
- `puzzle_completion_events` stores individual completion times.

There is currently no migration runner in the repo; apply `schema.sql` to a local PostgreSQL database before running the backend locally.

## Frontend Data Model

The frontend uses discriminated word-list types:

- `CreateWords`: `{ kind: "create", all }`
- `PlayWords`: `{ kind: "play", found, missing, extra }`

The generated WASM typing for `check` returns `any`, so frontend page boundaries cast that value into `PlayWords` rather than passing `any` through component props.

## Word List

The playable dictionary is embedded into the frontend WASM crate with `include_str!("../../wordlist/wordlist.txt")`. If the dictionary changes, rebuild the WASM package before building or deploying the frontend.

The `wordlist/` generator starts from the 2024 Collins Scrabble Word list and filters it with a local blacklist. Its source inputs, `CSW24.txt` and `blacklist.txt`, are gitignored.

## Development

The frontend and backend are run separately during local development. The frontend Vite dev server proxies `/api` to `http://localhost:3000`, so the backend should be running there when testing create/play API calls locally.

### Frontend

Install frontend dependencies from the repo root:

```sh
pnpm --dir frontend install
```

Build the WASM package:

```sh
wasm-pack build frontend --target bundler --out-dir pkg
```

Run the frontend dev server:

```sh
pnpm --dir frontend run dev
```

### Backend

For normal local development, run the single-process backend server from `reweave/`. It loads `reweave/.env`, binds `127.0.0.1:3000` by default, and avoids the Vercel CLI Rust dev-server port race:

```sh
cd reweave
cargo run --bin local-backend
```

Set `LOCAL_BACKEND_ADDR` to use a different bind address:

```sh
cd reweave
LOCAL_BACKEND_ADDR=127.0.0.1:3001 cargo run --bin local-backend
```

The backend still deploys as Vercel serverless functions. Use the Vercel CLI only when you specifically need to test Vercel's local function runtime:

```sh
cd reweave
DATABASE_URL=... vc dev
```

The local database must have the schema from `schema.sql` applied before creating or loading puzzles. For example, from the repo root:

```sh
psql "$DATABASE_URL" -f schema.sql
```

Someone running the single-process local backend does not need access to the production Vercel project.

### Build And Checks

Build the frontend against the current generated WASM package:

```sh
pnpm --dir frontend run build
```

Build the frontend the same way deployment does:

```sh
wasm-pack build frontend --target bundler --out-dir pkg && pnpm --dir frontend run build
```

Run common checks:

```sh
pnpm --dir frontend run lint
cargo test -p reweave
cargo check -p frontend --target wasm32-unknown-unknown
cargo fmt --check
```

## Environment

The frontend reads `VITE_API_URL` as its API base URL. If it is unset, requests use same-origin `/api`; Vite proxies `/api` to `http://localhost:3000` during local frontend development.

The backend requires `DATABASE_URL` in all environments. Use a local PostgreSQL database URL for development and the production PostgreSQL URL in deployed environments. Local browser requests usually come from `http://localhost:5173`, so include that in `ALLOWED_ORIGIN` when making cross-origin requests directly to the backend.

## Deploy

The root `vercel.json` deploys the frontend. It installs the Rust WASM target, installs `wasm-pack`, installs global `pnpm@9`, builds the WASM package, and outputs `frontend/dist`.

The backend has its own `reweave/vercel.json` and is deployed separately from `reweave/`. It includes CORS headers for `/api/(.*)` and rewrites `/api/puzzle/:puzzle_id` to `/api/puzzle?puzzle_id=:puzzle_id`.
