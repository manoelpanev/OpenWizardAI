# OpenWizardAI — Architektur-Skizze

Status: **Architektur für Meilenstein 1 (Kern-Wizard).** Baut auf den in
[CONCEPT.md](CONCEPT.md) festgelegten Entscheidungen auf. Plugin-Registry,
DeepSeek-Integration, GitHub-Repo-Anlage und Live-Handoff sind hier nur als
spätere Erweiterungspunkte skizziert, nicht Teil von Meilenstein 1 — vor
deren Implementierung wird diese Skizze erweitert und erneut vorgelegt.

## Scope dieses Dokuments

Nur der Kern-Wizard (MVP laut CONCEPT.md "MVP-Scope / Meilenstein 1"):
Tool-Auswahl + Datei-Generierung für ein neues Projekt. Kein Plugin-System,
kein DeepSeek-Call, keine GitHub-Integration, kein Live-Handoff — deren
Schnittstellen werden aber so vorbereitet, dass sie in Meilenstein 2+ ohne
Kernumbau andocken.

## Ordnerstruktur

```
OpenWizardAI/
├── CONCEPT.md
├── ARCHITECTURE.md
├── LICENSE
├── src-tauri/                    # Rust-Backend (Tauri)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── commands/              # Tauri-Commands, vom Frontend aufgerufen
│       │   ├── mod.rs
│       │   ├── project.rs         # Projekt anlegen/andocken
│       │   └── tool_setup.rs      # Tool-Auswahl → Dateien schreiben
│       ├── adapters/               # Ein Modul pro unterstütztem KI-Tool
│       │   ├── mod.rs              # Adapter-Trait (siehe unten)
│       │   ├── codex.rs
│       │   ├── grok.rs
│       │   ├── claude_code.rs
│       │   └── opencode.rs
│       ├── fs/                     # Dateisystem-Operationen, zentral gebündelt
│       │   ├── mod.rs
│       │   └── writer.rs           # atomares Schreiben, Backup bei Überschreiben
│       └── state/
│           └── project_state.rs    # In-Memory-Zustand des laufenden Wizards
├── src/                            # Frontend (UI)
│   ├── main.ts / main entry
│   ├── routes/                     # ein Screen pro Wizard-Schritt (Hick's Law)
│   │   ├── step-tool-select.*
│   │   ├── step-handoff-mode.*
│   │   └── step-summary.*
│   ├── components/
│   └── theme/                      # Dark/Light + Farbthemen, Umschalter
└── docs/
    └── adapters.md                 # Wie ein neuer Tool-Adapter angelegt wird
```

**Warum diese Aufteilung:** Tauri trennt ohnehin Rust-Backend (`src-tauri/`)
und Web-Frontend (`src/`). Die `adapters/`-Schicht ist bewusst isoliert,
weil sie der Punkt ist, an dem später Plugin-Projektion (Meilenstein 2)
andockt — jeder Adapter bekommt dann zusätzlich Zugriff auf die
Plugin-Registry, ohne dass sich sein Interface nach außen ändert.

## Datenfluss (Meilenstein 1)

```
[Nutzer im UI]
      │  wählt: Projektname, Zielordner, KI-Tools (1..n), Handoff-Modus
      ▼
[Frontend: WizardState]
      │  invoke("setup_project", WizardConfig)
      ▼
[Tauri Command: tool_setup::setup_project]
      │  für jedes gewählte Tool:
      ▼
[Adapter::generate_files(config) → Vec<FileWrite>]
      │  jeder Adapter kennt nur sein eigenes Zielformat
      ▼
[fs::writer::apply(Vec<FileWrite>)]
      │  atomar schreiben, bestehende Dateien vorher sichern (nicht überschreiben
      │  ohne Rückfrage — siehe HITL-Stufen aus CONCEPT.md)
      ▼
[Ergebnis zurück ans Frontend: Liste geschriebener/übersprungener Dateien]
      │
      ▼
[UI: Zusammenfassungs-Screen]
```

Kein Netzwerkzugriff, kein DeepSeek-Call in diesem Datenfluss — reine
Dateisystem-Operationen, wie im CONCEPT.md unter "Tool-Zugriff" festgelegt.

## Tool-Adapter-Design

Jedes unterstützte KI-Tool (Codex, Grok, Claude Code, OpenChamber/opencode)
bekommt einen Adapter, der ein gemeinsames Interface implementiert:

```rust
trait ToolAdapter {
    /// Eindeutiger Bezeichner, z.B. "claude-code"
    fn id(&self) -> &'static str;

    /// Menschenlesbarer Name für die UI
    fn display_name(&self) -> &'static str;

    /// Erkennt, ob dieses Tool im Zielordner bereits konfiguriert ist
    /// (für den Docking-Fall aus CONCEPT.md)
    fn detect_existing(&self, project_root: &Path) -> Option<ExistingConfig>;

    /// Erzeugt die zu schreibenden Dateien für dieses Tool, basierend auf
    /// der Wizard-Konfiguration. Schreibt noch nichts selbst — reine
    /// Datei-Erzeugung, damit fs::writer die HITL-Rückfrage-Logik zentral
    /// an einer Stelle behandeln kann.
    fn generate_files(&self, config: &WizardConfig) -> Vec<FileWrite>;

    /// Wie sich die gewählte HITL-Stufe (aus CONCEPT.md) in diesem Tool
    /// niederschlägt — manche Tools haben eigene Permission-Modi
    /// (z.B. opencode.jsonc), andere bekommen nur einen Hinweis in
    /// AGENTS.md/HANDOFF.md
    fn project_hitl_level(&self, level: HitlLevel) -> Vec<FileWrite>;
}
```

