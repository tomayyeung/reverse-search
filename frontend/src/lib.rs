//! WebAssembly bindings used by the React frontend.
//!
//! This crate wraps the shared `reweave::common` Rust logic behind small
//! `wasm-bindgen` exports. The generated JavaScript and TypeScript package in
//! `frontend/pkg/` is produced by `wasm-pack` and should not be edited by hand.

use std::sync::{OnceLock, RwLock};
use wasm_bindgen::prelude::*;

use reweave::common::*;

// Lazily initialized dictionary trie embedded into the WASM module. Updating
// wordlist/wordlist.txt requires rebuilding this package with wasm-pack.
static WORDS: OnceLock<words::Trie> = OnceLock::new();

/// Returns the process-global trie for the embedded playable dictionary.
fn get_words() -> &'static words::Trie {
    WORDS.get_or_init(|| {
        words::Trie::new(
            include_str!("../../wordlist/wordlist.txt")
                .lines()
                .collect(),
        )
    })
}

/// Finds every dictionary word present in a row-major board string.
///
/// `letters` must contain `width * height` characters. Lowercase ASCII letters
/// are searchable cells, `_` is a blank, and `!` is a hole. The returned word
/// order is unspecified.
///
/// # Errors
///
/// Returns a JavaScript error value when board dimensions or characters are
/// invalid.
#[wasm_bindgen]
pub fn find(width: u32, height: u32, letters: String) -> Result<Vec<String>, JsValue> {
    let board =
        match board::Board::create(width as usize, height as usize, letters.chars().collect()) {
            Ok(board) => board,
            Err(e) => {
                return Err(JsValue::from(e));
            }
        };

    Ok(board::find_words(&board, get_words()))
}

// Current puzzle state for `check`. The frontend calls `load_puzzle` when
// entering play mode and `load_puzzle_for_create` after locking a create word list.
static CURR_PUZZLE: OnceLock<RwLock<Option<puzzle::Puzzle>>> = OnceLock::new();

fn get_lock() -> &'static RwLock<Option<puzzle::Puzzle>> {
    CURR_PUZZLE.get_or_init(|| RwLock::new(None))
}

/// Loads a serialized [`puzzle::Puzzle`] into the WASM module's global state.
///
/// The value must match the Rust `Puzzle` JSON shape. Subsequent [`check`] calls
/// compare board contents against this loaded puzzle.
#[wasm_bindgen]
pub fn load_puzzle(puzzle_json: JsValue) -> Result<(), JsValue> {
    let puzzle: puzzle::Puzzle =
        serde_wasm_bindgen::from_value(puzzle_json).map_err(|e| JsValue::from(e.to_string()))?;

    let lock = get_lock();
    let mut guard = lock.write().unwrap();

    *guard = Some(puzzle);

    Ok(())
}

/// Checks a row-major board string against the currently loaded puzzle.
///
/// The returned JavaScript value serializes [`puzzle::Words`], which the
/// TypeScript frontend casts into its `PlayWords` shape at page boundaries.
///
/// # Errors
///
/// Returns an error if no puzzle has been loaded or if the board string is
/// invalid for the loaded puzzle dimensions.
#[wasm_bindgen]
pub fn check(letters: String) -> Result<JsValue, JsValue> {
    let lock = get_lock();
    let guard = lock.read().unwrap();

    let Some(ref puzzle) = *guard else {
        return Err(JsValue::from("No puzzle loaded yet"));
    };

    let board = match board::Board::create(puzzle.width, puzzle.height, letters.chars().collect()) {
        Ok(board) => board,
        Err(e) => return Err(JsValue::from(e)),
    };

    let found_words = board::find_words(&board, get_words());
    serde_wasm_bindgen::to_value(&puzzle.compare_found_words(found_words)).map_err(JsValue::from)
}

/// Loads temporary puzzle state for the create flow after the word list is locked.
///
/// This lets the frontend reuse [`check`] while authors hide clue letters. The
/// temporary puzzle has no persisted name or answer; its `letters` field is only
/// a length placeholder because [`puzzle::Puzzle::create`] currently validates
/// starting-board length but not characters.
#[wasm_bindgen]
pub fn load_puzzle_for_create(
    width: u32,
    height: u32,
    words: Vec<String>,
) -> Result<JsValue, JsValue> {
    let lock = get_lock();
    let mut guard = lock.write().unwrap();

    *guard = Some(
        puzzle::Puzzle::create(
            String::new(), // no name needed
            None,
            width as usize,
            height as usize,
            " ".repeat((width * height) as usize), // no starting letters needed
            words.into_iter().collect(),
            String::new(), // no stored answer needed
        )
        .map_err(JsValue::from)?,
    );

    Ok(JsValue::from("successful load"))
}
