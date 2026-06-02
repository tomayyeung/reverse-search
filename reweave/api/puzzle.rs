use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::helper::{LoadInput, cors_response, json_err_response, json_response, load_puzzle};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    match req.method().as_str() {
        "OPTIONS" => cors_response(204, ""),
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
            return json_response(load_puzzle(params).await);
        }
        _ => json_err_response("Invalid method request"),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
