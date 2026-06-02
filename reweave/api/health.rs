use serde_json::json;
use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::helper::json_response;

pub async fn handler(_req: Request) -> Result<Response<ResponseBody>, Error> {
    json_response(Ok(json!("ok")))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
