//! Shared endpoint handlers used by Vercel functions and the local backend.
//!
//! Files under `reweave/api/` are tiny Vercel entrypoints that delegate here so
//! request parsing, auth, CORS, and response shapes stay consistent.

use vercel_runtime::{Error, Request, Response, ResponseBody};

use crate::auth::{optional_app_user, require_app_user};
use crate::helper::*;

/// Builds the shared preflight `OPTIONS` response.
///
/// Requests without an allowed origin are rejected with the centralized CORS
/// forbidden response.
fn preflight_response(origin: Option<&str>) -> Result<Response<ResponseBody>, Error> {
    match origin {
        Some(origin) => cors_response(204, "", origin),
        None => forbidden_origin_response(),
    }
}

/// Handles `GET /api/health`.
///
/// Returns HTTP `200` with the JSON string `"ok"`.
pub async fn health(_req: Request) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(serde_json::json!("ok")))?)
}

/// Handles `OPTIONS` and `POST /api/create`.
///
/// `POST` requires a Clerk bearer token, validates a [`CreateInput`] body, and
/// persists the puzzle for the authenticated creator. Success returns
/// `{ "id": string }`; validation failures return `{ "error": string }`.
pub async fn create_handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => preflight_response(origin.as_deref()),
        "POST" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, origin.as_deref()),
            };
            let params: CreateInput = read_json_body(req).await?;
            json_response(create(params, &user).await, origin.as_deref())
        }
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}

/// Handles `OPTIONS`, `GET`, and `PATCH /api/me`.
///
/// Both non-`OPTIONS` methods require a Clerk bearer token and upsert the Clerk
/// user into the local database before returning or updating app-user metadata.
pub async fn me(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => preflight_response(origin.as_deref()),
        "GET" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, origin.as_deref()),
            };

            json_response(current_user(&user), origin.as_deref())
        }
        "PATCH" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, origin.as_deref()),
            };
            let params: UpdateMeInput = read_json_body(req).await?;

            json_response(update_current_user(params, &user).await, origin.as_deref())
        }
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}

/// Handles `OPTIONS` and public `GET /api/profile?username=<name>`.
///
/// Profile reads do not require authentication.
pub async fn profile(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => preflight_response(origin.as_deref()),
        "GET" => {
            let params = if let Some(query) = req.uri().query() {
                serde_urlencoded::from_str(query)
                    .map_err(Box::<dyn std::error::Error + Send + Sync>::from)?
            } else {
                ProfileInput {
                    username: String::new(),
                }
            };

            json_response(load_profile(params).await, origin.as_deref())
        }
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}

/// Handles `OPTIONS`, `GET`, and `PATCH /api/puzzle`.
///
/// `GET` accepts either `?puzzle_id=<id>` or a fallback `/api/puzzle/<id>` path
/// segment. `PATCH` requires authentication and only permits the puzzle creator
/// or an admin user to change title/description metadata.
pub async fn puzzle(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => preflight_response(origin.as_deref()),
        "GET" => {
            let params = if let Some(query) = req.uri().query() {
                serde_urlencoded::from_str(query)
                    .map_err(Box::<dyn std::error::Error + Send + Sync>::from)?
            } else {
                let puzzle_id = req
                    .uri()
                    .path()
                    .split('/')
                    .next_back()
                    .unwrap_or("")
                    .to_string();
                LoadInput { puzzle_id }
            };
            json_response(load_puzzle(params).await, origin.as_deref())
        }
        "PATCH" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, origin.as_deref()),
            };
            let params: UpdatePuzzleInput = read_json_body(req).await?;

            json_response(update_puzzle(params, &user).await, origin.as_deref())
        }
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}

/// Handles `OPTIONS` and public `GET /api/puzzles`.
///
/// Supported filters include `limit`, text `query`, min/max dimensions, and
/// min/max given-letter percentages.
pub async fn puzzles(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => preflight_response(origin.as_deref()),
        "GET" => {
            let params = if let Some(query) = req.uri().query() {
                serde_urlencoded::from_str(query)
                    .map_err(Box::<dyn std::error::Error + Send + Sync>::from)?
            } else {
                ListPuzzlesInput {
                    limit: None,
                    query: None,
                    min_width: None,
                    min_height: None,
                    max_width: None,
                    max_height: None,
                    min_given_percent: None,
                    max_given_percent: None,
                }
            };

            json_response(list_puzzles(params).await, origin.as_deref())
        }
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}

/// Handles `OPTIONS` and `POST /api/stats`.
///
/// Records `"play"` or `"completion"` events. Authentication is optional; when
/// present, completion events are linked to the signed-in user's profile.
pub async fn stats(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => preflight_response(origin.as_deref()),
        "POST" => {
            let user = match optional_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, origin.as_deref()),
            };
            let params: IncrementPuzzleStatInput = read_json_body(req).await?;
            json_response(
                increment_stat(params, user.as_ref()).await,
                origin.as_deref(),
            )
        }
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}