`FileWrite` ist ein einfacher Werttyp: `{ path, content, mode: Create |
OverwriteIfConfirmed | Merge }`. Der `fs::writer` ist die einzige Stelle,
die tatsächlich auf Platte schreibt — Adapter selbst führen keine I/O aus.
Das hält Adapter testbar (reine Funktionen: Config rein, `FileWrite`-Liste
raus) und macht `fs::writer` zum einzigen Ort, an dem die HITL-Stufe
(Immer fragen / riskant / selten / autonom) tatsächlich greift, bevor eine
bestehende Datei überschrieben wird.

**Neuen Adapter hinzufügen** (dokumentiert in `docs/adapters.md`): neues
Modul unter `adapters/`, `ToolAdapter`-Trait implementieren, in der
Adapter-Registry (`adapters/mod.rs`) eintragen. Kein Eingriff in UI oder
`fs::writer` nötig.

## Erweiterungspunkte für spätere Meilensteine (nicht jetzt implementieren)

- **Plugin-System (M2):** `ToolAdapter::generate_files` bekommt zusätzlich
  eine `Vec<Plugin>` als Parameter; Plugin hat bereits im CONCEPT.md
  festgelegtes Schema (`id`, `projectionTemplate`, `targetTools[]`, etc.).
  Projektion läuft über denselben `FileWrite`-Mechanismus.
- **DeepSeek-Integration (M2/M3):** eigenes `deepseek/`-Modul in
  `src-tauri/src/`, das Key aus dem OS-Keystore liest (`keyring`-Crate) und
  Flash/Pro-Auswahl kapselt. Wird von `commands/` optional aufgerufen
  (Docking-Kontext-Zusammenfassung, Plugin-Empfehlung), nicht vom
  Kern-Datenfluss oben.
- **GitHub-Repo-Anlage (M3):** eigener `commands/github.rs`, nutzt
  GitHub-API nur nach explizitem Nutzer-Opt-in im Wizard-Schritt.
- **Live-Handoff/Tray-App (M4):** separates Binary/Prozess, das den in
  CONCEPT.md skizzierten Tray-Ansatz umsetzt — bewusst nicht Teil des
  Kern-Wizard-Prozesses, damit der Wizard beendet werden kann, ohne den
  Handoff-Mechanismus zu beenden.

## Meilenstein-Plan

| Meilenstein | Inhalt | Abhängigkeit |
|---|---|---|
| **M1 — Kern-Wizard** | Ordnerstruktur oben, 4 Tool-Adapter (Codex, Grok, Claude Code, opencode) mit `generate_files` + `detect_existing`, `fs::writer` mit HITL-Stufen-Logik, UI-Flow (Tool-Auswahl → Handoff-Modus-Auswahl → Zusammenfassung), Theme-Umschalter | keine |
| **M2 — Plugin-System** | Plugin-Registry (lokal, noch ohne Remote-Sync), Profile im Menü, Projektion in Adapter integriert | M1 |
| **M3 — DeepSeek-Integration** | Key-Verwaltung (Keychain), Docking-Kontext-Zusammenfassung, Plugin-Empfehlung per Freitext-Prompt, GitHub-Plugin-Discovery mit Freigabe-Schritt | M2 |
| **M4 — GitHub-Repo-Anlage** | Opt-in-Schritt im Wizard, privat/öffentlich wählbar | M1 |
| **M5 — Live-Handoff** | Tray-App/Hintergrundprozess, gemeinsame Kontext-Datei, DeepSeek Context-Mode | M3 |

M1 und M4 sind unabhängig voneinander und könnten parallel begonnen werden;
M2/M3/M5 bauen sequenziell aufeinander auf.

## Offene technische Detailfragen für M1

Diese sind klein genug, um während der Implementierung entschieden zu
werden, statt den Start zu blockieren — werden hier nur vermerkt:

- Genaues Dateiformat/Inhalt pro Tool-Adapter (was genau steht in
  `AGENTS.md` für Codex vs. für Claude Code) — wird pro Adapter beim
  Implementieren anhand der jeweiligen Tool-Dokumentation festgelegt.
- Testbild: Unit-Tests pro Adapter (Config → erwartete `FileWrite`-Liste),
  Integrationstest für `fs::writer` mit den 4 HITL-Stufen.

## Nächster Schritt

Freigabe dieser Architektur-Skizze, dann Start der Implementierung von
Meilenstein 1: Tauri-Projekt initialisieren, Ordnerstruktur anlegen, ersten
Adapter (Claude Code) implementieren als Referenz für die übrigen drei.
