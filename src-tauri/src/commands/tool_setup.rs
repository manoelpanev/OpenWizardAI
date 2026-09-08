use crate::adapters::{all_adapters, ExistingConfig, HitlLevel, WizardConfig};
use crate::fs::writer::{self, WriteOutcome};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Vom Frontend gesendete Konfiguration für einen Wizard-Lauf.
#[derive(Debug, Deserialize)]
pub struct SetupProjectRequest {
    pub project_name: String,
    pub project_root: String,
    /// IDs der im UI gewählten Tools (`ToolAdapter::id()`), z.B.
    /// ["claude-code", "codex"].
    pub selected_tool_ids: Vec<String>,
    pub hitl_level: HitlLevel,
    /// Pfade, für die der Nutzer ein Überschreiben bereits bestätigt hat.
    #[serde(default)]
    pub already_confirmed: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SetupProjectResponse {
    pub outcomes: Vec<WriteOutcome>,
}

/// Erkennt für alle in M1 unterstützten Tools, ob im Zielordner bereits
/// eine Konfiguration existiert (Docking-Fall aus CONCEPT.md). Wird vom
/// Frontend aufgerufen, bevor der Nutzer die Tool-Auswahl trifft, damit
/// bereits erkannte Tools vorausgewählt werden können.
#[tauri::command]
pub fn detect_existing_tools(project_root: String) -> Vec<(String, ExistingConfig)> {
    let root = PathBuf::from(project_root);
    all_adapters()
        .iter()
        .filter_map(|adapter| {
            adapter
                .detect_existing(&root)
                .map(|existing| (adapter.id().to_string(), existing))
        })
        .collect()
}

/// Kern-Command des Wizards: erzeugt für jedes gewählte Tool die nötigen
/// Dateien und die HITL-Projektion, und schreibt sie über `fs::writer`.
#[tauri::command]
pub fn setup_project(request: SetupProjectRequest) -> SetupProjectResponse {
    let config = WizardConfig {
        project_name: request.project_name,
        project_root: PathBuf::from(request.project_root),
        hitl_level: request.hitl_level,
    };

    let mut all_writes = Vec::new();

    for adapter in all_adapters() {
        if !request.selected_tool_ids.contains(&adapter.id().to_string()) {
            continue;
        }

        all_writes.extend(adapter.generate_files(&config));
        all_writes.extend(adapter.project_hitl_level(config.hitl_level));
    }

    let outcomes = writer::apply(all_writes, config.hitl_level, &request.already_confirmed);

    SetupProjectResponse { outcomes }
}
