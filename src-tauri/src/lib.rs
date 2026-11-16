//! Crochet Studio — desktop shell.
//!
//! Deliberately thin: the application is the web build, and this only gives it a
//! real window. No Rust-side state, no commands, no plugins — the studio stores
//! everything in IndexedDB inside the webview, exactly as it does in a browser,
//! so there is only ever one implementation of the persistence to trust.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Crochet Studio n'a pas pu démarrer");
}
