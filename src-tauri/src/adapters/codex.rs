use super::{ExistingConfig, FileWrite, HitlLevel, ToolAdapter, WizardConfig, WriteMode};
use std::path::Path;

/// Adapter für Codex.
pub struct CodexAdapter;

impl ToolAdapter for CodexAdapter {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn display_name(&self) -> &'static str {
        "Codex"
    }

    fn detect_existing(&self, project_root: &Path) -> Option<ExistingConfig> {
        let candidates = [project_root.join("AGENTS.md")];
        let found_paths: Vec<_> = candidates
            .into_iter()
            .filter(|p| p.exists())
            .collect();

        if found_paths.is_empty() {
            None
        } else {
            Some(ExistingConfig { found_paths })
        }
    }

    fn generate_files(&self, config: &WizardConfig) -> Vec<FileWrite> {
        let content = format!(
            "# {}\n\nProjekt-Kontext für Codex. Von OpenWizardAI generiert.\n",
            config.project_name
        );

        vec![FileWrite {
            path: config.project_root.join("AGENTS.md"),
            content,
            mode: WriteMode::OverwriteIfConfirmed,
        }]
    }

    fn project_hitl_level(&self, level: HitlLevel) -> Vec<FileWrite> {
        let note = match level {
            HitlLevel::AlwaysAsk => "Rückfrage-Modus: Immer fragen, bevor eine Aktion ausgeführt wird.",
            HitlLevel::AskOnRisky => "Rückfrage-Modus: Nur bei riskanten Aktionen fragen (Datei löschen, git push, Netzwerk).",
            HitlLevel::AskRarely => "Rückfrage-Modus: Selten fragen, nur bei irreversiblen Aktionen.",
            HitlLevel::Autonomous => "Rückfrage-Modus: Autonom, außer bei Show-Stoppern.",
        };

        vec![FileWrite {
            path: Path::new("AGENTS.md").to_path_buf(),
            content: format!("\n## Human-in-the-Loop-Einstellung\n\n{}\n", note),
            mode: WriteMode::Merge,
        }]
    }
}
