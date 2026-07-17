use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::auth::require_app_user;
use reweave::helper::{
    CreateInput, cors_response, create, forbidden_origin_response, json_err_response,
    json_response, read_json_body, require_allowed_origin, unauthorized_response,
};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => cors_response(204, "", &origin),
        "POST" => {
            let user = match require_app_user(&req).await {
                Ok(user) => user,
                Err(err) => return unauthorized_response(&err.0, &origin),
            };
            let params: CreateInput = read_json_body(req).await?;
            json_response(create(params, &user).await, &origin)
        }
        _ => json_err_response("Invalid method request", &origin),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
