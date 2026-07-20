use vercel_runtime::{Error, run, service_fn};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(reweave::api::create_handler)).await
}
