// Öffentlich, damit die Integrationstests in `tests/` den Wizard-Ablauf
// von außen durchspielen können.
pub mod adapters;
pub mod commands;
pub mod deepseek;
pub mod fs;
pub mod registry;
pub mod websearch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::list_supported_tools,
            commands::analyze::analyze_project,
            commands::tool_setup::detect_existing_tools,
            commands::tool_setup::list_opencode_models,
            commands::tool_setup::setup_project,
            commands::deepseek::connect_deepseek,
            commands::deepseek::deepseek_connection_status,
            commands::deepseek::disconnect_deepseek,
            commands::deepseek::generate_followup_questions,
            commands::deepseek::check_answer_clarity,
            commands::deepseek::get_onboarding_recommendation,
            commands::websearch::connect_tavily,
            commands::websearch::tavily_connection_status,
            commands::websearch::disconnect_tavily,
            commands::websearch::research_topic,
            commands::registry::list_custom_apis,
            commands::registry::save_custom_api,
            commands::registry::recheck_custom_api,
            commands::registry::delete_custom_api,
            commands::registry::custom_api_has_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
