//! Single-process local backend used instead of Vercel's Rust dev runtime.
//!
//! It loads `reweave/.env`, serves the same shared handlers as production
//! Vercel functions, and supports the frontend dev proxy on `127.0.0.1:3000` by
//! default.

use std::convert::Infallible;
use std::env;
use std::net::SocketAddr;

use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use serde_json::json;
use tokio::net::TcpListener;
use vercel_runtime::{Error, Request, Response, ResponseBody};

// Optional bind address override for local development.
const LOCAL_BACKEND_ADDR_ENV: &str = "LOCAL_BACKEND_ADDR";
const DEFAULT_ADDR: &str = "127.0.0.1:3000";

/// Routes local HTTP requests to the same handlers used by Vercel entrypoints.
///
/// The `/api/puzzle/:id` branch mirrors the deployed Vercel rewrite fallback.
async fn route(req: Request) -> Result<Response<ResponseBody>, Error> {
    match req.uri().path() {
        "/api/health" => reweave::api::health(req).await,
        "/api/create" => reweave::api::create_handler(req).await,
        "/api/me" => reweave::api::me(req).await,
        "/api/profile" => reweave::api::profile(req).await,
        "/api/puzzle" => reweave::api::puzzle(req).await,
        path if path.starts_with("/api/puzzle/") => reweave::api::puzzle(req).await,
        "/api/puzzles" => reweave::api::puzzles(req).await,
        "/api/stats" => reweave::api::stats(req).await,
        _ => Ok(Response::builder()
            .status(404)
            .header("Content-Type", "application/json")
            .body(ResponseBody::from(json!({ "error": "Not found" })))?),
    }
}

/// Converts handler errors into JSON `500` responses for the local server.
async fn handle(req: Request) -> Result<Response<ResponseBody>, Infallible> {
    match route(req).await {
        Ok(response) => Ok(response),
        Err(error) => Ok(Response::builder()
            .status(500)
            .header("Content-Type", "application/json")
            .body(ResponseBody::from(json!({ "error": error.to_string() })))
            .unwrap_or_else(|_| Response::new(ResponseBody::from("Internal Server Error")))),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load reweave/.env before reading DATABASE_URL and auth settings.
    dotenvy::dotenv().ok();

    let addr = env::var(LOCAL_BACKEND_ADDR_ENV).unwrap_or_else(|_| DEFAULT_ADDR.to_string());
    let addr: SocketAddr = addr.parse()?;
    let listener = TcpListener::bind(addr).await?;

    println!("Local backend listening on http://{addr}");

    loop {
        let (stream, _) = listener.accept().await?;
        let io = TokioIo::new(stream);

        tokio::spawn(async move {
            if let Err(error) = http1::Builder::new()
                .serve_connection(io, service_fn(handle))
                .await
            {
                eprintln!("local backend connection error: {error}");
            }
        });
    }
}
