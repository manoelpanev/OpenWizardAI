use crate::adapters::all_adapters;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub id: String,
    pub display_name: String,
}

/// Liste aller in dieser Version unterstützten KI-Tools, für den
/// Tool-Auswahl-Schritt im Wizard-UI.
#[tauri::command]
pub fn list_supported_tools() -> Vec<ToolInfo> {
    all_adapters()
        .iter()
        .map(|adapter| ToolInfo {
            id: adapter.id().to_string(),
            display_name: adapter.display_name().to_string(),
        })
        .collect()
}
