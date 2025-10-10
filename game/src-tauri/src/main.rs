
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
async fn show_window(window: tauri::Window) {
  window.get_window("main").unwrap().show().unwrap();
  window.get_window("main").unwrap().set_cursor_grab(true).unwrap();
}

#[tauri::command]
async fn grab_cursor(window: tauri::Window) {
  window.get_window("main").unwrap().set_cursor_grab(true).unwrap();
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![show_window, grab_cursor])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

