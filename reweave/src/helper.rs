use http_body_util::BodyExt;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashSet;
use std::env;
use vercel_runtime::{Error, Request, Response, ResponseBody};

use crate::common::puzzle;
use crate::db::*;

#[derive(Serialize)]
pub struct ErrorResponse(pub String);

const ALLOWED_ORIGIN_ENV: &str = "ALLOWED_ORIGIN";
const DEFAULT_PUZZLES_LIMIT: usize = 24;
const MAX_PUZZLES_LIMIT: usize = 100;
const DESCRIPTION_LIMIT: usize = 60;

fn allowed_origin_from_request(req: &Request) -> Option<&str> {
    req.headers()
        .get("Origin")
        .and_then(|origin| origin.to_str().ok())
}

fn is_allowed_origin(origin: &str) -> bool {
    env::var(ALLOWED_ORIGIN_ENV)
        .ok()
        .map(|allowed_origins| {
            allowed_origins
                .split(',')
                .map(str::trim)
                .any(|allowed_origin| allowed_origin == origin)
        })
        .unwrap_or(false)
}

pub fn require_allowed_origin(req: &Request) -> Result<String, ErrorResponse> {
    let Some(origin) = allowed_origin_from_request(req) else {
        return Err(ErrorResponse(String::from("Forbidden origin")));
    };

    if is_allowed_origin(origin) {
        Ok(origin.to_string())
    } else {
        Err(ErrorResponse(String::from("Forbidden origin")))
    }
}

/// Create a CORS response to OPTIONS method requests
pub fn cors_response(
    status: u16,
    body: impl Into<ResponseBody>,
    origin: &str,
) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", origin)
        .header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .header("Vary", "Origin")
        .body(body.into())?)
}

pub fn forbidden_origin_response() -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(403)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(json!({ "error": "Forbidden origin" })))?)
}

/// Create a JSON response to most HTTP requests
pub fn json_response<T: Serialize>(
    out: Result<T, ErrorResponse>,
    origin: &str,
) -> Result<Response<ResponseBody>, Error> {
    // Status and value depend on Ok or Err
    let (status, value) = match out {
        Ok(val) => (200, json!(val)),
        Err(e) => (400, json!( {"error": e.0} )),
    };

    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", origin)
        .header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .header("Vary", "Origin")
        .body(ResponseBody::from(value))?)
}

/// Create a JSON response with an error message
pub fn json_err_response(err: &str, origin: &str) -> Result<Response<ResponseBody>, Error> {
    json_response::<Value>(Err(ErrorResponse(String::from(err))), origin)
}

/// Parse HTTP JSON body
pub async fn read_json_body<T: DeserializeOwned>(req: Request) -> Result<T, Error> {
    let bytes = req.into_body().collect().await?.to_bytes();
    Ok(serde_json::from_slice(&bytes)?)
}

#[derive(Deserialize)]
pub struct CreateInput {
    name: String,
    description: Option<String>,
    width: usize,
    height: usize,
    letters: String,
    words: HashSet<String>,
    answer: String,
}

#[derive(Serialize)]
pub struct CreateOutput {
    id: String,
}

pub async fn create(inp: CreateInput) -> Result<CreateOutput, ErrorResponse> {
    let description = inp
        .description
        .map(|description| description.trim().to_string());

    if description
        .as_ref()
        .is_some_and(|description| description.chars().count() > DESCRIPTION_LIMIT)
    {
        return Err(ErrorResponse(format!(
            "description must be {DESCRIPTION_LIMIT} characters or fewer"
        )));
    }

    let description = description.filter(|description| !description.is_empty());

    let puzzle = match puzzle::Puzzle::create(
        inp.name,
        description,
        inp.width,
        inp.height,
        inp.letters,
        inp.words,
        inp.answer,
    ) {
        Ok(puzzle) => puzzle,
        Err(error) => {
            return Err(ErrorResponse(error));
        }
    };

    let id = insert_puzzle_into_db(puzzle)
        .await
        .map_err(|e| ErrorResponse(e.to_string()))?;

    Ok(CreateOutput { id })
}

#[derive(Deserialize)]
pub struct LoadInput {
    pub puzzle_id: String,
}

