use vercel_runtime::{Error, Request, Response, ResponseBody, run, service_fn};

use reweave::helper::{
    CreateInput, cors_response, create, json_err_response, json_response, read_json_body,
};

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    match req.method().as_str() {
        "OPTIONS" => cors_response(204, ""),
        "POST" => {
            let params: CreateInput = read_json_body(req).await?;
            return json_response(create(params).await);
        }
        _ => json_err_response("Invalid method request"),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
