use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::words::*;

/// A cell of the board, indexed by row and column.
///
/// The tuple order is `(row, column)`, both zero-indexed. This is intentionally
/// not an `(x, y)` coordinate.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub struct BoardCell(pub usize, pub usize);

/// A rectangular board of lowercase letters and empty cells.
///
/// `cells` is stored row-major as `height` rows of `width` columns. Parsed
/// blanks (`_`) and holes (`!`) are both stored as `None`, so this type does not
/// preserve the visual distinction between fillable blanks and permanent holes.
pub struct Board {
    /// Number of columns in each row.
    pub width: usize,
    /// Number of rows in the board.
    pub height: usize,
    /// Row-major cell data. Each row has `width` entries and there are `height` rows.
    pub cells: Vec<Vec<Option<char>>>,
}

// Fillable blank in serialized board strings.
const BLANK: char = '_';
// Permanent hole in serialized board strings. Board search treats holes as empty.
const HOLE: char = '!';

impl Board {
    /// Creates a board from row-major serialized characters.
    ///
    /// Lowercase ASCII letters become playable cells. `_` and `!` become empty
    /// cells, which means hole information is intentionally discarded for word
    /// search.
    ///
    /// # Errors
    ///
    /// Returns an error when `chars.len()` does not equal `width * height`, or
    /// when any non-empty character is not a lowercase ASCII letter.
    pub fn create(width: usize, height: usize, chars: Vec<char>) -> Result<Self, String> {
        if width * height != chars.len() {
            return Err(format!(
                "Board dimensions {width}x{height} do not match {} letters",
                chars.len()
            ));
        }

        let mut cells: Vec<Vec<Option<char>>> = Vec::new();
        let mut chars = chars.into_iter();

        for _ in 0..height {
            let mut row = Vec::new();

            for _ in 0..width {
                let Some(c) = chars.next() else {
                    return Err("Board dimensions changed while creating board".to_string());
                };

                if c == BLANK || c == HOLE {
                    // Blanks and holes are both unsearchable during word finding.
                    row.push(None);
                } else if c.is_ascii_lowercase() {
                    row.push(Some(c));
                } else {
                    return Err(format!("Invalid character when creating board {c}"));
                }
            }

            cells.push(row);
        }

        Ok(Board {
            width,
            height,
            cells,
        })
    }

    /// Returns the letter at `cell`, or `None` for out-of-bounds or empty cells.
    ///
    /// `BoardCell` coordinates are `(row, column)`.
    pub fn get(&self, cell: BoardCell) -> Option<char> {
        *self.cells.get(cell.0)?.get(cell.1)?
    }

    /// Returns all board cells that do not contain a letter.
    ///
    /// Because [`Board`] stores blanks and holes as `None`, both are included.
    pub fn get_empty_cells(&self) -> Vec<BoardCell> {
        let mut out = Vec::new();

        for i in 0..self.height {
            for j in 0..self.width {
                let cell = BoardCell(i, j);
                if self.get(cell).is_none() {
                    out.push(cell);
                }
            }
        }

        out
    }
}

/// Finds every dictionary word that can be traced on `board`.
///
/// Paths may move to any adjacent cell, including diagonals, and may not reuse a
/// cell within one word. Empty cells and holes are skipped. The returned words
/// are unique, but their order is unspecified.
pub fn find_words(board: &Board, word_list: &Trie) -> Vec<String> {
    let mut out_hash_set = HashSet::new();

    let cells: Vec<BoardCell> = (0..board.height)
        .flat_map(|i| {
            (0..board.width)
                .map(|j| BoardCell(i, j))
                .collect::<Vec<BoardCell>>()
        })
        .collect();

    // Start a prefix-pruned DFS from every board cell.
    for c in cells {
        out_hash_set.extend(find_words_rec(
            c,
            &mut "".to_string(),
            &mut vec![],
            board,
            word_list,
        ));
    }

    out_hash_set.into_iter().collect()
}

/// Eight-neighbor adjacency offsets, including diagonals.
const ADJ: [(isize, isize); 8] = [
    (1, 1),
    (1, 0),
    (1, -1),
    (0, -1),
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, 1),
];

