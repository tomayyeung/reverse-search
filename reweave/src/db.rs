use serde::Deserialize;
use sqlx::{PgPool, Postgres, QueryBuilder};
use std::error::Error;
use std::sync::OnceLock;
use uuid::Uuid;

use crate::common::puzzle::Puzzle;

pub static PUZZLES_POOL: OnceLock<PgPool> = OnceLock::new();

#[derive(Clone, Copy)]
pub enum PuzzleStat {
    Plays,
    Completions {
        completion_time_seconds: u32,
        used_hint: bool,
    },
}

/**
 * Necessary structs for puzzles
 */

/// A row from a table representing a puzzle, used when fetching a puzzle to play
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

/// A row from a table representing the summary of a puzzle, used when listing puzzles
#[derive(sqlx::FromRow)]
struct PuzzleSummaryRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub width: i32,
    pub height: i32,
    pub letters: String,
    pub plays: i64,
    pub completions: i64,
    pub likes: i64,
    pub created_at: String,
    pub creator_username: String,
    pub creator_display_name: Option<String>,
    pub creator_role: String,
}

#[derive(sqlx::FromRow)]
pub struct UserProfileRecord {
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub created_at: String,
}

#[derive(sqlx::FromRow)]
struct CompletedPuzzleRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub width: i32,
    pub height: i32,
    pub letters: String,
    pub plays: i64,
    pub completions: i64,
    pub likes: i64,
    pub created_at: String,
    pub creator_username: String,
    pub creator_display_name: Option<String>,
    pub creator_role: String,
    pub completion_time_seconds: i32,
    pub used_hint: bool,
    pub completed_at: String,
}

/// A summary of a puzzle, used when listing puzzles
#[derive(Deserialize)]
pub struct PuzzleSummaryRecord {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub width: usize,
    pub height: usize,
    pub letters: String,
    pub plays: u64,
    pub completions: u64,
    pub likes: u64,
    pub created_at: String,
    pub creator_username: String,
    pub creator_display_name: Option<String>,
    pub creator_role: String,
}

pub struct CompletedPuzzleRecord {
    pub puzzle: PuzzleSummaryRecord,
    pub completion_time_seconds: u32,
    pub used_hint: bool,
    pub completed_at: String,
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
            plays: row.plays as u64,
            completions: row.completions as u64,
            likes: row.likes as u64,
            created_at: row.created_at,
            creator_username: row.creator_username,
            creator_display_name: row.creator_display_name,
            creator_role: row.creator_role,
        }
    }
}

impl From<CompletedPuzzleRow> for CompletedPuzzleRecord {
    fn from(row: CompletedPuzzleRow) -> Self {
        CompletedPuzzleRecord {
            puzzle: PuzzleSummaryRecord {
                id: row.id.to_string(),
                name: row.name,
                description: row.description,
                width: row.width as usize,
                height: row.height as usize,
                letters: row.letters,
                plays: row.plays as u64,
                completions: row.completions as u64,
                likes: row.likes as u64,
                created_at: row.created_at,
                creator_username: row.creator_username,
                creator_display_name: row.creator_display_name,
                creator_role: row.creator_role,
            },
            completion_time_seconds: row.completion_time_seconds as u32,
            used_hint: row.used_hint,
            completed_at: row.completed_at,
        }
    }
}

#[derive(Clone)]
pub struct AppUser {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
}

pub struct ClerkUserData {
    pub clerk_user_id: String,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
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

/**
 * Structs and helper functions for searching for puzzles
 */

pub struct PuzzleRecordFilters {
    pub query: Option<String>,
    pub min_dimensions: Option<(usize, usize)>,
    pub max_dimensions: Option<(usize, usize)>,
    pub min_given_percent: Option<u8>,
    pub max_given_percent: Option<u8>,
}

fn push_where_clause(query: &mut QueryBuilder<Postgres>, has_where: &mut bool) {
    if *has_where {
        query.push(" AND ");
    } else {
        query.push(" WHERE ");
        *has_where = true;
    }
}

/**
 * General-use necessary functions
 */

pub fn get_puzzles_pool() -> &'static PgPool {
    PUZZLES_POOL
        .get_or_init(|| PgPool::connect_lazy(&std::env::var("DATABASE_URL").unwrap()).unwrap())
}

fn fallback_username(clerk_user_id: &str) -> String {
    let suffix: String = clerk_user_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(12)
        .collect();

    if suffix.is_empty() {
        String::from("user")
    } else {
        format!("user_{}", suffix)
    }
}

