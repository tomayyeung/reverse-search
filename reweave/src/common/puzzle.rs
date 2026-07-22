use std::collections::HashSet;
use std::error::Error;
use std::fs::File;

use serde::{Deserialize, Serialize};

/// Result of comparing words currently present on a board to a puzzle's targets.
///
/// Ordering is unspecified because comparison is set-based.
#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub struct Words {
    /// Required puzzle words that are present on the current board.
    pub found: Vec<String>,
    /// Required puzzle words that are absent from the current board.
    pub missing: Vec<String>,
    /// Valid dictionary words present on the board but not required by the puzzle.
    pub extra: Vec<String>,
}

/// Persisted puzzle data shared by the backend, frontend, and WASM boundary.
///
/// `letters` and `answer` are row-major board strings of `width * height`
/// characters. In serialized board strings, `_` represents a fillable blank and
/// `!` represents a permanent hole.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Puzzle {
    /// User-facing puzzle title.
    pub name: String,
    /// Optional user-facing description shown on puzzle cards and play pages.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Board width in columns.
    pub width: usize,
    /// Board height in rows.
    pub height: usize,
    /// Starting board shown to the player, with hidden answer letters replaced by `_`.
    pub letters: String,
    /// Required lowercase target words for the puzzle.
    pub words: HashSet<String>,
    /// Solved board, using the same row-major layout as `letters`.
    pub answer: String,
}

impl Puzzle {
    /// Creates a puzzle from board strings and required words.
    ///
    /// This validates that `letters.len() == width * height`. It does not
    /// currently validate `answer.len()`, board characters, word casing, or that
    /// the required words are actually present in `answer`.
    ///
    /// # Errors
    ///
    /// Returns an error when the starting board length does not match the board
    /// dimensions.
    pub fn create(
        name: String,
        description: Option<String>,
        width: usize,
        height: usize,
        letters: String,
        words: HashSet<String>,
        answer: String,
    ) -> Result<Self, String> {
        if width * height != letters.len() {
            return Err("Width and height do not match length of chars".to_string());
        }

        Ok(Puzzle {
            name,
            description,
            width,
            height,
            letters,
            words,
            answer,
        })
    }

    /// Compares found board words against this puzzle's required word set.
    ///
    /// Duplicate `found_words` entries are ignored. Returned vector ordering is
    /// unspecified.
    pub fn compare_found_words(&self, found_words: Vec<String>) -> Words {
        let found_words_set: HashSet<_> = found_words.into_iter().collect();

        Words {
            found: found_words_set.intersection(&self.words).cloned().collect(),
            missing: self.words.difference(&found_words_set).cloned().collect(),
            extra: found_words_set.difference(&self.words).cloned().collect(),
        }
    }

    /// Loads a puzzle from a JSON file matching the serialized [`Puzzle`] shape.
    ///
    /// This helper is intended for local tools and tests. File and JSON parsing
    /// failures are returned to the caller.
    pub fn from_file(path: &str) -> Result<Self, Box<dyn Error>> {
        let data = File::open(path)?;
        let puzzle = serde_json::from_reader(data)?;
        Ok(puzzle)
    }
}

#[cfg(test)]
mod tests {
    use std::vec;

    use super::*;
    use crate::common::board::*;
    use crate::common::words::*;

    fn from_board(board: &Board, word_list: &Trie) -> Puzzle {
        let answer: String = board
            .cells
            .iter()
            .flat_map(|row| row.iter())
            .map(|cell| cell.unwrap_or('_'))
            .collect();

        Puzzle {
            name: String::from(""),
            description: None,
            width: board.width,
            height: board.height,
            letters: answer.clone(),
            words: find_words(board, word_list).into_iter().collect(),
            answer,
        }
    }

    #[test]
    fn cmp_words() {
        let puzzle = Puzzle {
            words: HashSet::from(["abc".to_string(), "def".to_string()]),
            ..Default::default()
        };

        assert_eq!(
            puzzle.compare_found_words(vec!["abc".to_string(), "ghi".to_string()]),
            Words {
                found: vec!["abc".to_string()],
                missing: vec!["def".to_string()],
                extra: vec!["ghi".to_string()],
            }
        );
    }

    #[test]
    fn cmp_puzzle_from() {
        let board = Board::create(2, 2, vec!['c', 'a', 't', 's']).unwrap();
        let word_list = Trie::new(vec!["act", "cat", "cats"]);
        let puzzle = from_board(&board, &word_list);

        let mut words = puzzle.compare_found_words(vec![
            "act".to_string(),
            "cat".to_string(),
            "cart".to_string(),
        ]);
        words.found.sort();

        assert_eq!(
            words,
            Words {
                found: vec!["act".to_string(), "cat".to_string()],
                missing: vec!["cats".to_string()],
                extra: vec!["cart".to_string()],
            }
        );
    }
}
