use sqlx::{PgPool, Postgres, QueryBuilder};
use std::error::Error;
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
    pub description: Option<String>,
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
    pub description: Option<String>,
    pub width: i32,
    pub height: i32,
    pub letters: String,
}

pub struct PuzzleSummaryRecord {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub width: usize,
    pub height: usize,
    pub letters: String,
}

pub struct PuzzleRecordFilters {
    pub query: Option<String>,
    pub min_dimensions: Option<(usize, usize)>,
    pub max_dimensions: Option<(usize, usize)>,
    pub min_given_percent: Option<u8>,
    pub max_given_percent: Option<u8>,
}

fn starting_letters(letters: &str) -> usize {
    letters
        .chars()
        .filter(|letter| *letter != '_' && *letter != '!')
        .count()
}

fn given_percent(width: usize, height: usize, letters: &str) -> u8 {
    let total_cells = width * height;

    if total_cells == 0 {
        0
    } else {
        ((starting_letters(letters) * 100 + total_cells / 2) / total_cells) as u8
    }
}

fn normalized_dimensions(width: usize, height: usize) -> (usize, usize) {
    (width.min(height), width.max(height))
}

fn matches_filters(record: &PuzzleSummaryRecord, filters: &PuzzleRecordFilters) -> bool {
    if let Some(query) = &filters.query {
        let query = query.to_lowercase();
        let name = record.name.to_lowercase();
        let description = record.description.as_deref().unwrap_or("").to_lowercase();

        if !name.contains(&query) && !description.contains(&query) {
            return false;
        }
    }

    let dimensions = normalized_dimensions(record.width, record.height);

    if let Some(min_dimensions) = filters.min_dimensions {
        if dimensions.0 < min_dimensions.0 || dimensions.1 < min_dimensions.1 {
            return false;
        }
    }

    if let Some(max_dimensions) = filters.max_dimensions {
        if dimensions.0 > max_dimensions.0 || dimensions.1 > max_dimensions.1 {
            return false;
        }
    }

    let percent = given_percent(record.width, record.height, &record.letters);

    if let Some(min_given_percent) = filters.min_given_percent {
        if percent < min_given_percent {
            return false;
        }
    }

    if let Some(max_given_percent) = filters.max_given_percent {
        if percent > max_given_percent {
            return false;
        }
    }

    true
}

fn push_where_clause(query: &mut QueryBuilder<Postgres>, has_where: &mut bool) {
    if *has_where {
        query.push(" AND ");
    } else {
        query.push(" WHERE ");
        *has_where = true;
    }
}

impl From<PuzzleSummaryRow> for PuzzleSummaryRecord {
    fn from(row: PuzzleSummaryRow) -> Self {
        PuzzleSummaryRecord {
            id: row.id.to_string(),
            name: row.name,
            description: row.description,
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
            description: row.description,
            width: row.width as usize,
            height: row.height as usize,
            letters: row.letters,
            words: row.words.into_iter().collect(),
            answer: row.answer,
        }
    }
}

pub fn get_puzzles_pool() -> &'static PgPool {
    PUZZLES_POOL
        .get_or_init(|| PgPool::connect_lazy(&std::env::var("DATABASE_URL").unwrap()).unwrap())
}

pub async fn get_puzzle(puzzle_id: &str) -> Option<Puzzle> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        Puzzle::from_file(format!("../puzzles/{}.json", puzzle_id).as_str()).ok()
    } else {
        let Ok(puzzle_row) = sqlx::query_as::<_, PuzzleRow>(
            "SELECT name, description, width, height, letters, words, answer FROM puzzles WHERE id = $1",
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

pub async fn list_puzzle_records(
    limit: usize,
    filters: PuzzleRecordFilters,
) -> Result<Vec<PuzzleSummaryRecord>, Box<dyn Error>> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        let mut records = Vec::new();
        let mut entries = fs::read_dir("../puzzles").await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }

            let puzzle = Puzzle::from_file(path.to_string_lossy().as_ref())?;
            let Some(id) = path.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };

            records.push(PuzzleSummaryRecord {
                id: id.to_string(),
                name: puzzle.name,
                description: puzzle.description,
                width: puzzle.width,
                height: puzzle.height,
                letters: puzzle.letters,
            });
        }

        records.retain(|record| matches_filters(record, &filters));
        records.sort_by(|a, b| a.name.cmp(&b.name));
        records.truncate(limit);
        Ok(records)
    } else {
        let mut query = QueryBuilder::<Postgres>::new(
            "SELECT id, name, description, width, height, letters FROM puzzles",
        );
        let mut has_where = false;

        if let Some(text_query) = filters.query {
            let pattern = format!("%{}%", text_query);
            push_where_clause(&mut query, &mut has_where);
            query
                .push("(name ILIKE ")
                .push_bind(pattern.clone())
                .push(" OR description ILIKE ")
                .push_bind(pattern)
                .push(")");
        }

        if let Some((min_small, min_large)) = filters.min_dimensions {
            push_where_clause(&mut query, &mut has_where);
            query
                .push("LEAST(width, height) >= ")
                .push_bind(min_small as i32)
                .push(" AND GREATEST(width, height) >= ")
                .push_bind(min_large as i32);
        }

        if let Some((max_small, max_large)) = filters.max_dimensions {
            push_where_clause(&mut query, &mut has_where);
            query
                .push("LEAST(width, height) <= ")
                .push_bind(max_small as i32)
                .push(" AND GREATEST(width, height) <= ")
                .push_bind(max_large as i32);
        }

        let percent_sql = "((length(replace(replace(letters, '_', ''), '!', '')) * 100 + (width * height / 2)) / (width * height))";

        if let Some(min_given_percent) = filters.min_given_percent {
            push_where_clause(&mut query, &mut has_where);
            query
                .push(percent_sql)
                .push(" >= ")
                .push_bind(min_given_percent as i32);
        }

        if let Some(max_given_percent) = filters.max_given_percent {
            push_where_clause(&mut query, &mut has_where);
            query
                .push(percent_sql)
                .push(" <= ")
                .push_bind(max_given_percent as i32);
        }

        query
            .push(" ORDER BY name ASC LIMIT ")
            .push_bind(limit as i64);

        let rows = query
            .build_query_as::<PuzzleSummaryRow>()
            .fetch_all(get_puzzles_pool())
            .await?;

        Ok(rows.into_iter().map(PuzzleSummaryRecord::from).collect())
    }
}

pub async fn insert_puzzle_into_db(puzzle: Puzzle) -> Result<String, Box<dyn Error>> {
    if std::env::var("USE_LOCAL_FILES").is_ok() {
        let json_data = serde_json::to_string(&puzzle)?;
        let mut file = File::create(format!("../puzzles/{}.json", puzzle.name)).await?;
        file.write_all(json_data.as_bytes()).await?;
        file.flush().await?;

        Ok(puzzle.name)
    } else {
        let words: Vec<String> = puzzle.words.iter().cloned().collect();

        let uuid: Uuid = sqlx::query_scalar(
            "INSERT INTO puzzles (name, description, width, height, letters, words, answer) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        )
        .bind(puzzle.name)
        .bind(puzzle.description)
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