/// Recursive DFS to find all words reachable from `curr_cell`.
///
/// `curr_s` and `visited` are mutated during descent and restored before return.
/// Trie prefix checks prune branches that cannot form any dictionary word, and
/// the returned set deduplicates words reachable by multiple paths.
fn find_words_rec(
    curr_cell: BoardCell,
    curr_s: &mut String,
    visited: &mut Vec<BoardCell>,
    board: &Board,
    word_list: &Trie,
) -> HashSet<String> {
    let mut out = HashSet::new();

    // Empty cell
    let Some(c) = board.get(curr_cell) else {
        return HashSet::new();
    };

    // Add this cell to the active path.
    curr_s.push(c);
    visited.push(curr_cell);

    // Stop exploring as soon as the active path cannot become a word.
    if !word_list.is_prefix(curr_s) {
        curr_s.pop();
        visited.pop();
        return HashSet::new();
    }

    if word_list.is_word(curr_s) {
        out.insert(curr_s.clone());
    }

    // Continue through adjacent cells that are in bounds and not already used.
    for (dx, dy) in ADJ {
        // Check for out of bounds
        if curr_cell.0 == 0 && dx == -1_isize {
            continue;
        }
        if curr_cell.0 == board.height - 1 && dx == 1 {
            continue;
        }
        if curr_cell.1 == 0 && dy == -1_isize {
            continue;
        }
        if curr_cell.1 == board.width - 1 && dy == 1 {
            continue;
        }

        let next_cell = BoardCell(
            (curr_cell.0 as isize + dx) as usize,
            (curr_cell.1 as isize + dy) as usize,
        );

        // Already visited
        if visited.contains(&next_cell) {
            continue;
        }

        out.extend(find_words_rec(next_cell, curr_s, visited, board, word_list));
    }

    // Backtrack before returning to the caller.
    curr_s.pop();
    visited.pop();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find1() {
        let full_word_list = Trie::new(vec!["abc", "dab", "cab", "daba", "abe"]);
        let board = Board::create(2, 2, vec!['a', 'b', 'c', 'd']).unwrap();

        let mut found_words = find_words(&board, &full_word_list);
        found_words.sort();

        assert_eq!(found_words, vec!["abc", "cab", "dab"]);
    }

    #[test]
    fn find2() {
        let full_word_list = Trie::new(vec!["both", "broth", "foul", "trouble", "blur"]);
        let board = Board::create(3, 3, vec!['t', 'r', 'b', 'h', 'o', 'u', 'f', 'l', 'y']).unwrap();

        let mut found_words = find_words(&board, &full_word_list);
        found_words.sort();

        assert_eq!(found_words, vec!["both", "broth", "foul"]);
    }

    #[test]
    fn find3() {
        let full_word_list = Trie::new(vec!["both", "broth", "foul", "trouble", "blur"]);
        let board = Board::create(3, 3, vec!['t', 'r', 'b', 'h', 'o', 'u', 'f', 'l', '_']).unwrap();

        let mut found_words = find_words(&board, &full_word_list);
        found_words.sort();

        assert_eq!(found_words, vec!["both", "broth", "foul"]);
    }

    #[test]
    fn find4() {
        let full_word_list = Trie::new(vec!["both"]);
        let board = Board::create(2, 2, vec!['o', 't', 'b', 'h']).unwrap();

        let mut found_words = find_words(&board, &full_word_list);
        found_words.sort();

        assert_eq!(found_words, vec!["both"]);
    }

    #[test]
    fn find5() {
        let full_word_list = Trie::new(vec!["throb"]);
        let board = Board::create(3, 3, vec!['t', 'h', 'r', '_', '_', 'o', '_', '_', 'b']).unwrap();

        let mut found_words = find_words(&board, &full_word_list);
        found_words.sort();

        assert_eq!(found_words, vec!["throb"]);
    }

    #[test]
    fn create_rejects_wrong_length() {
        let board = Board::create(2, 2, vec!['a', 'b', 'c']);

        assert!(board.is_err());
    }
}
