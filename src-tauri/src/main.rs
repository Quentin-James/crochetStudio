// Hide the console window on Windows in a release build: a desktop app that
// opens a terminal behind itself looks broken.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    crochet_studio_lib::run()
}
