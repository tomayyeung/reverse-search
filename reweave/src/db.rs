use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashSet;
use std::error::Error;
use std::path::Path;
use std::sync::OnceLock;
use tokio::fs;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::common::puzzle::Puzzle;

pub static PUZZLES_POOL: OnceLock<PgPool> = OnceLock::new();

#[derive(sqlx::FromRow)]
struct PuzzleRow {
    pub name: String,
    pub width: i32,
    pub height: i32,
    pub letters: String,
    pub words: Vec<String>,
    pub answer: String,
}

#[derive(sqlx::FromRow)]
struct PuzzleSummaryRow {
    pub id: Uuid,
    pub name: String,
    pub width: i32,
    pub height: i32,
    pub letters: String,
}

pub struct PuzzleSummaryRecord {
    pub id: String,
    pub name: String,
    pub width: usize,
    pub height: usize,
    pub letters: String,
}

#[derive(Deserialize, Serialize)]
struct LocalPuzzleRecord {
    name: String,
    width: usize,
    height: usize,
    letters: String,
    words: HashSet<String>,
    answer: String,
    plays: u64,
    completions: u64,
    likes: u64,
    created_at: String,
}

impl From<PuzzleSummaryRow> for PuzzleSummaryRecord {
    fn from(row: PuzzleSummaryRow) -> Self {
        PuzzleSummaryRecord {
            id: row.id.to_string(),
            name: row.name,
            width: row.width as usize,
            height: row.height as usize,
            letters: row.letters,
        }
    }
}

impl From<PuzzleRow> for Puzzle {
    fn from(row: PuzzleRow) -> Self {
        Puzzle {
            name: row.name,
            width: row.width as usize,
            height: row.height as usize,
            letters: row.letters,
            words: row.words.into_iter().collect(),
            answer: row.answer,
        }
    }
}

impl From<Puzzle> for LocalPuzzleRecord {
    fn from(puzzle: Puzzle) -> Self {
        LocalPuzzleRecord {
            name: puzzle.name,
            width: puzzle.width,
            height: puzzle.height,
            letters: puzzle.letters,
            words: puzzle.words,
            answer: puzzle.answer,
            plays: 0,
            completions: 0,
            likes: 0,
            created_at: Utc::now().to_rfc3339(),
        }
    }
}

impl From<LocalPuzzleRecord> for Puzzle {
    fn from(record: LocalPuzzleRecord) -> Self {
        Puzzle {
            name: record.name,
            width: record.width,
            height: record.height,
            letters: record.letters,
            words: record.words,
            answer: record.answer,
        }
    }
}

async fn read_local_puzzle_record(
    path: impl AsRef<Path>,
) -> Result<LocalPuzzleRecord, Box<dyn Error>> {
    let data = fs::read_to_string(path).await?;
    Ok(serde_json::from_str(&data)?)
}

pub fn get_puzzles_pool() -> &'static PgPool {
    PUZZLES_POOL
        .get_or_init(|| PgPool::connect_lazy(&std::env::var("DATABASE_URL").unwrap()).unwrap())
}

pub async fn get_puzzle(puzzle_id: &str) -> Option<Puzzle> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        read_local_puzzle_record(format!("../puzzles/{}.json", puzzle_id))
            .await
            .ok()
            .map(Puzzle::from)
    } else {
        let Ok(puzzle_row) = sqlx::query_as::<_, PuzzleRow>(
            "SELECT name, width, height, letters, words, answer FROM puzzles WHERE id = $1",
        )
        .bind(Uuid::parse_str(puzzle_id).ok()?)
        .fetch_one(get_puzzles_pool())
        .await
        else {
            return None;
        };

        Some(Puzzle::from(puzzle_row))
    }
}

pub async fn list_puzzle_records() -> Result<Vec<PuzzleSummaryRecord>, Box<dyn Error>> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        let mut records = Vec::new();
        let mut entries = fs::read_dir("../puzzles").await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }

            let puzzle = read_local_puzzle_record(&path).await?;
            let Some(id) = path.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };

            records.push(PuzzleSummaryRecord {
                id: id.to_string(),
                name: puzzle.name,
                width: puzzle.width,
                height: puzzle.height,
                letters: puzzle.letters,
            });
        }

        records.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(records)
    } else {
        let rows = sqlx::query_as::<_, PuzzleSummaryRow>(
            "SELECT id, name, width, height, letters FROM puzzles ORDER BY name ASC",
        )
        .fetch_all(get_puzzles_pool())
        .await?;

        Ok(rows.into_iter().map(PuzzleSummaryRecord::from).collect())
    }
}

pub async fn insert_puzzle_into_db(puzzle: Puzzle) -> Result<String, Box<dyn Error>> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        let record = LocalPuzzleRecord::from(puzzle);
        let id = record.name.clone();
        let json_data = serde_json::to_string(&record)?;
        let mut file = File::create(format!("../puzzles/{}.json", id)).await?;
        file.write_all(json_data.as_bytes()).await?;
        file.flush().await?;

        Ok(id)
    } else {
        let words: Vec<String> = puzzle.words.iter().cloned().collect();

        let uuid: Uuid = sqlx::query_scalar(
            "INSERT INTO puzzles (name, width, height, letters, words, answer) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        )
        .bind(puzzle.name)
        .bind(puzzle.width as i32)
        .bind(puzzle.height as i32)
        .bind(puzzle.letters)
        .bind(&words as &[String])
        .bind(puzzle.answer)
        .fetch_one(get_puzzles_pool())
        .await?;

        Ok(uuid.to_string())
    }
}
