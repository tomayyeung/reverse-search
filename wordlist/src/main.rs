//! Standalone word-list generator for the playable dictionary.
//!
//! This crate reads local `CSW24.txt` and `blacklist.txt` inputs, filters short
//! and blacklisted words, and overwrites `wordlist.txt`. The inputs are
//! gitignored, so this crate is intentionally excluded from the workspace.

use std::collections::HashSet;
use std::fs;

/// Loads a newline-delimited word file as lowercase trimmed words.
///
/// Missing files are treated as setup errors and panic with a simple message.
fn load_words(path: &str) -> HashSet<String> {
    fs::read_to_string(path)
        .expect("Failed to read file")
        .lines()
        .map(|w| w.trim().to_lowercase())
        .collect()
}

/// Generates simple suffix variants, e.g. `working` from `work`.
fn generate_variants(word: &str) -> Vec<String> {
    vec![
        word.to_string(),
        format!("{}s", word),
        format!("{}es", word),
        format!("{}d", word),
        format!("{}ed", word),
        format!("{}ing", word),
    ]
}

/// Expands blacklist roots into a broader set of simple inflections.
fn expand_blacklist(base: &HashSet<String>) -> HashSet<String> {
    let mut expanded = HashSet::new();

    for word in base {
        for variant in generate_variants(word) {
            expanded.insert(variant);
        }
    }

    expanded
}

/// Removes words shorter than `length` bytes.
///
/// The source dictionary is expected to be ASCII, so byte length matches word
/// length for normal inputs.
fn remove_short_words(words: HashSet<String>, length: usize) -> HashSet<String> {
    words
        .into_iter()
        .filter(|w| w.len() >= length)
        .collect()
}

/// Filters blacklisted words and returns the remaining words in unspecified order.
fn filter_words(
    words: HashSet<String>,
    blacklist: &HashSet<String>,
) -> Vec<String> {
    words
        .into_iter()
        .filter(|w| !blacklist.contains(w))
        .collect()
}

/// Overwrites `path` with one word per line.
fn write_words(path: &str, words: &[String]) {
    let content = words.join("\n");
    fs::write(path, content).expect("Failed to write file");
}

/// 2024 Collins Scrabble Word list.
const ORIG_WORD_LIST: &str = "CSW24.txt";

/// Modified list from https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words?tab=readme-ov-file.
const BLACKLIST: &str = "blacklist.txt";

/// Generated dictionary embedded by the frontend WASM crate.
const CLEAN_WORD_LIST: &str = "wordlist.txt";

fn main() {
    // Get original word list
    let words = load_words(ORIG_WORD_LIST);
    println!("Started with {} words", words.len());

    // Remove words shorter than 4 letters
    let words = remove_short_words(words, 4);

    // Load blacklist
    let blacklist = expand_blacklist(&load_words(BLACKLIST));

    // Filter out
    let clean_words = filter_words(words, &blacklist);
    write_words(CLEAN_WORD_LIST, &clean_words);

    println!("Filtered down to {} words", clean_words.len());
}