pub async fn ensure_app_user(user: ClerkUserData) -> Result<AppUser, Box<dyn Error>> {
    let has_clerk_username = user
        .username
        .as_deref()
        .is_some_and(|username| !username.trim().is_empty());
    let username = user
        .username
        .filter(|username| !username.trim().is_empty())
        .unwrap_or_else(|| fallback_username(&user.clerk_user_id));

    let (id, username, display_name): (Uuid, String, Option<String>) = sqlx::query_as(
        "INSERT INTO users (clerk_user_id, username, display_name, avatar_url, email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (clerk_user_id) DO UPDATE SET username = CASE WHEN $6 AND (users.username = 'user' OR users.username LIKE 'user_%') THEN EXCLUDED.username ELSE users.username END, avatar_url = EXCLUDED.avatar_url, email = EXCLUDED.email, updated_at = now() RETURNING id, username, display_name",
    )
    .bind(user.clerk_user_id)
    .bind(username)
    .bind(user.display_name)
    .bind(user.avatar_url)
    .bind(user.email)
    .bind(has_clerk_username)
    .fetch_one(get_puzzles_pool())
    .await?;

    Ok(AppUser {
        id,
        username,
        display_name,
    })
}

pub async fn update_user_display_name(
    user_id: Uuid,
    display_name: Option<String>,
) -> Result<AppUser, Box<dyn Error>> {
    let (id, username, display_name): (Uuid, String, Option<String>) = sqlx::query_as(
        "UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2 RETURNING id, username, display_name",
    )
    .bind(display_name)
    .bind(user_id)
    .fetch_one(get_puzzles_pool())
    .await?;

    Ok(AppUser {
        id,
        username,
        display_name,
    })
}

