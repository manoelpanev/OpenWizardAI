# OpenWizardAI

Setup-Wizard für KI-Coding-Projekte (Codex, Grok, Claude Code, opencode/OpenChamber).
Legt beim Anlegen oder Andocken eines Projekts die passenden Tool-Configs
(`AGENTS.md`, `HANDOFF.md`, `opencode.jsonc`, …) an.

Konzept und aktueller Fortschritt: siehe [CONCEPT.md](./CONCEPT.md)
(Abschnitt "Aktueller Stand & Wiedereinstiegspunkt" für den Einstiegspunkt
einer neuen Session). Architektur: siehe [ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

- **Frontend:** SvelteKit + TypeScript, Vite
- **Backend:** Tauri 2 (Rust)

## Voraussetzungen

- [Node.js](https://nodejs.org/) (getestet mit v26) + npm
- [Rust](https://www.rust-lang.org/tools/install) (`cargo`, `rustc`) über rustup
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Tauri-Systemabhängigkeiten: siehe [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```sh
git clone https://github.com/manoelpanev/OpenWizardAI.git
cd OpenWizardAI
npm install
```

## Entwickeln

```sh
npm run tauri dev
```

Startet die App mit Hot-Reload (Frontend via Vite, Backend via `cargo`).
Erster Start dauert länger (Rust-Abhängigkeiten werden kompiliert).

Nur das Frontend im Browser (ohne Tauri-Backend, native Tauri-Commands
funktionieren dann nicht):

```sh
npm run dev
```

## Prüfen

```sh
npx svelte-check --tsconfig ./tsconfig.json   # TypeScript/Svelte Typecheck
cd src-tauri && cargo check                    # Rust-Backend Typecheck
```

## Bauen (Release)

```sh
npm run tauri build
```

## Arbeitsweise an diesem Repo

Dieses Repo wird bewusst ohne dauerhaften lokalen Checkout entwickelt
(siehe CONCEPT.md, Abschnitt "Arbeitsweise an diesem Repo"): jede Session
klont frisch von GitHub, committed und pusht direkt gegen `main`. `main`
ist die einzige verbindliche Quelle des Projektstands — kein
Langzeit-Arbeitsordner auf der lokalen Platte.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
