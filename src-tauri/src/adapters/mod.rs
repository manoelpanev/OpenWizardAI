mod claude_code;
mod codex;
mod grok;
pub mod opencode;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Wie eine geschriebene Datei sich zu einer eventuell bereits vorhandenen
/// Datei am selben Pfad verhalten soll. Adapter setzen dies nur; ob
/// tatsächlich überschrieben wird, entscheidet `fs::writer` anhand der
/// aktuellen HITL-Stufe.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WriteMode {
    /// Datei existiert erwartungsgemäß noch nicht; wird direkt angelegt.
    Create,
    /// Datei darf überschrieben werden, aber nur nach Rückfrage (abhängig
    /// von der HITL-Stufe).
    OverwriteIfConfirmed,
    /// Vorhandene Datei wird inhaltlich zusammengeführt statt ersetzt
    /// (z.B. JSON-Config, bei der nur einzelne Keys ergänzt werden).
    Merge,
}

/// Eine einzelne, noch nicht ausgeführte Schreiboperation. Adapter geben
/// Listen davon zurück; `fs::writer` ist die einzige Stelle, die daraus
/// tatsächlich Dateien macht.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWrite {
    pub path: PathBuf,
    pub content: String,
    pub mode: WriteMode,
}

/// Die vier HITL-Stufen aus CONCEPT.md — von "immer nachfragen" bis
/// "autonom". Legt fest, wie vorsichtig `fs::writer` mit bestehenden
/// Dateien umgeht.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum HitlLevel {
    AlwaysAsk,
    AskOnRisky,
    AskRarely,
    Autonomous,
}

/// Vom Nutzer im Wizard-Flow gesammelte Eingaben, die an jeden gewählten
/// Adapter weitergereicht werden.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardConfig {
    pub project_name: String,
    pub project_root: PathBuf,
    pub hitl_level: HitlLevel,
    /// Nur für den opencode-Adapter relevant: welches KI-Modell unter
    /// opencode laufen soll (`provider/modell`). `None` heißt: opencode
    /// behält seine eigene Default-Konfiguration.
    #[serde(default)]
    pub opencode_model: Option<String>,
}

/// Ergebnis eines `detect_existing`-Aufrufs: was für dieses Tool im
/// Zielordner bereits an Konfiguration vorgefunden wurde (Docking-Fall).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExistingConfig {
    pub found_paths: Vec<PathBuf>,
}

/// Gemeinsames Interface aller unterstützten KI-Tool-Adapter. Ein Adapter
/// führt selbst keine Dateisystem-Operationen aus (kein I/O) — er erzeugt
/// nur Beschreibungen (`FileWrite`), damit `fs::writer` als einzige Stelle
/// die HITL-Rückfrage-Logik zentral durchsetzen kann.
pub trait ToolAdapter {
    /// Eindeutiger, stabiler Bezeichner, z.B. "claude-code".
    fn id(&self) -> &'static str;

    /// Menschenlesbarer Name für die UI.
    fn display_name(&self) -> &'static str;

    /// Erkennt, ob dieses Tool im Zielordner bereits konfiguriert ist.
    fn detect_existing(&self, project_root: &Path) -> Option<ExistingConfig>;

    /// Erzeugt die für dieses Tool nötigen Dateien basierend auf der
    /// Wizard-Konfiguration.
    fn generate_files(&self, config: &WizardConfig) -> Vec<FileWrite>;

    /// Projiziert die gewählte HITL-Stufe in tool-eigene Dateien (z.B. als
    /// Permission-Mode in `opencode.jsonc`, oder als Hinweistext in
    /// `AGENTS.md` für Tools ohne eigenes Permission-System). Bekommt die
    /// volle Config (nicht nur die Stufe), damit die erzeugten Pfade
    /// relativ zu `config.project_root` gebildet werden können.
    fn project_hitl_level(&self, config: &WizardConfig) -> Vec<FileWrite>;
}

/// Liefert alle in Meilenstein 1 unterstützten Adapter in fester Reihenfolge.
pub fn all_adapters() -> Vec<Box<dyn ToolAdapter>> {
    vec![
        Box::new(claude_code::ClaudeCodeAdapter),
        Box::new(codex::CodexAdapter),
        Box::new(grok::GrokAdapter),
        Box::new(opencode::OpencodeAdapter),
    ]
}
