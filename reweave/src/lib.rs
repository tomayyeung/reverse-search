//! Shared game logic and backend support for Reweave.
//!
//! The [`common`] module is compiled for both the backend crate and the
//! browser-facing WASM crate. Backend-only modules are excluded from `wasm32`
//! builds so the frontend can reuse board and puzzle logic without pulling in
//! HTTP, auth, or database dependencies.

pub mod common;

// The browser WASM package only needs deterministic game logic.
#[cfg(not(target_arch = "wasm32"))]
pub mod api;

#[cfg(not(target_arch = "wasm32"))]
pub mod auth;

#[cfg(not(target_arch = "wasm32"))]
pub mod db;

#[cfg(not(target_arch = "wasm32"))]
pub mod helper;
