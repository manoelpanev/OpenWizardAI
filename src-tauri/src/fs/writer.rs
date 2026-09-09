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
    coalesce_by_path(writes)
        .into_iter()
        .map(|write| apply_one(write, hitl_level, already_confirmed))
        .collect()
}

/// Führt mehrere Schreiboperationen auf denselben Pfad zu einer zusammen.
///
/// Nötig, weil verschiedene Tools bewusst dieselbe Datei nutzen: Codex und
/// Grok schreiben beide `AGENTS.md`. Ohne Zusammenführung würde der zweite
/// Adapter den ersten überschreiben, und der Nutzer verliert die
/// Konfiguration des zuerst geschriebenen Tools, ohne es zu merken.
///
/// Der erste Write eines Pfads bestimmt den `WriteMode`; die Inhalte der
/// folgenden werden angehängt, sofern sie nicht schon enthalten sind.
fn coalesce_by_path(writes: Vec<FileWrite>) -> Vec<FileWrite> {
    let mut merged: Vec<FileWrite> = Vec::new();

    for write in writes {
        match merged.iter_mut().find(|existing| existing.path == write.path) {
            Some(existing) => {
                let addition = strip_duplicate_heading(&write.content, &existing.content);
                if !addition.trim().is_empty() && !existing.content.contains(addition.trim()) {
                    existing.content = format!("{}\n{}", existing.content, addition);
                }
            }
            None => merged.push(write),
        }
    }

    merged
}

/// Entfernt eine führende Überschrift aus `addition`, wenn dieselbe Zeile
/// im Ziel schon steht. Beide Markdown-Adapter, die sich `AGENTS.md`
/// teilen, beginnen mit `# <Projektname>` — ohne das hier stünde der
/// Projekttitel zweimal in der zusammengeführten Datei.
fn strip_duplicate_heading(addition: &str, existing: &str) -> String {
    let mut lines = addition.lines().peekable();

    let starts_with_known_heading = lines
        .peek()
        .is_some_and(|first| first.starts_with("# ") && existing.contains(first));

    if !starts_with_known_heading {
        return addition.to_string();
    }

    lines.next();
    lines
        .skip_while(|line| line.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
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
