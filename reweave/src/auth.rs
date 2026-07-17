use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::Deserialize;
use std::env;
use vercel_runtime::Request;

use crate::db::{AppUser, ClerkUserData, ensure_app_user};

const CLERK_JWT_ISSUER_ENV: &str = "CLERK_JWT_ISSUER";
const CLERK_JWT_AUDIENCE_ENV: &str = "CLERK_JWT_AUDIENCE";
const CLERK_SECRET_KEY_ENV: &str = "CLERK_SECRET_KEY";

#[derive(Debug)]
pub struct AuthError(pub String);

#[derive(Debug, Deserialize)]
struct ClerkClaims {
    sub: String,
    email: Option<String>,
    username: Option<String>,
    name: Option<String>,
    picture: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClerkEmailAddress {
    email_address: String,
    id: String,
}

#[derive(Debug, Deserialize)]
struct ClerkUserResponse {
    id: String,
    username: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    image_url: Option<String>,
    primary_email_address_id: Option<String>,
    email_addresses: Vec<ClerkEmailAddress>,
}

impl ClerkUserResponse {
    fn display_name(&self) -> Option<String> {
        let name = [self.first_name.as_deref(), self.last_name.as_deref()]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ");

        if name.is_empty() { None } else { Some(name) }
    }

    fn primary_email(&self) -> Option<String> {
        self.primary_email_address_id
            .as_deref()
            .and_then(|primary_id| {
                self.email_addresses
                    .iter()
                    .find(|email| email.id == primary_id)
            })
            .or_else(|| self.email_addresses.first())
            .map(|email| email.email_address.clone())
    }
}

fn bearer_token(req: &Request) -> Result<&str, AuthError> {
    let header = req
        .headers()
        .get("Authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AuthError(String::from("missing authorization token")))?;

    header
        .strip_prefix("Bearer ")
        .filter(|token| !token.is_empty())
        .ok_or_else(|| AuthError(String::from("invalid authorization token")))
}

async fn clerk_jwks(issuer: &str) -> Result<JwkSet, AuthError> {
    let url = format!("{}/.well-known/jwks.json", issuer.trim_end_matches('/'));

    reqwest::get(url)
        .await
        .map_err(|e| AuthError(e.to_string()))?
        .error_for_status()
        .map_err(|e| AuthError(e.to_string()))?
        .json::<JwkSet>()
        .await
        .map_err(|e| AuthError(e.to_string()))
}

async fn verify_clerk_token(token: &str) -> Result<ClerkClaims, AuthError> {
    let issuer = env::var(CLERK_JWT_ISSUER_ENV)
        .map_err(|_| AuthError(String::from("missing CLERK_JWT_ISSUER")))?;
    let header = decode_header(token).map_err(|e| AuthError(e.to_string()))?;
    let kid = header
        .kid
        .ok_or_else(|| AuthError(String::from("missing token key id")))?;
    let jwks = clerk_jwks(&issuer).await?;
    let jwk = jwks
        .find(&kid)
        .ok_or_else(|| AuthError(String::from("unknown token key id")))?;
    let decoding_key = DecodingKey::from_jwk(jwk).map_err(|e| AuthError(e.to_string()))?;
    let mut validation = Validation::new(Algorithm::RS256);

    validation.set_issuer(&[issuer.as_str()]);

    match env::var(CLERK_JWT_AUDIENCE_ENV) {
        Ok(audience) if !audience.is_empty() => validation.set_audience(&[audience.as_str()]),
        _ => validation.validate_aud = false,
    }

    decode::<ClerkClaims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|e| AuthError(e.to_string()))
}

async fn clerk_user_data_from_api(clerk_user_id: &str) -> Result<Option<ClerkUserData>, AuthError> {
    let secret_key = match env::var(CLERK_SECRET_KEY_ENV) {
        Ok(secret_key) if !secret_key.is_empty() => secret_key,
        _ => return Ok(None),
    };
    let url = format!("https://api.clerk.com/v1/users/{}", clerk_user_id);
    let user = reqwest::Client::new()
        .get(url)
        .bearer_auth(secret_key)
        .send()
        .await
        .map_err(|e| AuthError(e.to_string()))?
        .error_for_status()
        .map_err(|e| AuthError(e.to_string()))?
        .json::<ClerkUserResponse>()
        .await
        .map_err(|e| AuthError(e.to_string()))?;
    let display_name = user.display_name();
    let email = user.primary_email();

    Ok(Some(ClerkUserData {
        clerk_user_id: user.id,
        username: user.username,
        display_name,
        avatar_url: user.image_url,
        email,
    }))
}

pub async fn require_app_user(req: &Request) -> Result<AppUser, AuthError> {
    let token = bearer_token(req)?;
    let claims = verify_clerk_token(token).await?;
    let clerk_user_id = claims.sub.clone();

    let user_data = match clerk_user_data_from_api(&clerk_user_id).await? {
        Some(user_data) => user_data,
        None => ClerkUserData {
            clerk_user_id,
            username: claims.username,
            display_name: claims.name,
            avatar_url: claims.picture,
            email: claims.email,
        },
    };

    ensure_app_user(user_data)
        .await
        .map_err(|e| AuthError(e.to_string()))
}

pub async fn optional_app_user(req: &Request) -> Result<Option<AppUser>, AuthError> {
    if req.headers().get("Authorization").is_none() {
        return Ok(None);
    }

    require_app_user(req).await.map(Some)
}
