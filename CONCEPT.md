# OpenWizardAI — Konzept

Status: **Konzeptphase, kein Code.** Dieses Dokument fasst die bisher mit dem
Nutzer geklärten Entscheidungen zusammen und markiert offene Fragen explizit
als offen — es wird nichts geraten, was noch nicht festgelegt wurde.

## Ursprung

Ausgangspunkt war [openchamber/openchamber#3414](https://github.com/openchamber/openchamber/issues/3414):
ein schmal geschnittener "Per-project setup wizard" für OpenChamber/opencode
(Permission-Modus, AGENTS.md/HANDOFF.md-Loading, Session-Assistance-Toggles,
schreibt lokales `opencode.jsonc`). OpenWizardAI ist davon losgelöst — ein
eigenständiges, größer angelegtes Tool, keine PR gegen OpenChamber.

## Was OpenWizardAI ist

Ein Setup-Wizard mit eigener UI, der beim Anlegen eines neuen (oder Andocken
an ein bestehendes) Projekts:

1. den Nutzer auswählen lässt, welche KI-Coding-Tools für dieses Projekt
   genutzt werden (eins oder mehrere gleichzeitig)
2. die dafür nötigen Dateien/Configs auf Dateisystem-Ebene anlegt
3. wählbar macht, welche Art von Handoff zwischen den Tools gewünscht ist
4. optional ein GitHub-Repo für das Projekt anlegt (privat oder öffentlich,
   wählbar)
5. bei der Einrichtung optional DeepSeek zur Verdichtung/Aufbereitung von
   vorhandenem Projektkontext nutzt

## Festgelegte Eckpunkte

| Bereich | Entscheidung |
|---|---|
| Zielgruppe | Open Source, öffentlich (wie das Schwesterprojekt OpenPin) |
| Plattform | macOS zuerst, nativ; andere OS erst später |
| Unterstützte KI-Tools (v1) | Codex, Grok, Claude (Code), OpenChamber/opencode — Nutzer wählt einzeln an, welche(s) genutzt werden |
| Tool-Zugriff | Dateisystem-Ebene: liest/schreibt die tool-eigenen Dateien direkt (z.B. `AGENTS.md`, `HANDOFF.md`, projekt-lokale Configs) — keine Provider-APIs für den laufenden Betrieb |
| Handoff-Modus | Wählbar, nicht fest verdrahtet: (a) Live-Session-Übergabe zwischen Tools und/oder (b) generierte Handoff-Dateien. Format orientiert sich am mitgelieferten Masterprompt-Beispiel (siehe unten) |
| DeepSeek-Rolle | **Nur zur Einrichtungszeit**, nicht als laufender Vermittler. Nutzbar sowohl beim Neuanlegen als auch beim Andocken an ein bestehendes Projekt, um vorhandenen Kontext zu erfassen/aufzubereiten |
| GitHub-Integration | Wizard kann optional ein Repo anlegen, Sichtbarkeit (privat/öffentlich) ist ein Wahlschritt im Flow |

## Referenzformat: Masterprompt

Der Nutzer hat als Beispiel `MRPNV_AI_MASTERPROMPT.md` bereitgestellt — ein
striktes Anti-Halluzination/Self-Repair-Protokoll für KI-Agenten, u.a.:

- Wahrheitsklassen für jede technische Aussage: `[VERIFIZIERT]`,
  `[TEILWEISE VERIFIZIERT]`, `[BEOBACHTUNG]`, `[WAHRSCHEINLICH]`,
  `[HYPOTHESE]`, `[UNGEKLÄRT]`, `[WIDERLEGT]`
- Evidenz-Prioritätskette: reproduzierbares Laufzeitverhalten > Testergebnisse
  > aktueller Code > Config > Git-Historie > Logs > direkte Nutzerinfo >
  Projekt-Memory > frühere Agentenaussagen > Vermutungen
- Verbot zirkulärer Selbstbestätigung (Memory-Datei A verweist auf B verweist
  auf A → gilt nicht als Beweis)
- Self-Repair-Trigger (Stop-Bedingungen bei wiederholten Fehlversuchen,
  Anti-Loop-Erkennung auf semantischer statt nur textueller Ebene)
- Trennung von `HANDOFF.md` (darf Hypothesen enthalten, aber markiert) und
  einer Langzeit-Memory-Datei (konservativ, nur verifiziertes Wissen)
- Masterprompt selbst ist read-only für autonome Agenten-Selbstmodifikation

Dieses Dokument ist die Referenz dafür, wie OpenWizardAI Memory- und
Handoff-Dateien strukturieren soll, wenn der Nutzer diesen Modus wählt. Die
Datei selbst wird noch nicht ins Repo übernommen, bis geklärt ist, ob sie als
generisches Template (tool-agnostisch, nicht mehr an den Namen "MRPNV_AI"
gebunden) oder 1:1 übernommen werden soll.

## Plattform & Stack (entschieden)

- **App-Basis:** Tauri (Rust-Backend), nicht Swift/SwiftUI, nicht Electron.
  Grund: kleinere Bundle-Größe und nativ schnellere Performance passen zu
  einem Setup-Wizard, der nicht dauerhaft im Hintergrund läuft; spätere
  Portierung auf andere OS bleibt trotzdem leichter als bei einer nativen
  macOS-App.
- **Lizenz:** Apache 2.0 (permissiv wie MIT, zusätzlich expliziter
  Patentschutz für Beiträge von Firmen).

## Plugin-System (entschieden)

Ersetzt die alte Frage "zentrale Config vs. pro-Tool-Datei" — das Plugin-
System *ist* die zentrale Config-Schicht:

1. **Plugin-Registry.** Zentrale Liste von Plugins (analog zu Claude-Skills
   wie `i-have-adhd`, `ecc:*`). Jedes Plugin ist tool-agnostisch definiert
   und wird beim Schreiben in die tool-eigenen Dateien projiziert
   (`AGENTS.md`, `HANDOFF.md`, `opencode.jsonc`, etc.).
2. **Profile/Presets.** Nutzer stellt sich im Menü benannte Profile aus
   Plugins zusammen (z.B. "Standard-Setup" mit `i-have-adhd` immer aktiv).
   Beim Projekt-Setup wählbar: ganzes Profil oder einzelne Plugins.
3. **Plugin-Quellen (mehrere, kombiniert):**
   - Eigene OpenWizardAI-Registry (Community reicht Plugins ein, z.B. über
     ein GitHub-Repo als Source of Truth)
   - Import/Spiegelung bestehender Claude Code Skills/Plugins als Startbestand
   - Perspektivisch auch Plugin-Quellen anderer unterstützter Tools (Codex,
     opencode, Grok)
   - Automatisches Auffinden guter Plugins auf GitHub (nach Sternen/Relevanz),
     durchgeführt von der DeepSeek-API (v4 Flash) als Recherche-Task
4. **Updates.** Plugins in der Registry werden aktuell gehalten (Update-
   Mechanismus, Details noch offen — z.B. periodischer Sync vs. manueller
   "Check for updates"-Button im Wizard).
5. **KI-Empfehlung.** Nutzer beschreibt im Wizard sein Vorhaben als Freitext-
   Prompt. Ein Live-LLM-Call (DeepSeek) schlägt daraufhin passende Plugins
   vor — zusätzlich zu bereits gespeicherten/eigenen Profilen, die immer
   direkt anwählbar bleiben. Kein rein lokales Tag-Matching als Fallback
   vorgesehen; DeepSeek ist ohnehin schon für die Setup-Zeit-Nutzung im
   Konzept vorgesehen (s.o.).

## Human-in-the-Loop-Steuerung (entschieden)

Wie viel der Wizard (und die von ihm konfigurierten KI-Tools) selbstständig
entscheiden dürfen, ist einstellbar — analog zum Plugin-System personalisierbar
und speicherbar:

- **Feste Stufen-Skala**, mehrere Abstufungen zwischen "immer nachfragen" und
  "vollständig autonom" (z.B. angelehnt an die Auto-Mode/Plan-Mode-Abstufungen
  bestehender Tools: Immer fragen → Nur bei riskanten Aktionen fragen →
  Selten fragen (nur bei irreversiblen Aktionen) → Autonom). Genaue Anzahl
  und Bezeichnung der Stufen im Architektur-Schritt festlegen.
- Wie bei Plugin-Profilen: als benanntes, wiederverwendbares Profil im Menü
  speicherbar, nicht nur ein einmaliger Wizard-Schritt.
- Pro Projekt wählbar (überschreibt ggf. das Default-Profil), und die
  gewählte Stufe wird beim Schreiben der tool-eigenen Dateien mit projiziert
  (z.B. als Permission-Mode-Einstellung in `opencode.jsonc`, als Hinweis in
  `AGENTS.md`/`HANDOFF.md` für Tools ohne eigenes Permission-System).

## Offene Fragen (noch nicht entschieden)

- Genaue Anzahl und Bezeichnung der HITL-Stufen sowie deren konkrete
  Auswirkung pro unterstütztem Tool (manche Tools haben eigene
  Permission-Modi, andere nicht — wie wird dort projiziert?).
- Wird der Masterprompt-Text als generisches Template parametrisiert
  (Projektname statt "MRPNV_AI") oder pro Nutzer fest übernommen?
- Plugin-Update-Mechanismus im Detail (automatisch/periodisch vs. manuell
  angestoßen; wie wird ein GitHub-gefundenes Plugin geprüft/freigegeben,
  bevor es in der Registry landet — Review-Schritt nötig?).
- Format/Schema der Plugin-Registry-Einträge (welche Felder braucht ein
  Plugin-Eintrag, damit die Projektion auf verschiedene Tools funktioniert?).
- Wie wird der DeepSeek-API-Key verwaltet (Keychain, .env, Wizard-Prompt bei
  erster Nutzung)?
- Lizenz für das öffentliche Repo noch nicht gewählt.

## Nächster Schritt

Sobald die offenen Fragen oben geklärt sind, wird daraus eine Architektur-
Skizze (Ordnerstruktur, Datenfluss, erster Meilenstein) — vor jeglicher
Code-Implementierung erneut zur Freigabe vorgelegt.
