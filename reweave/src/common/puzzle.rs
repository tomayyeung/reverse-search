use std::collections::HashSet;
use std::error::Error;
use std::fs::File;

use serde::{Deserialize, Serialize};

/// A struct for the output of comparing words in a board
/// to words a puzzle requires.
#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub struct Words {
    pub found: Vec<String>,
    pub missing: Vec<String>,
    pub extra: Vec<String>,
}

/// A list of words that the player uses to create
/// a board.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Puzzle {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub width: usize,
    pub height: usize,
    /// holes, blanks are stored in letters as !, _
    pub letters: String,
    pub words: HashSet<String>,
    /// same as letters, but with letters for solution filled into blanks
    pub answer: String,
}

impl Puzzle {
    /// Create a puzzle from a starting board and a list of words
    /// For holes in the puzzle use '!'
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

    pub fn compare_found_words(&self, found_words: Vec<String>) -> Words {
        let found_words_set: HashSet<_> = found_words.into_iter().collect();

        Words {
            found: found_words_set.intersection(&self.words).cloned().collect(),
            missing: self.words.difference(&found_words_set).cloned().collect(),
            extra: found_words_set.difference(&self.words).cloned().collect(),
        }
    }

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
