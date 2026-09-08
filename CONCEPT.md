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
Handoff-Dateien strukturieren soll, wenn der Nutzer diesen Modus wählt.

**Entschieden:** Die Datei wird als generisches, parametrisiertes Template
ins Repo übernommen (Projektname/Nutzer als Variablen statt fest an
"MRPNV_AI" gebunden). DeepSeek füllt die Variablen beim Wizard-Lauf aus
dem jeweiligen Projektkontext automatisch aus. Falls sich beim Befüllen
zeigt, dass das Template selbst angepasst werden muss (z.B. eine Variable
fehlt), wird das dem Nutzer zur Prüfung vorgelegt statt stillschweigend
geändert.

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
4. **Updates & Review.** Von DeepSeek auf GitHub gefundene Plugins landen
   nicht automatisch in der aktiven Registry, sondern zunächst in einer
   Vorschlagsliste. Ein Freigabe-Schritt (Nutzer bzw. später Community-
   Maintainer) ist nötig, bevor ein Plugin aktiv nutzbar wird — kein
   automatisches Ausführen ungeprüften Codes/Prompts.
5. **KI-Empfehlung.** Nutzer beantwortet im Wizard eine feste, strukturierte
   Frage-Sequenz (siehe "Geführter Wizard-Onboarding-Flow" unten) statt
   eines freien Prompt-Felds. Ein Live-LLM-Call (DeepSeek) schlägt daraufhin
   passende Plugins vor — zusätzlich zu bereits gespeicherten/eigenen
   Profilen, die immer direkt anwählbar bleiben. Kein rein lokales
   Tag-Matching als Fallback vorgesehen; DeepSeek ist ohnehin schon für die
   Setup-Zeit-Nutzung im Konzept vorgesehen (s.o.).
6. **Registry-Schema (Ausgangsbasis, pro Plugin-Eintrag):**
   - `id`, `name`, `description`
   - `tags[]` (für Matching/Empfehlung)
   - `source` (`own` | `claude-import` | `github-discovered`)
   - `targetTools[]` (welche KI-Tools dieses Plugin unterstützt)
   - `projectionTemplate` (wie es in `AGENTS.md`/`opencode.jsonc`/etc.
     übersetzt wird)
   - `version`, `lastUpdated`

## Human-in-the-Loop-Steuerung (entschieden)

Wie viel der Wizard (und die von ihm konfigurierten KI-Tools) selbstständig
entscheiden dürfen, ist einstellbar — analog zum Plugin-System personalisierbar
und speicherbar:

- **4 feste Stufen:**
  1. Immer fragen
  2. Nur bei riskanten Aktionen fragen (Datei löschen, git push, Netzwerk)
  3. Selten fragen (nur bei irreversiblen Aktionen)
  4. Autonom (nie fragen, außer Show-Stopper)
- Wie bei Plugin-Profilen: als benanntes, wiederverwendbares Profil im Menü
  speicherbar, nicht nur ein einmaliger Wizard-Schritt.
- Pro Projekt wählbar (überschreibt ggf. das Default-Profil), und die
  gewählte Stufe wird beim Schreiben der tool-eigenen Dateien mit projiziert
  (z.B. als Permission-Mode-Einstellung in `opencode.jsonc`, als Hinweis in
  `AGENTS.md`/`HANDOFF.md` für Tools ohne eigenes Permission-System). Wie
  genau sich jede Stufe pro Tool auswirkt (manche Tools haben eigene
  Permission-Modi, andere nicht) wird im Architektur-Schritt pro Tool-
  Adapter festgelegt.

## DeepSeek-API-Key-Verwaltung (entschieden)

Speicherung über native, plattformspezifische verschlüsselte Stores, per
Cross-Platform-Abstraktion (z.B. das `keyring`-Rust-Crate in Tauri) —
ein Code-Pfad spricht automatisch den jeweils richtigen OS-Store an: macOS
Keychain, Windows Credential Manager, Linux Secret Service/libsecret. Kein
Klartext auf Disk, keine eigene Verschlüsselungsschicht nötig.

## DeepSeek-Modellwahl (entschieden)

- **Flash** ist der Default für alle Standard-Aufrufe: Plugin-Empfehlung,
  GitHub-Plugin-Discovery, Live-Kontext-Zusammenfassung beim Tool-Wechsel.
