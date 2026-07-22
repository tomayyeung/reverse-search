//! Game-domain logic shared by the backend and browser WASM package.
//!
//! This module owns the board representation, puzzle model, and trie-backed
//! word-search implementation used by both puzzle creation and puzzle play.

/// Board parsing and adjacency-based word search.
pub mod board;
/// Persisted puzzle model and found/missing/extra word comparison.
pub mod puzzle;
/// Lowercase ASCII trie used for prefix-pruned board search.
pub mod words;
