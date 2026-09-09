use serde::Serialize;
use std::fs;
use std::path::Path;

/// Ergebnis der Projekt-Analyse beim Andocken an ein bestehendes Projekt
/// (CONCEPT.md, "Docking an bestehende Projekte": automatischer Datei-Scan
/// nach bekannten Marker-Dateien, den DeepSeek anschließend zusammenfasst).
///
/// Bewusst nur Metadaten, keine Dateiinhalte — der Projektinhalt des
/// Nutzers wird nicht an die API geschickt.
#[derive(Debug, Serialize, Default)]
pub struct ProjectAnalysis {
    /// Erkannte Marker-Dateien im Projekt-Wurzelverzeichnis, z.B.
    /// "package.json", "Cargo.toml".
    pub markers: Vec<String>,
    /// Aus den Markern abgeleitete Sprachen/Ökosysteme, z.B. "Rust".
    pub languages: Vec<String>,
    /// Ob das Projekt ein Git-Repository ist.
    pub has_git: bool,
    /// Dateiendungen im Projekt, nach Häufigkeit absteigend, maximal 8 —
    /// gibt DeepSeek einen Hinweis auf den tatsächlichen Schwerpunkt,
    /// auch wenn keine Marker-Datei vorhanden ist.
    pub top_extensions: Vec<String>,
}

/// Marker-Datei → welche Sprache/welches Ökosystem sie anzeigt.
const MARKERS: &[(&str, &str)] = &[
    ("package.json", "JavaScript/TypeScript (npm)"),
    ("Cargo.toml", "Rust"),
    ("pyproject.toml", "Python"),
    ("requirements.txt", "Python"),
    ("go.mod", "Go"),
    ("pom.xml", "Java (Maven)"),
    ("build.gradle", "Java/Kotlin (Gradle)"),
    ("build.gradle.kts", "Kotlin (Gradle)"),
    ("Gemfile", "Ruby"),
    ("composer.json", "PHP"),
    ("Package.swift", "Swift"),
    ("pubspec.yaml", "Dart/Flutter"),
    ("CMakeLists.txt", "C/C++ (CMake)"),
    ("Dockerfile", "Docker"),
];

/// Verzeichnisse, die beim Zählen der Dateiendungen übersprungen werden —
/// sie enthalten Fremdcode bzw. Build-Artefakte und würden das Bild
/// verfälschen.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "build",
    "dist",
    "venv",
    "__pycache__",
    "vendor",
    "Pods",
];

/// Analysiert einen bestehenden Projektordner anhand von Marker-Dateien
/// und Dateiendungen. Rein lesend, ohne Dateiinhalte auszuwerten.
#[tauri::command]
pub fn analyze_project(project_root: String) -> Result<ProjectAnalysis, String> {
    let root = Path::new(&project_root);

    if project_root.trim().is_empty() {
        return Err("Projektordner darf nicht leer sein.".to_string());
    }
    if !root.is_dir() {
        return Err(format!("\"{project_root}\" ist kein Verzeichnis."));
    }

    let mut analysis = ProjectAnalysis {
        has_git: root.join(".git").exists(),
        ..Default::default()
    };

    for (marker, language) in MARKERS {
        if root.join(marker).exists() {
            analysis.markers.push((*marker).to_string());
            if !analysis.languages.contains(&(*language).to_string()) {
                analysis.languages.push((*language).to_string());
            }
        }
    }

    let mut extension_counts: Vec<(String, usize)> = count_extensions(root).into_iter().collect();
    extension_counts.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    analysis.top_extensions = extension_counts
        .into_iter()
        .take(8)
        .map(|(ext, count)| format!("{ext} ({count})"))
        .collect();

    Ok(analysis)
}

/// Zählt Dateiendungen bis zu einer begrenzten Tiefe und Dateizahl, damit
/// die Analyse auch in sehr großen Projekten schnell bleibt.
fn count_extensions(root: &Path) -> std::collections::HashMap<String, usize> {
    let mut counts = std::collections::HashMap::new();
    let mut visited_files = 0usize;
    let mut queue = vec![(root.to_path_buf(), 0usize)];

    while let Some((dir, depth)) = queue.pop() {
        if depth > 4 || visited_files > 5000 {
            continue;
        }

        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                if !SKIP_DIRS.contains(&name.as_str()) && !name.starts_with('.') {
                    queue.push((path, depth + 1));
                }
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                visited_files += 1;
                *counts.entry(format!(".{ext}")).or_insert(0) += 1;
            }
        }
    }

    counts
}
