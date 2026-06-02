# The game

Player is given a list of words and must reconstruct a board of letters that allows spelling out all the words, Word Hunt style. Depending on game configuration, they might get some free letters already placed into the board, or a list of letters theyneed to insert.

# Tech Stack

## Functionality
- All game logic is built in Rust

## Frontend
- Vite + React
- Rust compiles to WebAssembly for client-side game logic.

## Backend
- Rust runtime on Vercel serverless functions.
- Database for puzzles (and users?): Neon Serverless Postgres (subject to change)
- Deployed separately from frontend