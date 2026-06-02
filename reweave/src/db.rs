use sqlx::PgPool;
use std::error::Error;
use std::sync::OnceLock;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

use crate::common::puzzle::Puzzle;

pub static PUZZLES_POOL: OnceLock<PgPool> = OnceLock::new();

#[derive(sqlx::FromRow)]
struct PuzzleRow {
    #[allow(unused)]
    pub id: String,
    pub width: i32,
    pub height: i32,
    pub letters: String,
    pub words: Vec<String>,
}

impl From<PuzzleRow> for Puzzle {
    fn from(row: PuzzleRow) -> Self {
        Puzzle {
            width: row.width as usize,
            height: row.height as usize,
            letters: row.letters,
            words: row.words.into_iter().collect(),
        }
    }
}

pub fn get_puzzles_pool() -> &'static PgPool {
    PUZZLES_POOL
        .get_or_init(|| PgPool::connect_lazy(&std::env::var("DATABASE_URL").unwrap()).unwrap())
}

pub async fn get_puzzle(puzzle_id: &str) -> Option<Puzzle> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        Puzzle::from_file(format!("../puzzles/{}", puzzle_id).as_str()).ok()
    } else {
        let Ok(puzzle_row) = sqlx::query_as::<_, PuzzleRow>(" SELECT * FROM puzzles WHERE id = $1")
            .bind(puzzle_id)
            .fetch_one(get_puzzles_pool())
            .await
        else {
            return None;
        };

        Some(Puzzle::from(puzzle_row))
    }
}

pub async fn insert_puzzle_into_db(id: String, puzzle: Puzzle) -> Result<(), Box<dyn Error>> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        let json_data = serde_json::to_string(&puzzle)?;
        let mut file = File::create(format!("../puzzles/{}", id)).await?;
        file.write_all(json_data.as_bytes()).await?;
        file.flush().await?;

        Ok(())
    } else {
        let words: Vec<String> = puzzle.words.iter().cloned().collect();

        sqlx::query(
            "INSERT INTO puzzles (id, letters, width, height, words) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(id)
        .bind(puzzle.letters)
        .bind(puzzle.width as i32)
        .bind(puzzle.height as i32)
        .bind(&words as &[String])
        .execute(get_puzzles_pool())
        .await?;

        Ok(())
    }
}
