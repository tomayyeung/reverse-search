use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::helper::{
    LoadInput, cors_response, forbidden_origin_response, json_err_response, json_response,
    load_puzzle, require_allowed_origin,
};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => cors_response(204, "", &origin),
        "GET" => {
            let params = if let Some(query) = req.uri().query() {
                // read params from query
                serde_urlencoded::from_str(query)
                    .map_err(Box::<dyn std::error::Error + Send + Sync>::from)?
            } else {
                // read params from uri path segments as a fallback
                let puzzle_id = req
                    .uri()
                    .path()
                    .split('/')
                    .next_back()
                    .unwrap_or("")
                    .to_string();
                LoadInput { puzzle_id }
            };
            json_response(load_puzzle(params).await, &origin)
        }
        _ => json_err_response("Invalid method request", &origin),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
