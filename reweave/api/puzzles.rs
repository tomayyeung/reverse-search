use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::helper::{
    cors_response, forbidden_origin_response, json_err_response, json_response, list_puzzles,
    require_allowed_origin,
};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => cors_response(204, "", &origin),
        "GET" => json_response(list_puzzles().await, &origin),
        _ => json_err_response("Invalid method request", &origin),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
