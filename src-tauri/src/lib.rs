mod adapters;
mod commands;
mod deepseek;
mod fs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::list_supported_tools,
            commands::tool_setup::detect_existing_tools,
            commands::tool_setup::setup_project,
            commands::deepseek::connect_deepseek,
            commands::deepseek::deepseek_connection_status,
            commands::deepseek::disconnect_deepseek,
            commands::deepseek::generate_followup_questions,
            commands::deepseek::check_answer_clarity,
            commands::deepseek::get_onboarding_recommendation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
