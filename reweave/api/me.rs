//! /api/me syncs a user's account between Clerk (auth provider) and our user database
//! Requires a Clerk bearer token from the signed-in frontend user. Inserts or updates that Clerk user in the app’s local users table.

use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::auth::require_app_user;
use reweave::helper::{
    UpdateMeInput, cors_response, current_user, forbidden_origin_response, json_err_response,
    json_response, read_json_body, require_allowed_origin, unauthorized_response,
    update_current_user,
};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => cors_response(204, "", &origin),
        "GET" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, &origin),
            };

            json_response(current_user(&user), &origin)
        }
        "PATCH" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, &origin),
            };
            let params: UpdateMeInput = read_json_body(req).await?;

            json_response(update_current_user(params, &user).await, &origin)
        }
        _ => json_err_response("Invalid method request", &origin),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