pub async fn load_puzzle(inp: LoadInput) -> Result<puzzle::Puzzle, ErrorResponse> {
    match get_puzzle(&inp.puzzle_id).await {
        Some(puzzle) => Ok(puzzle),
        None => Err(ErrorResponse(format!(
            "invalid puzzle id: {}",
            &inp.puzzle_id
        ))),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncrementPuzzleStatInput {
    puzzle_id: String,
    event: String,
    completion_time_seconds: Option<u32>,
}

#[derive(Serialize)]
pub struct IncrementPuzzleStatOutput {
    ok: bool,
}

pub async fn increment_stat(
    inp: IncrementPuzzleStatInput,
) -> Result<IncrementPuzzleStatOutput, ErrorResponse> {
    let stat = match inp.event.as_str() {
        "play" => PuzzleStat::Plays,
        "completion" => PuzzleStat::Completions {
            completion_time_seconds: inp
                .completion_time_seconds
                .ok_or_else(|| ErrorResponse(String::from("missing completion time")))?,
        },
        _ => return Err(ErrorResponse(String::from("invalid stat event"))),
    };

    increment_puzzle_stat(&inp.puzzle_id, stat)
        .await
        .map_err(|e| ErrorResponse(e.to_string()))?;

    Ok(IncrementPuzzleStatOutput { ok: true })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleSummary {
    id: String,
    name: String,
    width: usize,
    height: usize,
    starting_letters: usize,
    total_cells: usize,
    given_percent: u8,
    plays: u64,
    completions: u64,
    description: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPuzzlesInput {
    pub limit: Option<usize>,
    pub query: Option<String>,
    pub min_width: Option<usize>,
    pub min_height: Option<usize>,
    pub max_width: Option<usize>,
    pub max_height: Option<usize>,
    pub min_given_percent: Option<u8>,
    pub max_given_percent: Option<u8>,
}

fn normalized_dimension_filter(
    width: Option<usize>,
    height: Option<usize>,
    label: &str,
) -> Result<Option<(usize, usize)>, ErrorResponse> {
    match (width, height) {
        (Some(width), Some(height)) => {
            if width == 0 || height == 0 {
                return Err(ErrorResponse(format!(
                    "{} dimensions must be greater than 0",
                    label
                )));
            }

            Ok(Some((width.min(height), width.max(height))))
        }
        (None, None) => Ok(None),
        _ => Err(ErrorResponse(format!(
            "{}Width and {}Height must be provided together",
            label, label
        ))),
    }
}

pub async fn list_puzzles(inp: ListPuzzlesInput) -> Result<Vec<PuzzleSummary>, ErrorResponse> {
    let limit = inp.limit.unwrap_or(DEFAULT_PUZZLES_LIMIT);

    if limit > MAX_PUZZLES_LIMIT {
        return Err(ErrorResponse(format!(
            "limit must be less than or equal to {}",
            MAX_PUZZLES_LIMIT
        )));
    }

    if inp.min_given_percent.is_some_and(|percent| percent > 100)
        || inp.max_given_percent.is_some_and(|percent| percent > 100)
    {
        return Err(ErrorResponse(String::from(
            "given letter percentages must be between 0 and 100",
        )));
    }

    let query = inp
        .query
        .map(|query| query.trim().to_string())
        .filter(|query| !query.is_empty());

    let filters = PuzzleRecordFilters {
        query,
        min_dimensions: normalized_dimension_filter(inp.min_width, inp.min_height, "min")?,
        max_dimensions: normalized_dimension_filter(inp.max_width, inp.max_height, "max")?,
        min_given_percent: inp.min_given_percent,
        max_given_percent: inp.max_given_percent,
    };

    let records = list_puzzle_records(limit, filters)
        .await
        .map_err(|e| ErrorResponse(e.to_string()))?;

    Ok(records
        .into_iter()
        .map(|record| {
            let total_cells = record.width * record.height;
            let starting_letters = record
                .letters
                .chars()
                .filter(|letter| *letter != '_' && *letter != '!')
                .count();
            let given_percent = if total_cells == 0 {
                0
            } else {
                ((starting_letters * 100 + total_cells / 2) / total_cells) as u8
            };

            PuzzleSummary {
                id: record.id,
                name: record.name,
                width: record.width,
                height: record.height,
                starting_letters,
                total_cells,
                given_percent,
                plays: record.plays,
                completions: record.completions,
                description: record.description,
            }
        })
        .collect())
}
