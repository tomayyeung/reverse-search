use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::helper::{
    ProfileInput, cors_response, forbidden_origin_response, json_err_response, json_response,
    load_profile, require_allowed_origin,
};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let origin = match require_allowed_origin(&req) {
        Ok(origin) => origin,
        Err(_) => return forbidden_origin_response(),
    };

    match req.method().as_str() {
        "OPTIONS" => match origin.as_deref() {
            Some(origin) => cors_response(204, "", origin),
            None => forbidden_origin_response(),
        },
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

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
