use super::{ExistingConfig, FileWrite, HitlLevel, ToolAdapter, WizardConfig, WriteMode};
use std::path::Path;

/// Adapter für OpenChamber/opencode. Einziger Adapter in M1 mit eigenem
/// strukturiertem Permission-Format (`opencode.jsonc`) statt reinem
/// Hinweistext — siehe CONCEPT.md, Ursprung.
pub struct OpencodeAdapter;

impl ToolAdapter for OpencodeAdapter {
    fn id(&self) -> &'static str {
        "opencode"
    }

    fn display_name(&self) -> &'static str {
        "OpenChamber / opencode"
    }

    fn detect_existing(&self, project_root: &Path) -> Option<ExistingConfig> {
        let candidates = [
            project_root.join("opencode.jsonc"),
            project_root.join("HANDOFF.md"),
        ];
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
        let permission_mode = hitl_to_permission_mode(config.hitl_level);
        let content = format!(
            "{{\n  // Von OpenWizardAI generiert für {}\n  \"permission\": \"{}\"\n}}\n",
            config.project_name, permission_mode
        );

        vec![FileWrite {
            path: config.project_root.join("opencode.jsonc"),
            content,
            mode: WriteMode::OverwriteIfConfirmed,
        }]
    }

    fn project_hitl_level(&self, level: HitlLevel) -> Vec<FileWrite> {
        // opencode hat einen eigenen Permission-Modus in opencode.jsonc —
        // die Stufe wird dort strukturiert eingetragen statt nur als Text.
        let permission_mode = hitl_to_permission_mode(level);

        vec![FileWrite {
            path: Path::new("opencode.jsonc").to_path_buf(),
            content: format!("\"permission\": \"{}\"", permission_mode),
            mode: WriteMode::Merge,
        }]
    }
}

fn hitl_to_permission_mode(level: HitlLevel) -> &'static str {
    match level {
        HitlLevel::AlwaysAsk => "ask-always",
        HitlLevel::AskOnRisky => "ask-on-risky",
        HitlLevel::AskRarely => "ask-rarely",
        HitlLevel::Autonomous => "autonomous",
    }
}
