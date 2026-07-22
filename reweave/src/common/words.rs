/// Converts a lowercase ASCII byte to a child-array index.
///
/// # Panics
///
/// Panics if `b` is not in `a..=z`. The trie is intentionally specialized for
/// the normalized lowercase dictionary used by the game.
fn idx(b: u8) -> usize {
    assert!(b.is_ascii_lowercase(), "Invalid bit found when indexing");
    (b - b'a') as usize
}

/// Internal trie node backed by a fixed lowercase ASCII child array.
struct TrieNode {
    children: [Option<Box<TrieNode>>; 26],
    is_word: bool,
}

impl TrieNode {
    fn new() -> Self {
        TrieNode {
            children: Default::default(),
            is_word: false,
        }
    }

    #[allow(unused)]
    /// Returns every suffix word reachable from this node.
    ///
    /// A terminal node contributes the empty suffix so callers can prepend their
    /// existing prefix without losing words that end exactly at this node.
    fn return_words(&self) -> Vec<String> {
        let mut out = Vec::new();
        for n in 0..26_u8 {
            let Some(next_node) = &self.children[n as usize] else {
                continue;
            };
            let c = (n + b'a') as char;

            for word in next_node.return_words() {
                out.push(format!("{c}{word}"));
            }
        }

        if self.is_word {
            out.push("".to_string());
        }

        out
    }
}

/// Prefix tree used to efficiently store lowercase ASCII dictionary words.
///
/// The trie is immutable after construction and only accepts bytes in `a..=z`.
/// Lookup methods panic on non-lowercase ASCII input through the shared indexer.
pub struct Trie {
    root: Box<TrieNode>,
}

impl Trie {
    /// Constructs a trie from lowercase ASCII words.
    ///
    /// # Panics
    ///
    /// Panics if any word contains a byte outside `a..=z`.
    pub fn new(words: Vec<&str>) -> Self {
        let mut this = Trie {
            root: Box::new(TrieNode::new()),
        };

        for word in words {
            let mut curr = &mut this.root;
            for b in word.bytes() {
                curr = curr.children[idx(b)].get_or_insert_with(|| Box::new(TrieNode::new()));
            }

            curr.is_word = true;
        }

        this
    }

    /// Searches for all words in the trie starting with `prefix`.
    ///
    /// This is currently only used by tests and debugging helpers; board search
    /// uses [`Trie::is_prefix`] and [`Trie::is_word`] directly.
    ///
    /// # Panics
    ///
    /// Panics if `prefix` contains a byte outside `a..=z`.
    #[allow(unused)]
    fn search(&self, prefix: &str) -> Vec<String> {
        let mut curr = &self.root;
        for b in prefix.bytes() {
            let Some(node) = &curr.children[idx(b)] else {
                return vec![];
            };
            curr = node;
        }

        curr.return_words()
            .iter()
            .map(|found_word| format!("{prefix}{found_word}"))
            .collect()
    }

    /// Returns whether `word` is present as a complete dictionary word.
    ///
    /// # Panics
    ///
    /// Panics if `word` contains a byte outside `a..=z`.
    pub fn is_word(&self, word: &str) -> bool {
        let mut curr = &self.root;
        for b in word.bytes() {
            let Some(node) = &curr.children[idx(b)] else {
                return false;
            };
            curr = node;
        }

        curr.is_word
    }

    /// Returns whether any dictionary word starts with `prefix`.
    ///
    /// The empty prefix is valid and returns `true`.
    ///
    /// # Panics
    ///
    /// Panics if `prefix` contains a byte outside `a..=z`.
    pub fn is_prefix(&self, prefix: &str) -> bool {
        let mut curr = &self.root;
        for b in prefix.bytes() {
            let Some(node) = &curr.children[idx(b)] else {
                return false;
            };
            curr = node;
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic() {
        let words = vec!["abs", "abacus", "teeth", "tusk"];

        let trie = Trie::new(words);
        assert_eq!(trie.search("a"), vec!["abacus", "abs"]);
        assert_eq!(trie.search("ab"), vec!["abacus", "abs"]);
        assert_eq!(trie.search("aba"), vec!["abacus"]);
        assert_eq!(trie.search("t"), vec!["teeth", "tusk"]);
        assert_eq!(trie.search("tu"), vec!["tusk"]);
    }

    #[test]
    fn no_search_matches() {
        let words = vec!["abs", "abacus", "teeth", "tusk"];

        let trie = Trie::new(words);
        assert_eq!(trie.search("x"), Vec::<String>::new());
        assert_eq!(trie.search("abas"), Vec::<String>::new());
    }

    #[test]
    #[should_panic]
    fn invalid_trie() {
        let words = vec!["abs", "abacus", "teeth", "tusk", "你好"];

        Trie::new(words);
    }

    #[test]
    #[should_panic]
    fn invalid_search() {
        let words = vec!["hello", "hey", "hi"];

        let trie = Trie::new(words);
        trie.search("H");
    }

    #[test]
    fn is_valid_prefix() {
        let words = vec!["test", "teach", "toaster"];

        let trie = Trie::new(words);
        assert!(trie.is_prefix("te"));
    }

    #[test]
    fn is_not_valid_prefix() {
        let words = vec!["test", "teach", "toaster"];

        let trie = Trie::new(words);
        assert!(!trie.is_prefix("ta"));
    }
}