pub async fn get_puzzle(puzzle_id: &str) -> Option<Puzzle> {
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

pub async fn list_puzzle_records(
    limit: usize,
    filters: PuzzleRecordFilters,
) -> Result<Vec<PuzzleSummaryRecord>, Box<dyn Error>> {
    let mut query = QueryBuilder::<Postgres>::new(
        "SELECT p.id, p.name, p.description, p.width, p.height, p.letters, COALESCE(ps.plays, 0) AS plays, COALESCE(ps.completions, 0) AS completions, COALESCE(ps.likes, 0) AS likes, p.created_at::text AS created_at, u.username AS creator_username, u.display_name AS creator_display_name, u.role AS creator_role FROM puzzles p LEFT JOIN puzzle_stats ps ON ps.puzzle_id = p.id JOIN users u ON u.id = p.created_by_user_id",
    );
    let mut has_where = false;

    if let Some(text_query) = filters.query {
        let pattern = format!("%{}%", text_query);
        push_where_clause(&mut query, &mut has_where);
        query
            .push("(p.name ILIKE ")
            .push_bind(pattern.clone())
            .push(" OR p.description ILIKE ")
            .push_bind(pattern)
            .push(")");
    }

    if let Some((min_small, min_large)) = filters.min_dimensions {
        push_where_clause(&mut query, &mut has_where);
        query
            .push("LEAST(p.width, p.height) >= ")
            .push_bind(min_small as i32)
            .push(" AND GREATEST(p.width, p.height) >= ")
            .push_bind(min_large as i32);
    }

    if let Some((max_small, max_large)) = filters.max_dimensions {
        push_where_clause(&mut query, &mut has_where);
        query
            .push("LEAST(p.width, p.height) <= ")
            .push_bind(max_small as i32)
            .push(" AND GREATEST(p.width, p.height) <= ")
            .push_bind(max_large as i32);
    }

    let percent_sql = "((length(replace(replace(p.letters, '_', ''), '!', '')) * 100 + (p.width * p.height / 2)) / (p.width * p.height))";

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
        .push(" ORDER BY p.name ASC LIMIT ")
        .push_bind(limit as i64);

    let rows = query
        .build_query_as::<PuzzleSummaryRow>()
        .fetch_all(get_puzzles_pool())
        .await?;

    Ok(rows.into_iter().map(PuzzleSummaryRecord::from).collect())
}

pub async fn get_user_profile_record(
    username: &str,
) -> Result<Option<UserProfileRecord>, Box<dyn Error>> {
    let profile = sqlx::query_as::<_, UserProfileRecord>(
        "SELECT username, display_name, avatar_url, role, created_at::text AS created_at FROM users WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(get_puzzles_pool())
    .await?;

    Ok(profile)
}

pub async fn list_created_puzzle_records(
    username: &str,
) -> Result<Vec<PuzzleSummaryRecord>, Box<dyn Error>> {
    let rows = sqlx::query_as::<_, PuzzleSummaryRow>(
        "SELECT p.id, p.name, p.description, p.width, p.height, p.letters, COALESCE(ps.plays, 0) AS plays, COALESCE(ps.completions, 0) AS completions, COALESCE(ps.likes, 0) AS likes, p.created_at::text AS created_at, u.username AS creator_username, u.display_name AS creator_display_name, u.role AS creator_role FROM puzzles p LEFT JOIN puzzle_stats ps ON ps.puzzle_id = p.id JOIN users u ON u.id = p.created_by_user_id WHERE u.username = $1 ORDER BY p.created_at DESC",
    )
    .bind(username)
    .fetch_all(get_puzzles_pool())
    .await?;

    Ok(rows.into_iter().map(PuzzleSummaryRecord::from).collect())
}

pub async fn list_completed_puzzle_records(
    username: &str,
) -> Result<Vec<CompletedPuzzleRecord>, Box<dyn Error>> {
    let rows = sqlx::query_as::<_, CompletedPuzzleRow>(
        "SELECT p.id, p.name, p.description, p.width, p.height, p.letters, COALESCE(ps.plays, 0) AS plays, COALESCE(ps.completions, 0) AS completions, COALESCE(ps.likes, 0) AS likes, p.created_at::text AS created_at, creator.username AS creator_username, creator.display_name AS creator_display_name, creator.role AS creator_role, e.completion_time_seconds, e.used_hint, e.created_at::text AS completed_at FROM puzzle_completion_events e JOIN users profile_user ON profile_user.id = e.user_id JOIN puzzles p ON p.id = e.puzzle_id LEFT JOIN puzzle_stats ps ON ps.puzzle_id = p.id JOIN users creator ON creator.id = p.created_by_user_id WHERE profile_user.username = $1 ORDER BY e.created_at DESC",
    )
    .bind(username)
    .fetch_all(get_puzzles_pool())
    .await?;

    Ok(rows.into_iter().map(CompletedPuzzleRecord::from).collect())
}

pub async fn insert_puzzle_into_db(
    puzzle: Puzzle,
    creator: &AppUser,
) -> Result<String, Box<dyn Error>> {
    let words: Vec<String> = puzzle.words.iter().cloned().collect();
    let mut transaction = get_puzzles_pool().begin().await?;

    let uuid: Uuid = sqlx::query_scalar(
        "INSERT INTO puzzles (name, description, width, height, letters, words, answer, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(puzzle.name)
    .bind(puzzle.description)
    .bind(puzzle.width as i32)
    .bind(puzzle.height as i32)
    .bind(puzzle.letters)
    .bind(&words as &[String])
    .bind(puzzle.answer)
    .bind(creator.id)
    .fetch_one(&mut *transaction)
    .await?;

    sqlx::query("INSERT INTO puzzle_stats (puzzle_id) VALUES ($1)")
        .bind(uuid)
        .execute(&mut *transaction)
        .await?;

    transaction.commit().await?;

    Ok(uuid.to_string())
}

pub async fn increment_puzzle_stat(
    puzzle_id: &str,
    stat: PuzzleStat,
    user: Option<&AppUser>,
) -> Result<(), Box<dyn Error>> {
    let puzzle_id = Uuid::parse_str(puzzle_id)?;

    let result = match stat {
        PuzzleStat::Plays => {
            sqlx::query("UPDATE puzzle_stats SET plays = plays + 1 WHERE puzzle_id = $1")
                .bind(puzzle_id)
                .execute(get_puzzles_pool())
                .await?
        }
        PuzzleStat::Completions {
            completion_time_seconds,
            used_hint,
        } => {
            let mut transaction = get_puzzles_pool().begin().await?;
            let result = sqlx::query(
                "UPDATE puzzle_stats SET completions = completions + 1 WHERE puzzle_id = $1",
            )
            .bind(puzzle_id)
            .execute(&mut *transaction)
            .await?;

            if result.rows_affected() > 0 {
                sqlx::query(
                    "INSERT INTO puzzle_completion_events (puzzle_id, user_id, completion_time_seconds, used_hint) VALUES ($1, $2, $3, $4)",
                )
                .bind(puzzle_id)
                .bind(user.map(|user| user.id))
                .bind(completion_time_seconds as i32)
                .bind(used_hint)
                .execute(&mut *transaction)
                .await?;
            }

            transaction.commit().await?;
            result
        }
    };

    if result.rows_affected() == 0 {
        Err(format!("invalid puzzle id: {}", puzzle_id).into())
    } else {
        Ok(())
    }
}
