# HANDOFF – OpenWizardAI

Stand: 2026-09-23 · Branch `main` · Repo: https://github.com/manoelpanev/OpenWizardAI

## Wiedereinstieg in 3 Schritten

1. `cd ~/Downloads/OpenWizzard && export PATH=/opt/homebrew/opt/node@24/bin:$PATH`
2. `npm ci` (nur beim ersten Mal) und `npm run dev`
3. Beim Start „Connect DeepSeek“ ausfüllen, dann rechts den Tab **Wizard** öffnen.

## Was OpenWizardAI ist

Desktop-App (Electron, React, TypeScript), die KI-Coding-Agents parallel steuert: DeepSeek (eigener Agent), Claude Code, Codex, OpenCode, Gemini CLI u. a. Dazu ein Wizard-Seitenpanel, das pro Projekt mitläuft, plant und Auto-Run-Playbooks schreibt.

Basis ist ein Fork von Maestro 0.17.5 (Pedram Amini, AGPL-3.0). Die Lizenz verlangt den Urheberhinweis. „Maestro“ darf deshalb nur an diesen Stellen stehen: `LICENSE`, `README.md`, `package.json` (description), `src/shared/branding.ts`, About-Dialog. Überall sonst heißt alles OpenWizardAI.

## Erledigt

| Bereich        | Stand                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Umbenennung    | App, CLI (`openwizardai-cli`, `openwizardai-p`, `openwizardai-agent`), Projektordner `.openwizardai/`, Deep Links `openwizardai://`, Env-Vars `OPENWIZARDAI_*`, Datenordner `~/Library/Application Support/OpenWizardAI` |
| Entfernt       | Feedback-Flow (schickte Nutzerdaten), Leaderboard, Symphony, Check-in- und Cue-Telemetrie, alle runmaestro.ai-Links                                                                                                      |
| Updates        | Auto-Update aus (`UPDATES_ENABLED = false` in `src/shared/branding.ts`), bis eigene Releases existieren                                                                                                                  |
| DeepSeek-Agent | Eigener Agent-Typ `deepseek`, Modelle `deepseek-flash` (V4.1 Flash, Standard) und `deepseek-v4-pro`, Denkstufe low/high/max/off                                                                                          |
| API-Key        | Wird vor dem Speichern gegen `api.deepseek.com/models` geprüft, dann mit Electron `safeStorage` (macOS-Schlüsselbund) verschlüsselt; gelangt nur in die Umgebung des DeepSeek-Prozesses                                  |
| Wizard-Panel   | Tab „Wizard“ im rechten Panel, ein gespeicherter Chat pro Projektordner, Streaming, Tool-Anzeige, Stopp/Neustart                                                                                                         |
| Icon           | Weißer Zauberhut auf Lila, Quelle `build/icon.svg`, alle Formate per `node scripts/generate-icons.mjs`                                                                                                                   |
| GitHub         | `main` = neue App (ohne Force-Push, Tauri-Historie per Merge erhalten); alte Tauri-App auf Branch `tauri-legacy`                                                                                                         |
| Tests          | 37.452 Tests grün, `npm run lint` und `npm run build` sauber                                                                                                                                                             |

## Offen (nach Priorität)

1. **Live-Test mit echtem DeepSeek-Key.** Bisher nur mit simulierter API getestet. Prüfen: Chat im Wizard-Panel, DeepSeek-Agent in einem Tab, Tool-Aufrufe (Datei lesen/schreiben), Fortsetzen einer Sitzung. Bei 400-Fehlern zuerst die `reasoning_content`-Rückgabe in `src/main/deepseek-agent/loop.ts` prüfen.
2. **Eigene Releases**: Signierung/Notarisierung für macOS, dann Releases auf GitHub veröffentlichen und `UPDATES_ENABLED` auf `true` setzen.
3. **Repo `manoelpanev/OpenWizardAI-Playbooks`** anlegen (mit `manifest.json`), sonst zeigt der Playbook-Marketplace nur lokale Playbooks.
4. **Docs in `docs/`** sind noch die übernommene Maestro-Doku (umbenannt). Screenshots in `docs/screenshots/` zeigen noch die alte Oberfläche.
5. **Wizard-Panel**: Modellwahl (Flash/Pro) im Panel selbst; Anzeige der Kosten pro Antwort.
6. ESLint meldet 15 Warnungen zu unbenutzten Variablen (Überbleibsel der entfernten Features), unkritisch.
7. Später: XP / Spielmodus, PurpleDragon-Integration. Beides ist bewusst zurückgestellt.

