use super::{ExistingConfig, FileWrite, HitlLevel, ToolAdapter, WizardConfig, WriteMode};
use serde::Serialize;
use std::path::Path;

/// Ein von opencode ansteuerbares Modell, wie es in `opencode.jsonc` im
/// Feld `model` als `provider/modell` eingetragen wird.
#[derive(Debug, Serialize)]
pub struct OpencodeModel {
    pub id: &'static str,
    pub display_name: &'static str,
}

/// Auswahlliste für das Modell, das unter opencode läuft — CONCEPT.md,
/// "Konkretisierung für opencode/OpenChamber": bei diesem Tool wird nicht
/// nur "opencode nutzen" gewählt, sondern zusätzlich welches KI-Modell
/// darunter arbeitet.
///
/// Bewusst eine kuratierte Vorauswahl, keine vollständige Liste — das UI
/// erlaubt zusätzlich ein frei eingetragenes Modell, damit neue oder hier
/// nicht gelistete Modelle nutzbar bleiben, ohne den Code zu ändern.
pub fn available_models() -> Vec<OpencodeModel> {
    vec![
        OpencodeModel {
            id: "deepseek/deepseek-chat",
            display_name: "DeepSeek — Chat (schnell, Standard)",
        },
        OpencodeModel {
            id: "deepseek/deepseek-reasoner",
            display_name: "DeepSeek — Reasoner (mehr Tiefe, langsamer)",
        },
        OpencodeModel {
            id: "anthropic/claude-sonnet-4-5",
            display_name: "Anthropic — Claude Sonnet 4.5",
        },
        OpencodeModel {
            id: "anthropic/claude-opus-4-1",
            display_name: "Anthropic — Claude Opus 4.1",
        },
        OpencodeModel {
            id: "openai/gpt-5",
            display_name: "OpenAI — GPT-5",
        },
    ]
}

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

        // Das Modell ist optional: ohne Auswahl bleibt opencode bei seiner
        // eigenen Default-Konfiguration, statt dass der Wizard eine
        // Modellwahl erzwingt.
        let model_line = match config.opencode_model.as_deref() {
            Some(model) if !model.trim().is_empty() => {
                format!("  \"model\": \"{}\",\n", model.trim())
            }
            _ => String::new(),
        };

        let content = format!(
            "{{\n  // Von OpenWizardAI generiert für {}\n{}  \"permission\": \"{}\"\n}}\n",
            config.project_name, model_line, permission_mode
        );

        vec![FileWrite {
            path: config.project_root.join("opencode.jsonc"),
            content,
            mode: WriteMode::OverwriteIfConfirmed,
        }]
    }

    fn project_hitl_level(&self, _config: &WizardConfig) -> Vec<FileWrite> {
        // Nichts zu tun: `generate_files` trägt `"permission"` bereits
        // strukturiert in die erzeugte `opencode.jsonc` ein. Ein
        // zusätzlicher Write würde die Stufe als nackte Zeile hinter die
        // schließende Klammer hängen und die Datei zu ungültigem JSON
        // machen — anders als bei den Markdown-Adaptern, wo Anhängen
        // unproblematisch ist.
        Vec::new()
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
