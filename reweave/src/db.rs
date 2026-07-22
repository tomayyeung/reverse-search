//! PostgreSQL persistence for puzzles, users, profiles, and stats.
//!
//! The functions here assume the tables from `schema.sql` exist. Endpoint helper
//! code is responsible for API-level validation and permission checks unless a
//! function documents its own authorization clause.

use serde::Deserialize;
use sqlx::{PgPool, Postgres, QueryBuilder};
use std::error::Error;
use std::sync::OnceLock;
use uuid::Uuid;

use crate::common::puzzle::Puzzle;

/// Process-global lazy PostgreSQL pool.
///
/// Initialization reads `DATABASE_URL` and creates a lazy `sqlx` pool. Missing
/// or invalid environment configuration will panic during first access.
pub static PUZZLES_POOL: OnceLock<PgPool> = OnceLock::new();

/// Puzzle stat mutation to apply to `puzzle_stats`.
#[derive(Clone, Copy)]
pub enum PuzzleStat {
    /// Increment aggregate play count only.
    Plays,
    /// Increment completion count and insert a completion event row.
    Completions {
        /// User-visible solve duration in seconds.
        completion_time_seconds: u32,
        /// Whether the solve used any reveal/hint action.
        used_hint: bool,
    },
}

/// SQL row used when fetching a full playable puzzle.
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

/// SQL row used when listing puzzle summaries.
///
/// Field names mirror SQL aliases in the list/profile queries.
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

/// SQL row for a public user profile.
#[derive(sqlx::FromRow)]
pub struct UserProfileRecord {
    /// Stable public username.
    pub username: String,
    /// Optional user-edited display name.
    pub display_name: Option<String>,
    /// Avatar URL synchronized from Clerk.
    pub avatar_url: Option<String>,
    /// App role, where `admin` marks official users.
    pub role: String,
    /// Database creation timestamp formatted by PostgreSQL.
    pub created_at: String,
}

/// SQL row joining a completion event with the completed puzzle summary.
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

/// Internal puzzle summary record returned from database queries.
///
/// This is converted into public API response types in `helper.rs`.
#[derive(Deserialize)]
pub struct PuzzleSummaryRecord {
    /// Puzzle UUID serialized as a string.
    pub id: String,
    /// Puzzle title.
    pub name: String,
    /// Optional puzzle description.
    pub description: Option<String>,
    /// Board width in columns.
    pub width: usize,
    /// Board height in rows.
    pub height: usize,
    /// Starting board string used to calculate given-letter percentage.
    pub letters: String,
    /// Aggregate play count.
    pub plays: u64,
    /// Aggregate completion count.
    pub completions: u64,
    /// Aggregate like count, reserved for future UI.
    pub likes: u64,
    /// Puzzle creation timestamp formatted by PostgreSQL.
    pub created_at: String,
    /// Creator's public username.
    pub creator_username: String,
    /// Creator's optional display name.
    pub creator_display_name: Option<String>,
    /// Creator role, where `admin` marks official puzzles.
    pub creator_role: String,
}

/// Internal profile completion record.
pub struct CompletedPuzzleRecord {
    /// Completed puzzle summary.
    pub puzzle: PuzzleSummaryRecord,
    /// Completion duration in seconds.
    pub completion_time_seconds: u32,
    /// Whether the completion used a reveal/hint.
    pub used_hint: bool,
    /// Completion-event timestamp formatted by PostgreSQL.
    pub completed_at: String,
}