- **Pro** ist manuell wählbar, für Fälle mit mehr nötiger Tiefe (z.B.
  Kontext-Verdichtung eines großen bestehenden Projekts beim Andocken).
- Umschaltbar im Menü, nicht nur einmalig beim Setup.

## Docking an bestehende Projekte (entschieden)

Automatischer Datei-Scan nach bekannten Marker-Dateien (`package.json`,
bereits vorhandenes `AGENTS.md`, `.git`, etc.), anschließend fasst DeepSeek
den erkannten Kontext zusammen — keine rein manuelle Beschreibung durch den
Nutzer nötig. Siehe auch DeepSeek-Rolle oben.

## Live-Session-Übergabe zwischen Tools (entschieden, grobe Richtung)

OpenWizardAI läuft als lokaler Hintergrundprozess/Tray-App und hält pro
Projekt einen "aktuellen Kontext"-Zustand (letzte Aktionen, offene Fragen,
Zusammenfassung). Beim Wechsel von Tool A zu Tool B wird dieser Zustand in
eine gemeinsame Kontext-Datei geschrieben, die Tool B beim Start lädt — über
Dateisystem + Tray-App als Vermittler, kein direkter Prozess-zu-Prozess-
Kanal. Passt zum Dateisystem-Ebene-Grundsatz aus dem Konzept. Für diesen
Kontext-Fluss wird DeepSeeks Context-Mode aktiviert (Flash als Default,
s.o.). Details (genaues Datei-/Update-Format, Trigger für "Tool-Wechsel
erkannt") folgen im Architektur-Schritt.

## Geführter Wizard-Onboarding-Flow (entschieden, gehört zu M3 — implementiert)

Ergänzt/präzisiert Punkt 5 im Plugin-System-Abschnitt oben. Statt eines
einzelnen Freitext-Prompt-Felds führt der Wizard durch feste Basis-Fragen,
gefolgt von dynamisch generierten, projektspezifischen Vertiefungsfragen —
nach Hick's Law weiterhin eine Entscheidung pro Screen:

0. **Projekt-Status (allererste Frage, vor allem anderen).** Neues Projekt
   oder bestehendes optimieren/andocken? Bei "bestehend" wird direkt der
   Projektordner gewählt und optional auf bereits vorhandene Tool-
   Konfigurationen gescannt (nutzt die in M1 gebaute
   `detect_existing_tools`-Erkennung, die bis hierhin nur im Backend
   existierte, aber an keiner UI hing).
1. **DeepSeek-API-Key verbinden.** Optional, nicht zwingend — der Wizard
   funktioniert auch ohne (dann läuft der Kern-Wizard-Flow aus M1 ohne
   KI-Vorschläge, komplett manuelle Auswahl). Verbindung wird empfohlen,
   aber überspringbar. **Modellwahl (Flash/Pro) direkt hier**, gilt für
   alle folgenden API-Calls dieses Durchlaufs.
2. **Falls verbunden: Custom-Agents einrichten?** Eigene Frage direkt beim
   Verbinden. Falls ja: Nutzer beschreibt in Freitext, was für ein Agent
   gewünscht ist; DeepSeek richtet diesen Agenten für die gewählten Tools
   ein (siehe Plugin-Registry-Schema — ein Agent ist strukturell wie ein
   Plugin behandelt, nur mit `source: custom-generated` statt `own` etc.).
3. **Feste Basis-Fragen** (Kontext-Vorlauf für die KI): Welche KI-Coding-
   Tools werden bereits genutzt/sind vorhanden? → Was ist das Vorhaben?
   (kurzer Freitext) → Prototyp oder Produktions-Code? (fließt in den
   HITL-Vorschlag ein).
4. **Dynamisch generierte Vertiefungsfragen.** DeepSeek liest die
   Basis-Antworten und generiert 3-6 gezielte, projektspezifische
   Rückfragen (z.B. bei einer Web-API: Framework, Auth, Datenbank) statt
   generischer Fragen — jede einzeln beantwortbar, überspringbar. **Nach
   jeder Antwort** bewertet DeepSeek eigenständig, ob sie klar/konkret
   genug ist; bei Unklarheit wird direkt eine gezielte Klärungs-Nachfrage
   erzeugt und vor der nächsten Basis-Frage eingeschoben, statt ungeprüft
   weiterzugehen.

**Ergebnis-Screen (inline editierbar, kein Zurückgehen nötig):** Ein
Screen zeigt die KI-Empfehlung für alle Bereiche auf einmal — Tools,
HITL-Stufe, Plugin-Themen, Custom-Agent — jede mit kurzer Begründung,
warum DeepSeek genau diese Wahl getroffen hat. **Jeder Wert ist direkt in
diesem Screen editierbar** (Tools als Checkboxen, HITL als Radio-Gruppe,
Plugin-Themen als Textfeld, Agent als Name+Beschreibung), nicht nur
nachträglich über separate Schritte. Wurde die KI-Empfehlung genutzt,
werden die alten M1-Schritte "Tool-Auswahl" und "HITL-Stufe" komplett
übersprungen — der Flow geht direkt zu Projektname/Zielordner und dann
zur Zusammenfassung. Ohne KI-Nutzung (übersprungen oder kein Key) laufen
diese Schritte weiterhin klassisch wie in M1.

## Noch offen (Ideen aus Nutzer-Feedback, noch nicht spezifiziert)

- **Projekt-Dashboard.** Übersicht über alle mit OpenWizardAI eingerichteten
  Projekte, mit Einblick in die jeweils aktive Konfiguration (welche Tools,
  Plugins, HITL-Stufe pro Projekt). Eigener Meilenstein, noch nicht
  architektonisch skizziert.
- **HANDOFF.md mit Entscheidungs-Historie.** Alle Wizard-Entscheidungen
  (Tool-Wahl, HITL-Stufe, Plugin-Auswahl, Custom-Agent) werden in einer
  `HANDOFF.md` protokolliert; optional zu GitHub hochladbar, private/
  sensible Daten (z.B. API-Keys, lokale Pfade) werden dabei ausgeschlossen.
  Verhältnis zum bereits konzipierten Masterprompt-Format noch zu klären.
- **Diskussions-Chat mit der KI (nur Pro-Modell).** Direkt im
  Empfehlungs-Screen soll ein freier Chat-Bereich stehen, in dem der
  Nutzer das vorgeschlagene Konzept hinterfragen kann und DeepSeek
  Gegenvorschläge macht; bei Einigung werden die editierbaren
  Empfehlungsfelder direkt aktualisiert. Der geführte Chatverlauf bzw. die
  daraus resultierenden Entscheidungen sollen mit im Projekt gespeichert
  werden (sichtbar für spätere Entscheidungen), aber nicht "fest
  verkabelt" wie bei den Custom-Agents — genaues Format wartet noch auf
  ein konkretes Beispiel vom Nutzer, bevor es spezifiziert wird.

## MVP-Scope / Meilenstein 1 (entschieden)

Erste lauffähige Version = **Kern-Wizard**: Tool-Auswahl + Datei-Generierung
(`AGENTS.md`/`HANDOFF.md`/`opencode.jsonc` etc.) für ein neues Projekt.
Noch **nicht** in v1: Plugin-Registry, DeepSeek-Integration, GitHub-
Repo-Anlage, Live-Handoff. Diese kommen in nachfolgenden Ausbaustufen, auf
dem Kern-Wizard aufbauend.

## UI-Grundsätze (entschieden)

- **Hick's Law:** Pro Screen/Schritt so wenige gleichzeitige Auswahl-
  optionen wie möglich zeigen, um Entscheidungszeit klein zu halten —
  gilt für den ganzen Wizard-Flow (Tool-Auswahl, Plugin-Auswahl, HITL-
  Stufen-Auswahl etc.), nicht nur einzelne Screens.
- **Theme-Umschaltung:** Dark/Light-Mode bzw. Farbthemen sind im UI direkt
  umschaltbar, nicht nur Systemeinstellung-abhängig.

## Nächster Schritt

Alle bisher offenen konzeptionellen Fragen sind geklärt. Nächster Schritt:
Architektur-Skizze (Ordnerstruktur, Datenfluss, Tool-Adapter-Design,
detaillierter Meilenstein-Plan für den Kern-Wizard) — wird separat erstellt
und vor Code-Implementierung zur Freigabe vorgelegt.
