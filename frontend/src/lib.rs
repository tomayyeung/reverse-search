use std::sync::{OnceLock, RwLock};
use wasm_bindgen::prelude::*;

use reweave::common::*;

static WORDS: OnceLock<words::Trie> = OnceLock::new();

/// Gets or inits a Trie with the full wordlist
fn get_words() -> &'static words::Trie {
    WORDS.get_or_init(|| {
        words::Trie::new(
            include_str!("../../wordlist/wordlist.txt")
                .lines()
                .collect(),
        )
    })
}

/// Given parameters to create a board, find all the words in it
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

static CURR_PUZZLE: OnceLock<RwLock<Option<puzzle::Puzzle>>> = OnceLock::new();

fn get_lock() -> &'static RwLock<Option<puzzle::Puzzle>> {
    CURR_PUZZLE.get_or_init(|| RwLock::new(None))
}

/// Load into CURR_PUZZLE a puzzle from JSON
#[wasm_bindgen]
pub fn load_puzzle(puzzle_json: JsValue) -> Result<(), JsValue> {
    let puzzle: puzzle::Puzzle =
        serde_wasm_bindgen::from_value(puzzle_json).map_err(|e| JsValue::from(e.to_string()))?;

    let lock = get_lock();
    let mut guard = lock.write().unwrap();

    *guard = Some(puzzle);

    Ok(())
}

/// Given letters on a board, check against current puzzle
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

/// When creating and wordlist is complete, create a temporary puzzle so that clearing letters updates words
#[wasm_bindgen]
pub fn load_puzzle_for_create(width: u32, height: u32, words: Vec<String>) -> Result<JsValue, JsValue> {
    let lock = get_lock();
    let mut guard = lock.write().unwrap();

    *guard = Some(
        puzzle::Puzzle::create(
            String::new(),
            width as usize,
            height as usize,
            " ".repeat((width * height) as usize),
            words.into_iter().collect(),
        ).map_err(JsValue::from)?,
    );

    Ok(JsValue::from("successful load"))
}