## Wo was liegt

| Thema                                       | Datei                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Branding, Links, Update-Schalter            | `src/shared/branding.ts`                                                                                                                    |
| DeepSeek API-Client                         | `src/main/deepseek-agent/deepseek-client.ts`                                                                                                |
| Agent-Schleife, Sitzungen, Systemprompt     | `src/main/deepseek-agent/loop.ts`                                                                                                           |
| Agent-Werkzeuge (lesen, schreiben, Befehle) | `src/main/deepseek-agent/tools.ts`                                                                                                          |
| Agent-CLI                                   | `src/openwizardai-agent/index.ts` (Build: `scripts/build-openwizardai-agent.mjs`)                                                           |
| Key-Speicher                                | `src/main/deepseek/credentials.ts`                                                                                                          |
| Launcher für gebündelten Agent              | `src/main/deepseek/agent-launcher.ts` (schreibt `userData/bin/openwizardai-agent`)                                                          |
| Wizard-Panel (Main / UI)                    | `src/main/deepseek/wizard-panel.ts` / `src/renderer/components/WizardPanel.tsx`                                                             |
| Key-Dialog                                  | `src/renderer/components/DeepSeekConnectModal.tsx` (auch per Cmd+K → „Connect DeepSeek“)                                                    |
| Agent-Registrierung                         | `src/shared/agentIds.ts`, `src/main/agents/definitions.ts`, `src/main/agents/capabilities.ts`, `src/main/parsers/deepseek-output-parser.ts` |

## Daten auf der Platte

- `~/Library/Application Support/OpenWizardAI/` (im Dev-Modus `openwizardai-dev/`)
  - `deepseek.json`: `{ "encryptedApiKey": "<base64, safeStorage>" }`
  - `wizard-panel.json`: `{ "sessions": { "/pfad/zum/projekt": "wizard-<uuid>" } }`
  - `deepseek-sessions/<id>.json`: Gesprächsverlauf `{ id, model, cwd, createdAt, updatedAt, messages[] }` (Zeitstempel ISO-8601)
- Im Projekt: `.openwizardai/PROJECT.md` (Plan vom Wizard), `.openwizardai/playbooks/*.md` (Auto-Run-Checklisten)

## Stolperfallen

- **Node 24 nötig.** Node 26 (Standard-`node` auf diesem Mac) wird von `better-sqlite3` nicht unterstützt. Node 24 liegt keg-only unter `/opt/homebrew/opt/node@24`.
- **npm 11 blockiert Install-Skripte.** Die Freigaben stehen in `package.json` → `allowScripts`. Nach `npm ci` ggf. `npm run postinstall` (baut `node-pty`/`better-sqlite3` für Electron).
- **Pre-Push-Hook** führt Format-Check, Typecheck, ESLint und die komplette Testsuite aus (ca. 4–5 Minuten).
- **DeepSeek Thinking + Tools:** Jede frühere Assistant-Nachricht muss mit `reasoning_content` zurückgeschickt werden, sonst antwortet die API mit 400.
- **zsh** teilt `$VAR` nicht in Wörter auf. In Skripten für Dateilisten `xargs` nutzen.
- Nach Änderungen am Agent-Code: `node scripts/build-openwizardai-agent.mjs` (sonst läuft der alte Stand aus `dist/cli/`).

## Befehle

```bash
npm run dev          # App im Dev-Modus
npm run lint         # Typecheck (renderer, main, cli)
npm run test         # alle Tests
npm run build        # Production-Build inkl. openwizardai-agent
node scripts/generate-icons.mjs   # Icons aus build/icon.svg neu erzeugen
```
