//! Durchspielt den kompletten Wizard-Ablauf auf Datei-Ebene: alle vier
//! Adapter erzeugen ihre Dateien, `fs::writer` schreibt sie gemäß
//! HITL-Stufe, und das Ergebnis wird geprüft. Deckt damit den Weg ab, den
//! `setup_project` am Ende des Flows nimmt — der Tauri-Command selbst
//! braucht eine laufende App und ist deshalb nicht direkt testbar.

use openwizardai_lib::adapters::{all_adapters, HitlLevel, WizardConfig};
use openwizardai_lib::fs::writer;
use std::fs;
use std::path::PathBuf;

fn temp_project(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("owai-flow-{name}"));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn run_setup(
    root: &PathBuf,
    tool_ids: &[&str],
    hitl_level: HitlLevel,
    opencode_model: Option<&str>,
    already_confirmed: &[String],
) -> Vec<writer::WriteOutcome> {
    let config = WizardConfig {
        project_name: "test-projekt".to_string(),
        project_root: root.clone(),
        hitl_level,
        opencode_model: opencode_model.map(str::to_string),
    };

    let mut writes = Vec::new();
    for adapter in all_adapters() {
        if !tool_ids.contains(&adapter.id()) {
            continue;
        }
        writes.extend(adapter.generate_files(&config));
        writes.extend(adapter.project_hitl_level(&config));
    }

    writer::apply(writes, hitl_level, already_confirmed)
}

fn failures(outcomes: &[writer::WriteOutcome]) -> Vec<&writer::WriteOutcome> {
    outcomes
        .iter()
        .filter(|o| matches!(o, writer::WriteOutcome::Failed { .. }))
        .collect()
}

