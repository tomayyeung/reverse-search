# The game

Player is given a list of words and must reconstruct a board of letters that allows spelling out all the words, Word Hunt style. Depending on game configuration, they might get some free letters already placed into the board, or a list of letters they need to insert.

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

# Todo
- [ ] users w/ auth
  - [ ] only registered users can create
  - [ ] keeps track of completed puzzles
  - [ ] creating a puzzle records the user who made it
- [ ] auth to backend - not everyone should be able to access backend, especially /api/create
- [ ] ui/ux
  - [x] popup on puzzle completion
    - [ ] with info - ~~puzzle name~~, time
  - [x] while creating, when done creating word list, clearing letters (making them not hard set) should update wordlist accordingly, as if you're playing
  - [x] puzzle not found page
  - [x] create puzzles w/ different size
  - [x] after submitted created puzzle, "Play your puzzle" link shouldn't appear until there is a response from backend containing puzzle id
  - [ ] homepage, existing puzzles/search page
  - [x] make everything look not shit
  - [x] clear board button
- [x] puzzle stores answer
  - [x] give up button
- [x] dictionary: words can be clicked to view dictionary definition; use external dictionary api
- [x] db changes
  - [x] for each puzzle, have a separate "name" column that stores a readable name, and generate a unique "id" - this allows puzzles of same name
- [ ] modify puzzle
