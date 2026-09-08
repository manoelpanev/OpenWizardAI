use crate::adapters::{FileWrite, HitlLevel, WriteMode};
use serde::Serialize;
use std::fs;
use std::io;

/// Was mit einer einzelnen `FileWrite` tatsächlich passiert ist —
/// zurückgegeben ans Frontend für den Zusammenfassungs-Screen.
#[derive(Debug, Serialize)]
#[serde(tag = "outcome")]
pub enum WriteOutcome {
    Written { path: String },
    Skipped { path: String, reason: String },
    Failed { path: String, error: String },
}

/// Ob eine `FileWrite`, deren Zielpfad bereits existiert, ohne Rückfrage
/// ausgeführt werden darf. Bei `AlwaysAsk` und `AskOnRisky` wird ein
/// Überschreiben immer als Rückfrage-pflichtig behandelt (Datei-
/// Überschreiben zählt als riskante Aktion); bei `AskRarely` und
/// `Autonomous` nicht.
fn requires_confirmation(level: HitlLevel, mode: &WriteMode) -> bool {
    if *mode != WriteMode::OverwriteIfConfirmed {
        return false;
    }
    matches!(level, HitlLevel::AlwaysAsk | HitlLevel::AskOnRisky)
}

/// Führt eine Liste von `FileWrite`s aus. `already_confirmed` enthält Pfade,
/// für die der Nutzer ein Überschreiben im UI bereits bestätigt hat (aus
/// einer vorherigen Rückfrage) — so kann der Wizard-Flow "Datei X existiert
/// schon, überschreiben?" als eigenen UI-Schritt vor dem eigentlichen
/// Schreiben abfragen, statt dass `apply` selbst blockierend nachfragt.
pub fn apply(
    writes: Vec<FileWrite>,
    hitl_level: HitlLevel,
    already_confirmed: &[String],
) -> Vec<WriteOutcome> {
    writes
        .into_iter()
        .map(|write| apply_one(write, hitl_level, already_confirmed))
        .collect()
}

fn apply_one(write: FileWrite, hitl_level: HitlLevel, already_confirmed: &[String]) -> WriteOutcome {
    let path_str = write.path.to_string_lossy().to_string();
    let exists = write.path.exists();

    if exists && requires_confirmation(hitl_level, &write.mode) && !already_confirmed.contains(&path_str) {
        return WriteOutcome::Skipped {
            path: path_str,
            reason: "Datei existiert bereits, Bestätigung erforderlich".to_string(),
        };
    }

    let result = match write.mode {
        WriteMode::Merge if exists => merge_append(&write),
        _ => write_atomic(&write),
    };

    match result {
        Ok(()) => WriteOutcome::Written { path: path_str },
        Err(err) => WriteOutcome::Failed {
            path: path_str,
            error: err.to_string(),
        },
    }
}

/// Schreibt eine Datei atomar: erst in eine temporäre Datei im selben
/// Verzeichnis, dann per Rename ersetzen — vermeidet, dass ein Absturz
/// mitten im Schreiben eine halb geschriebene Zieldatei hinterlässt.
fn write_atomic(write: &FileWrite) -> io::Result<()> {
    if let Some(parent) = write.path.parent() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = write.path.with_extension("owai-tmp");
    fs::write(&tmp_path, &write.content)?;
    fs::rename(&tmp_path, &write.path)?;
    Ok(())
}

/// Hängt den neuen Inhalt an eine bestehende Datei an, statt sie zu
/// ersetzen. Für M1 bewusst simpel gehalten (reines Anhängen); eine
/// inhaltsbewusste Zusammenführung (z.B. JSON-Key-Merge) ist ein
/// Ausbauschritt, kein Blocker für den Kern-Wizard.
fn merge_append(write: &FileWrite) -> io::Result<()> {
    let existing = fs::read_to_string(&write.path)?;
    let merged = format!("{}\n{}", existing, write.content);
    write_atomic(&FileWrite {
        path: write.path.clone(),
        content: merged,
        mode: WriteMode::Create,
    })
}
