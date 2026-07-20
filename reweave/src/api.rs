use vercel_runtime::{Error, Request, Response, ResponseBody};

use crate::auth::{optional_app_user, require_app_user};
use crate::helper::{
    CreateInput, IncrementPuzzleStatInput, ListPuzzlesInput, LoadInput, ProfileInput,
    UpdateMeInput, cors_response, create, current_user, forbidden_origin_response, increment_stat,
    json_err_response, json_response, list_puzzles, load_profile, load_puzzle, read_json_body,
    require_allowed_origin, unauthorized_response, update_current_user,
};

/// Shared preflight OPTIONS response from allowed origin
fn preflight_response(origin: Option<&str>) -> Result<Response<ResponseBody>, Error> {
    match origin {
        Some(origin) => cors_response(204, "", origin),
        None => forbidden_origin_response(),
    }
}

/// /api/health returns HTTP 200 with an "ok"
pub async fn health(_req: Request) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(serde_json::json!("ok")))?)
}

/// POST /api/create creates and adds to a database a puzzle given its details
/// 
/// Requires user token, otherwise returns unauthorized response
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

/// GET /api/me syncs a user's account between Clerk (auth provider) and our user database
///
/// PATCH /api/me modifies a user's display name
///
/// Requires a Clerk bearer token from the signed-in frontend user. Inserts or updates that Clerk user in the app’s local users table.
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

/// GET /api/profile returns the profile of a user with the given username
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

/// GET /api/puzzle or GET /api/puzzle/:puzzle_id returns the puzzle with the given puzzle ID 
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
        _ => json_err_response("Invalid method request", origin.as_deref()),
    }
}

/// GET /api/puzzles returns a list of puzzles matching the given filters
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

/// POST /api/stats adds a play or completion of the given puzzle, along with a user and other data
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