#[test]
fn every_adapter_writes_its_files_on_a_fresh_project() {
    let root = temp_project("fresh");
    let all_ids: Vec<&str> = vec!["claude-code", "codex", "grok", "opencode"];

    let outcomes = run_setup(&root, &all_ids, HitlLevel::Autonomous, None, &[]);

    assert!(
        failures(&outcomes).is_empty(),
        "keine Schreiboperation darf fehlschlagen: {:?}",
        failures(&outcomes)
    );
    assert!(
        !outcomes.is_empty(),
        "vier gewählte Tools müssen mindestens eine Datei erzeugen"
    );

    // Jede als geschrieben gemeldete Datei muss danach auch existieren.
    let mut written = 0;
    for outcome in &outcomes {
        if let writer::WriteOutcome::Written { path } = outcome {
            written += 1;
            assert!(
                PathBuf::from(path).exists(),
                "als geschrieben gemeldete Datei fehlt: {path}"
            );
        }
    }
    assert!(written > 0, "es wurde keine einzige Datei geschrieben");

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn opencode_model_choice_lands_in_the_generated_config() {
    let root = temp_project("model");

    run_setup(
        &root,
        &["opencode"],
        HitlLevel::Autonomous,
        Some("deepseek/deepseek-chat"),
        &[],
    );

    let config = fs::read_to_string(root.join("opencode.jsonc")).unwrap();
    assert!(
        config.contains("\"model\": \"deepseek/deepseek-chat\""),
        "Modell fehlt in opencode.jsonc:\n{config}"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn without_a_model_choice_opencode_config_has_no_model_field() {
    let root = temp_project("nomodel");

    run_setup(&root, &["opencode"], HitlLevel::Autonomous, None, &[]);

    let config = fs::read_to_string(root.join("opencode.jsonc")).unwrap();
    assert!(
        !config.contains("\"model\""),
        "ohne Auswahl darf kein model-Feld geschrieben werden:\n{config}"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn existing_files_are_skipped_until_confirmed() {
    let root = temp_project("confirm");

    // Erster Lauf legt die Dateien an.
    run_setup(&root, &["opencode"], HitlLevel::Autonomous, None, &[]);

    // Zweiter Lauf mit rückfragepflichtiger Stufe: bestehende Datei darf
    // nicht stillschweigend überschrieben werden.
    let outcomes = run_setup(&root, &["opencode"], HitlLevel::AskOnRisky, None, &[]);
    let skipped = outcomes
        .iter()
        .filter(|o| matches!(o, writer::WriteOutcome::Skipped { .. }))
        .count();
    assert!(
        skipped > 0,
        "bestehende Datei muss ohne Bestätigung übersprungen werden: {outcomes:?}"
    );

    // Dritter Lauf, diesmal mit Bestätigung für genau diesen Pfad.
    let confirmed = vec![root.join("opencode.jsonc").to_string_lossy().to_string()];
    let outcomes = run_setup(&root, &["opencode"], HitlLevel::AskOnRisky, None, &confirmed);
    assert!(
        outcomes
            .iter()
            .any(|o| matches!(o, writer::WriteOutcome::Written { .. })),
        "mit Bestätigung muss geschrieben werden: {outcomes:?}"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn autonomous_level_overwrites_without_confirmation() {
    let root = temp_project("autonomous");

    run_setup(&root, &["opencode"], HitlLevel::Autonomous, None, &[]);
    let outcomes = run_setup(&root, &["opencode"], HitlLevel::Autonomous, None, &[]);

    assert!(
        outcomes
            .iter()
            .all(|o| !matches!(o, writer::WriteOutcome::Skipped { .. })),
        "auf Stufe Autonomous darf nichts übersprungen werden: {outcomes:?}"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn codex_and_grok_both_survive_in_the_shared_agents_file() {
    let root = temp_project("shared-agents");

    run_setup(&root, &["codex", "grok"], HitlLevel::Autonomous, None, &[]);

    let agents = fs::read_to_string(root.join("AGENTS.md")).unwrap();
    assert!(
        agents.contains("Codex"),
        "Codex-Abschnitt fehlt in AGENTS.md:\n{agents}"
    );
    assert!(
        agents.contains("Grok"),
        "Grok darf Codex nicht überschreiben:\n{agents}"
    );
    assert_eq!(
        agents.matches("# test-projekt").count(),
        1,
        "der Projekttitel darf in der geteilten Datei nur einmal stehen:\n{agents}"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn generated_opencode_config_is_valid_json() {
    let root = temp_project("valid-json");

    run_setup(
        &root,
        &["opencode"],
        HitlLevel::AskOnRisky,
        Some("deepseek/deepseek-chat"),
        &[],
    );

    let raw = fs::read_to_string(root.join("opencode.jsonc")).unwrap();
    // Kommentare sind in JSONC erlaubt, für die Prüfung aber entfernen.
    let without_comments: String = raw
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n");

    let parsed: Result<serde_json::Value, _> = serde_json::from_str(&without_comments);
    assert!(
        parsed.is_ok(),
        "opencode.jsonc muss gültiges JSON sein, ist es aber nicht ({:?}):\n{raw}",
        parsed.err()
    );

    let value = parsed.unwrap();
    assert_eq!(value["permission"], "ask-on-risky");
    assert_eq!(value["model"], "deepseek/deepseek-chat");

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn a_full_run_writes_each_path_exactly_once() {
    let root = temp_project("once");
    let all_ids: Vec<&str> = vec!["claude-code", "codex", "grok", "opencode"];

    let outcomes = run_setup(&root, &all_ids, HitlLevel::Autonomous, None, &[]);

    let mut paths: Vec<&String> = outcomes
        .iter()
        .filter_map(|o| match o {
            writer::WriteOutcome::Written { path } => Some(path),
            _ => None,
        })
        .collect();
    let before = paths.len();
    paths.sort();
    paths.dedup();

    assert_eq!(
        before,
        paths.len(),
        "jeder Pfad darf nur ein Ergebnis liefern, sonst wird doppelt geschrieben: {outcomes:?}"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn selecting_one_tool_does_not_write_another_tools_files() {
    let root = temp_project("isolation");

    run_setup(&root, &["opencode"], HitlLevel::Autonomous, None, &[]);

    assert!(root.join("opencode.jsonc").exists());
    assert!(
        !root.join("AGENTS.md").exists(),
        "AGENTS.md gehört zu anderen Adaptern und darf hier nicht entstehen"
    );

    let _ = fs::remove_dir_all(&root);
}
