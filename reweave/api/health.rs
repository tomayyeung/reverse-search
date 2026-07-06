use serde_json::json;
use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

pub async fn handler(_req: Request) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(json!("ok")))?)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
