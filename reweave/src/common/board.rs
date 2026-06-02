use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::words::*;

/// A cell of the board, indexed by its coordinates
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub struct BoardCell(pub usize, pub usize);

/// A board of letters, some of which might not be filled in
pub struct Board {
    pub width: usize,
    pub height: usize,
    pub cells: Vec<Vec<Option<char>>>,
}

const BLANK: char = '_';
const HOLE: char = '!';

impl Board {
    /// Create a Board given a width, height, and a vector of characters
    /// Panics if the length of chars does not match width * height
    /// For an empty cell, pass in '_'
    pub fn create(width: usize, height: usize, chars: Vec<char>) -> Result<Self, String> {
        assert_eq!(width * height, chars.len());

        let mut cells: Vec<Vec<Option<char>>> = Vec::new();
        let mut i = 0;
        for _ in 0..height {
            let mut row = Vec::new();

            for _ in 0..width {
                let c = chars.get(i).unwrap();
                i += 1;

                if *c == BLANK || *c == HOLE {
                    // Empty cell / hole in puzzle
                    row.push(None);
                } else if c.is_ascii_lowercase() {
                    // Is valid letter
                    row.push(Some(*c));
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

    pub fn get(&self, cell: BoardCell) -> Option<char> {
        *self.cells.get(cell.0)?.get(cell.1)?
    }

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

/// Given a Board of letters and a word list, find all words
pub fn find_words(board: &Board, word_list: &Trie) -> Vec<String> {
    let mut out_hash_set = HashSet::new();

    let cells: Vec<BoardCell> = (0..board.height)
        .flat_map(|i| {
            (0..board.width)
                .map(|j| BoardCell(i, j))
                .collect::<Vec<BoardCell>>()
        })
        .collect();

    // First letter: one of the cells in the board
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

/// Adjacent cells
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

/// Recursive DFS to find all words in a board.
/// Returns a Hash Set so that words are unique.
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

    // Add to curr string and visited
    curr_s.push(c);
    visited.push(curr_cell);

    // Process current string
    if !word_list.is_prefix(curr_s) {
        curr_s.pop();
        visited.pop();
        return HashSet::new();
    }

    if word_list.is_word(curr_s) {
        out.insert(curr_s.clone());
    }

    // Traverse adjacent cells
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

    // Remove from curr string and visited
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
}