impl From<PuzzleSummaryRow> for PuzzleSummaryRecord {
    /// Converts SQL integer/UUID fields into API-facing Rust types.
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
    /// Splits the joined completion row into puzzle and event records.
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

/// Local authenticated user record returned after Clerk sync.
#[derive(Clone)]
pub struct AppUser {
    /// Local database user UUID.
    pub id: Uuid,
    /// Stable public username.
    pub username: String,
    /// Optional display name edited by the user.
    pub display_name: Option<String>,
    /// Authorization role, where `admin` can modify official content.
    pub role: String,
}

/// Clerk user data used to insert or update a local app user.
pub struct ClerkUserData {
    /// Clerk user ID from JWT `sub` or Clerk API response.
    pub clerk_user_id: String,
    /// Optional Clerk username. Missing usernames receive a generated fallback.
    pub username: Option<String>,
    /// Optional display name from Clerk.
    pub display_name: Option<String>,
    /// Optional avatar URL from Clerk.
    pub avatar_url: Option<String>,
    /// Optional primary email from Clerk.
    pub email: Option<String>,
}

impl From<PuzzleRow> for Puzzle {
    /// Converts a database row into the shared puzzle model.
    ///
    /// Database integer dimensions are cast to `usize`, and the SQL word array is
    /// collected into the puzzle's `HashSet`.
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

/// Filters used by puzzle-list database queries.
pub struct PuzzleRecordFilters {
    /// Case-insensitive text query over puzzle name and description.
    pub query: Option<String>,
    /// Orientation-insensitive minimum `(short_side, long_side)` bounds.
    pub min_dimensions: Option<(usize, usize)>,
    /// Orientation-insensitive maximum `(short_side, long_side)` bounds.
    pub max_dimensions: Option<(usize, usize)>,
    /// Minimum rounded percentage of non-hidden starting letters.
    pub min_given_percent: Option<u8>,
    /// Maximum rounded percentage of non-hidden starting letters.
    pub max_given_percent: Option<u8>,
}

/// Appends `WHERE` or `AND` while constructing dynamic SQL filters.
fn push_where_clause(query: &mut QueryBuilder<Postgres>, has_where: &mut bool) {
    if *has_where {
        query.push(" AND ");
    } else {
        query.push(" WHERE ");
        *has_where = true;
    }
}

/// Returns the global puzzle database pool.
///
/// # Panics
///
/// Panics if `DATABASE_URL` is missing or `sqlx` cannot create a lazy pool from it.
pub fn get_puzzles_pool() -> &'static PgPool {
    PUZZLES_POOL
        .get_or_init(|| PgPool::connect_lazy(&std::env::var("DATABASE_URL").unwrap()).unwrap())
}

/// Builds a stable fallback username from a Clerk user ID.
///
/// Only ASCII alphanumeric characters are kept, and at most 12 are used, so the
/// fallback is safe to expose publicly as `user_<suffix>`.
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

/// Inserts or updates a local user from Clerk data.
///
/// Existing generated usernames may be replaced by a later real Clerk username;
/// user-edited usernames are preserved. Avatar, email, and `updated_at` are kept
/// in sync with Clerk data.
pub async fn ensure_app_user(user: ClerkUserData) -> Result<AppUser, Box<dyn Error>> {
    let has_clerk_username = user
        .username
        .as_deref()
        .is_some_and(|username| !username.trim().is_empty());
    let username = user
        .username
        .filter(|username| !username.trim().is_empty())
        .unwrap_or_else(|| fallback_username(&user.clerk_user_id));

    let (id, username, display_name, role): (Uuid, String, Option<String>, String) = sqlx::query_as(
        "INSERT INTO users (clerk_user_id, username, display_name, avatar_url, email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (clerk_user_id) DO UPDATE SET username = CASE WHEN $6 AND (users.username = 'user' OR users.username LIKE 'user_%') THEN EXCLUDED.username ELSE users.username END, avatar_url = EXCLUDED.avatar_url, email = EXCLUDED.email, updated_at = now() RETURNING id, username, display_name, role",
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
        role,
    })
}

/// Updates a local user's optional display name and returns the updated user.
pub async fn update_user_display_name(
    user_id: Uuid,
    display_name: Option<String>,
) -> Result<AppUser, Box<dyn Error>> {
    let (id, username, display_name, role): (Uuid, String, Option<String>, String) = sqlx::query_as(
        "UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2 RETURNING id, username, display_name, role",
    )
    .bind(display_name)
    .bind(user_id)
    .fetch_one(get_puzzles_pool())
    .await?;

    Ok(AppUser {
        id,
        username,
        display_name,
        role,
    })
}

/// Updates puzzle metadata when `user` is the creator or an admin.
///
/// Returns `Ok(None)` when the puzzle ID is valid but permission fails or no row
/// matches. Invalid UUID strings return an error.
pub async fn update_puzzle_metadata(
    puzzle_id: &str,
    name: String,
    description: Option<String>,
    user: &AppUser,
) -> Result<Option<PuzzleSummaryRecord>, Box<dyn Error>> {
    let puzzle_id = Uuid::parse_str(puzzle_id)?;
    let row = sqlx::query_as::<_, PuzzleSummaryRow>(
        "UPDATE puzzles p SET name = $1, description = $2 WHERE p.id = $3 AND (p.created_by_user_id = $4 OR $5 = 'admin') RETURNING p.id, p.name, p.description, p.width, p.height, p.letters, COALESCE((SELECT ps.plays FROM puzzle_stats ps WHERE ps.puzzle_id = p.id), 0) AS plays, COALESCE((SELECT ps.completions FROM puzzle_stats ps WHERE ps.puzzle_id = p.id), 0) AS completions, COALESCE((SELECT ps.likes FROM puzzle_stats ps WHERE ps.puzzle_id = p.id), 0) AS likes, p.created_at::text AS created_at, (SELECT u.username FROM users u WHERE u.id = p.created_by_user_id) AS creator_username, (SELECT u.display_name FROM users u WHERE u.id = p.created_by_user_id) AS creator_display_name, (SELECT u.role FROM users u WHERE u.id = p.created_by_user_id) AS creator_role",
    )
    .bind(name)
    .bind(description)
    .bind(puzzle_id)
    .bind(user.id)
    .bind(&user.role)
    .fetch_optional(get_puzzles_pool())
    .await?;

    Ok(row.map(PuzzleSummaryRecord::from))
}

/// Loads a playable puzzle by UUID string.
///
/// Invalid UUIDs, missing rows, and query failures are collapsed to `None` for
/// API-level invalid-ID handling.
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

/// Lists puzzle summaries matching dynamic search filters.
///
/// Results are ordered by puzzle name ascending and capped by `limit`.
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

    // Round the given-letter percentage using integer arithmetic so filtering
    // matches the public API summary calculation.
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

/// Loads a public profile row by username.
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

/// Lists puzzles created by `username`, newest first.
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

/// Lists puzzle completion events for `username`, newest first.
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

/// Inserts a puzzle and initializes its aggregate stats row in one transaction.
///
/// Returns the generated puzzle UUID as a string.
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

/// Applies a play or completion stat mutation to a puzzle.
///
/// Completion mutations insert an event row inside the same transaction as the
/// aggregate count update. Signed-out completions store `NULL` for `user_id`.
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
