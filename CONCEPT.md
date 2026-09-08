# OpenWizardAI — Konzept

Status: **Konzeptphase für den Wizard selbst, aber M1/M3 bereits als Code
umgesetzt** (siehe "Aktueller Stand & Wiedereinstiegspunkt" unten und
ARCHITECTURE.md). Dieses Dokument fasst die bisher mit dem Nutzer
geklärten Entscheidungen zusammen und markiert offene Fragen explizit als
offen — es wird nichts geraten, was noch nicht festgelegt wurde.

**Arbeitsweise an diesem Repo (Meta, betrifft die Entwicklung von
OpenWizardAI selbst — nicht zu verwechseln mit dem im Konzept
beschriebenen Feature "Arbeitsweise/Speicherort-Frage" für Wizard-Nutzer
weiter unten):** Dieses Repo wird bewusst im "Nur GitHub, temporär"-Modus
bearbeitet (Modus 3 aus dem Speicherort-Konzept, hier auf uns selbst
angewendet) — kein dauerhafter lokaler Checkout. Jede Session klont
frisch von GitHub in einen temporären Ordner, arbeitet, committed, pusht,
der temporäre Ordner wird danach nicht als dauerhafte Quelle behandelt.
GitHub (`main`-Branch) ist die einzige verbindliche Quelle des
Projektstands.

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

## Custom-API-Registry (entschieden, noch nicht umgesetzt)

Ergänzt das Plugin-System oben: Nutzer sollen beliebige eigene API-Zugänge
hinzufügen können (z.B. Mesh, Higgsfield), die DeepSeek dann nutzen kann —
nicht nur die im Konzept bereits fest vorgesehene DeepSeek-API selbst.

- **Strukturell wie ein Plugin behandelt**, kein separates System: ein
  Custom-API-Eintrag nutzt das bestehende Plugin-Registry-Schema
  (`id`, `name`, `description`, `tags[]`, `targetTools[]`, `version`, …)
  mit `source: custom-api` statt `own`/`claude-import`/`github-discovered`.
  Zusätzliche API-spezifische Felder: Endpoint-URL, Auth-Methode (z.B.
  Bearer-Token), der Key selbst (gespeichert wie der DeepSeek-Key im
  OS-Keychain, s.o. — nie im Klartext).
- **Freigabe-Workflow identisch zum Plugin-System:** eine neu hinzugefügte
  Custom-API ist sofort nutzbar, sobald der Nutzer sie selbst einträgt
  (er ist ja die einzige Quelle, kein Community-Discovery-Fall wie bei
  GitHub-gefundenen Plugins) — kein zusätzlicher Freigabeschritt nötig,
  weil der Eintragende bereits der Freigebende ist.
- **Schutz vor schlechten/kaputten APIs: nur technische Checks, keine
  Inhalts-/Content-Moderation.** Vor Aktivierung eines Eintrags: Ping/
  Erreichbarkeitstest, Response-Format-Validierung (JSON gültig?),
  Timeout-Handling, Rate-Limit-Erkennung anhand von Standard-Headern
  (z.B. `Retry-After`) — bei Fehlschlag wird der Eintrag als "nicht
  erreichbar" markiert statt aktiviert, der Nutzer sieht das im UI und
  kann die Angaben korrigieren.

## Hermes — projektübergreifende Steuerungsebene (entschieden, grobe Architektur, noch nicht umgesetzt)

Geht über den Live-Session-Übergabe-Tray-Prozess oben hinaus: Hermes ist
ein **eigener, übergeordneter Hintergrundprozess über allen mit
OpenWizardAI verwalteten Projekten** — nicht derselbe Prozess erweitert,
sondern eine zweite Ebene darüber. Der bestehende Pro-Projekt-Tray-Prozess
bleibt für die Live-Session-Übergabe innerhalb eines einzelnen Projekts
zuständig; Hermes sieht und koordiniert projektübergreifend.

- **Kennt alle Projekte/Vorhaben** des Nutzers, die über OpenWizardAI
  angelegt/angedockt wurden, inklusive deren aktuellem Stand (analog zum
  im Konzept bereits als offen markierten Projekt-Dashboard — Hermes ist
  die Prozess-Ebene dahinter, das Dashboard vermutlich eine seiner
  Oberflächen).
- **Nutzt alle registrierten Plugins/APIs.** Da Custom-APIs strukturell
  Plugins sind (siehe oben), hat Hermes über dieselbe Plugin-Schnittstelle
  Zugriff auf alles, was der Nutzer registriert hat — keine gesonderte
  Hermes-eigene Integrationsschicht pro API.
- **Kann selbstständig Projekte starten und durchführen.** Nutzer
  beschreibt ein Vorhaben ("ich will X"), Hermes übernimmt die Umsetzung
  eigenständig, meldet dabei laufend Fortschritt und eine Zeitschätzung
  ("das dauert so und so lange"), und fragt nur am Ende bzw. bei
  wirklich entscheidenden Punkten nach — nicht bei jedem Zwischenschritt.
  Passt zur bestehenden HITL-Stufen-Idee, aber projektübergreifend statt
  nur pro einzelnem Tool-Adapter.
- **WhatsApp als Steuerungs-Kanal.** Hermes ist auch per WhatsApp
  ansprechbar; ein Agent antwortet dort (DeepSeek Flash als Default-Modell
  für diese Konversationen, konsistent mit der bestehenden Modellwahl).
  **Jede Aktion mit echten Auswirkungen (Datei schreiben, Repo anlegen,
  Push, u.ä.) braucht vor Ausführung eine explizite Bestätigung** durch
  den Nutzer im Chat — WhatsApp ist ein Steuerungs-Kanal, kein Freifahrt-
  schein für autonome Aktionen.
- **Lokale Sprachsteuerung.** Referenz-Vorbild ist die Open-Source-App
  [Hex](https://github.com/kitlangton/Hex) (`com.kitlangton.hex2`): hält
  man eine Taste gedrückt, wird Sprache lokal per Spracherkennungsmodell
  transkribiert und eingefügt, kein Cloud-STT. Für Hermes übernommen:
  dieselbe Grundmechanik, aber mit wählbarem lokalem Modell (z.B.
  Parakeet statt Whisper, je nach Verfügbarkeit/Sprache) — nutzbar sowohl
  für Diktat-Steuerung von Hermes selbst als auch als eigenständiges
  Transcript-Tool (Video/Audio zu Text, Text-zu-Skript-Umwandlung
  beliebiger Dateien). Ein-/ausschaltbar, nicht permanent aktiv.
- **Beispiel-Nutzungsfluss** (illustriert das Zusammenspiel, kein fertiger
  UI-Entwurf): Nutzer sagt/schreibt Hermes "baue mir ein Transcript-Tool
  für Video-Calls". Hermes legt darauf ein neues Projekt an (nutzt den
  Kern-Wizard-Flow aus M1 intern, ohne dass der Nutzer den Wizard manuell
  durchklickt), wählt passende Tools/Plugins, meldet eine Zeitschätzung,
  baut das Projekt, und fragt am Ende nur noch nach Freigabe/Feinschliff.

Details (Hermes-Prozessarchitektur im Detail, WhatsApp-Anbindung/
Business-API-Registrierung, welches lokale Spracherkennungsmodell konkret
gebündelt wird, Verhältnis Hermes-Prozess zu Pro-Projekt-Tray-Prozess auf
Code-Ebene) noch nicht ausgearbeitet — wird vor Implementierung wie
gewohnt zur Freigabe vorgelegt.

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
   Verbinden. Falls ja: **pro bereits gewähltem KI-Tool optional ein
   eigener, unterschiedlicher Agent** — Liste statt Einzelfeld (z.B. ein
   Test-Agent nur für Claude Code, ein Recherche-Agent nur für Codex).
   Nutzer beschreibt je Tool in Freitext, was für ein Agent gewünscht
   ist; DeepSeek richtet den jeweiligen Agenten für das zugehörige Tool
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
  - **Pro Projekt: eigener Resume-Prompt.** Jedes Projekt im Dashboard
    trägt einen kleinen, editierbaren Prompt-Text, der beschreibt, wie
    eine KI-Session an diesem Projekt genau dort weitermachen soll, wo
    zuletzt aufgehört wurde — analog zum "Resume-Prompt"-Prinzip, das
    OpenWizardAI selbst für sich nutzt (siehe oben). Wird vermutlich aus
    der HANDOFF.md-Historie (nächster Punkt) automatisch abgeleitet/
    aktuell gehalten, bleibt aber manuell überschreibbar.
  - **Klick auf ein Projekt öffnet ein Optionsmenü**, mindestens: Öffnen
    (im gewählten Tool/Editor), Prompt anzeigen/bearbeiten, vermutlich
    weitere Optionen (Konfiguration ansehen/ändern, Projekt entfernen aus
    der Übersicht). Genaue Optionsliste noch nicht final.
- **HANDOFF.md mit Entscheidungs-Historie.** Alle Wizard-Entscheidungen
  (Tool-Wahl, HITL-Stufe, Plugin-Auswahl, Custom-Agent) werden in einer
  `HANDOFF.md` protokolliert; optional zu GitHub hochladbar, private/
  sensible Daten (z.B. API-Keys, lokale Pfade) werden dabei ausgeschlossen.
  Verhältnis zum bereits konzipierten Masterprompt-Format noch zu klären.
- **Diskussions-Chat mit der KI (nur Pro-Modell).** Direkt im
  Empfehlungs-Screen soll ein freier Chat-Bereich stehen, in dem der
  Nutzer das vorgeschlagene Konzept hinterfragen kann und DeepSeek
  Gegenvorschläge macht; bei Einigung werden die editierbaren
  Empfehlungsfelder direkt aktualisiert. Soll auch eine eigene Einschätzung
  einbringen können, welches KI-Tool/Modell für das konkrete Vorhaben am
  besten passt (eigene Bewertungsbasis der KI, nicht nur Reaktion auf
  Nutzerfragen). Der geführte Chatverlauf bzw. die daraus resultierenden
  Entscheidungen sollen mit im Projekt gespeichert werden (sichtbar für
  spätere Entscheidungen), aber nicht "fest verkabelt" wie bei den
  Custom-Agents — genaues Format wartet noch auf ein konkretes Beispiel
  vom Nutzer, bevor es spezifiziert wird.
- **Tutorial: wie benutzt man die eingerichteten Custom-Agents.** Jedes
  KI-Tool hat ein anderes Konzept für Sub-Agents/Custom-Agents (eigene
  Aufruf-Syntax, eigener Speicherort). Nutzer braucht eine Anleitung, wie
  ein von OpenWizardAI eingerichteter Agent im jeweiligen Tool tatsächlich
  aufgerufen/benutzt wird. **Ort noch offen** — denkbar: direkt im Wizard
  (z.B. als letzter Screen nach dem Setup, tool-spezifisch generiert),
  oder externe Dokumentation (README, Wiki, o.ä.). Entscheidung steht
  noch aus.
- **Echter Fortschrittsbalken statt endlos pulsierend.** Betrifft die
  bereits gebauten `indeterminate`-Ladebalken in `StepQuestions.svelte`
  ("Rückfragen werden erstellt") und `StepFollowupQuestions.svelte`
  ("Empfehlung wird geladen") — diese zeigen aktuell keinen echten
  Fortschritt, nur eine pulsierende Animation ohne Prozentzahl. Gewünscht:
  eine tatsächliche Prozentanzeige, die bei 99% bewusst künstlich
  verlangsamt wird (UX-Trick, damit der letzte Schritt nicht abrupt
  wirkt). Da ein einzelner DeepSeek-API-Call kein echtes serverseitiges
  Fortschritts-Signal liefert, bräuchte das einen simulierten Verlauf
  (client-seitige Zeitschätzung Richtung 99%, Sprung auf 100% erst bei
  tatsächlicher Antwort) statt eines echten Prozentwerts vom Server.
- **Web-Recherche in die Rückfragen-Analyse.** DeepSeek soll beim
  Generieren/Bewerten der Vertiefungsfragen (`generate_followup_questions`,
  `check_answer_clarity` in `recommendation.rs`) optional online
  recherchieren können statt nur den reinen Nutzertext zu analysieren
  — z.B. über Tavily als Suchanbieter. **Ein-/ausschaltbar und mit
  eigenem, vom Nutzer editierbarem API-Key** (analog zur DeepSeek-Key-
  Verwaltung im OS-Keychain) — kein fest verdrahteter Zwang zur
  Websuche. Verhältnis zur bereits konzipierten Custom-API-Registry
  oben: vermutlich einer der ersten konkreten Custom-API-Einträge,
  sobald die Registry existiert, statt einer komplett eigenen
  Integration.
- **Lokale Instanz pro Nutzer mit Auto-Update.** Jeder Nutzer soll eine
  eigene lokale Installation von OpenWizardAI haben (nicht nur den
  "Nur GitHub, temporär"-Arbeitsmodus, der aktuell nur für die
  Entwicklung von OpenWizardAI selbst gilt), die sich selbstständig
  aktualisiert, sobald eine neue Version auf GitHub verfügbar ist.
  Technischer Ansatz noch offen — vermutlich Tauris eingebauter
  Updater-Mechanismus (`tauri-plugin-updater`) gegen GitHub Releases,
  aber noch nicht geprüft/entschieden.

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

## Aktueller Stand & Wiedereinstiegspunkt

**Zweck dieses Abschnitts:** Damit eine neue Session (oder ein neuer Chat,
falls das Kontextfenster voll ist) sofort weiß, wo weitergemacht wird —
ohne die komplette Commit-Historie durchsuchen zu müssen. Wird bei jedem
größeren Fortschritt aktualisiert.

**Resume-Prompt zum Copy-Pasten in einen neuen Chat** (im richtigen
Projektordner geöffnet reicht dieser eine Satz, kein Pfad/URL nötig):

> Lies CONCEPT.md, Abschnitt "Aktueller Stand & Wiedereinstiegspunkt",
> und mach dort weiter.

**Fertig (siehe ARCHITECTURE.md für Details):**
- M1 — Kern-Wizard: 4 Tool-Adapter, `fs::writer` mit HITL-Logik,
  Tauri-Commands, Svelte-UI mit Theme-Umschalter
- M3 (Teil 1-4) — DeepSeek-Onboarding-Flow: Projekt-Status-Frage (neu/
  bestehend), API-Key-Verbindung (optional, verschlüsselt im Keychain),
  Custom-Agent-Frage, Basis-Fragen, dynamisch generierte Vertiefungsfragen
  mit Klärungs-Nachfrage-Logik, kombinierte KI-Empfehlung (Tools/HITL/
  Plugin-Themen/Agent) mit Begründung, komplett inline editierbar,
  Fortschrittsbalken, Ordner-öffnen-Button
- Onboarding-Flow um "Arbeitsweise"-Schritt (3 Modi: Nur lokal/Lokal+
  GitHub/Nur GitHub) im UI ergänzt — reine Auswahl, GitHub-OAuth/Repo-
  Anlage/Push-Logik dahinter noch nicht umgesetzt (siehe Abschnitt unten)
- Dev-Signing gefixt (`signingIdentity: "-"` in `tauri.conf.json`) gegen
  wiederholte Keychain-Nachfragen bei jedem `cargo tauri dev`-Neustart;
  striktes Verhaltensprotokoll (`deepseek/behavior.rs`,
  `STRICT_BEHAVIOR_PREFIX`) allen DeepSeek-Systemprompts vorangestellt —
  Grounding an echten Nutzerantworten, Ignorieren von Prompt-Injection-
  Versuchen in Nutzerantworten, striktes JSON-Format

**Nächster Schritt (konzeptionell entschieden, noch nicht umgesetzt):**
Siehe "Arbeitsweise/Speicherort-Frage — 3 Modi" unten — GitHub-Verbindung
per OAuth-Flow (Client-ID/Secret einer registrierten GitHub-OAuth-App
noch offen), Repo-Erstellung direkt aus dem Wizard, tatsächliches
Commit+Push-Verhalten für Modus 2/3.

**Noch offen, unspezifiziert (siehe jeweilige Abschnitte oben):**
Projekt-Dashboard (inkl. Pro-Projekt-Resume-Prompt), HANDOFF.md-
Entscheidungshistorie, Diskussions-Chat mit der KI (Pro-only) inkl. Tool/
Modell-Empfehlung, Multi-Agent-Nutzungstutorial (Ort noch offen),
Plugin-Registry (M2) noch nicht gebaut — Empfehlung liefert bisher nur
Freitext-Plugin-Themen statt echter Plugin-IDs. Neu hinzugekommen:
Custom-API-Registry (Mesh/Higgsfield etc. als Plugins) und Hermes als
projektübergreifende Steuerungsebene (WhatsApp-Anbindung, lokale
Sprachsteuerung nach Hex-Vorbild, autonome Projektdurchführung) — siehe
jeweils eigene Abschnitte oben, grobe Architektur entschieden, komplett
unimplementiert. Außerdem neu: echter Fortschrittsbalken mit
99%-Verlangsamung statt `indeterminate`-Animation, Tavily-Websuche
ein-/ausschaltbar in die Rückfragen-Analyse, lokale Auto-Update-Instanz
pro Nutzer.

## Arbeitsweise/Speicherort-Frage — 3 Modi (entschieden, noch nicht umgesetzt)

Neue Frage im Onboarding-Flow (Position noch festzulegen, vermutlich nah
an der Projekt-Status-Frage aus Schritt 0): **wie möchte der Nutzer mit
dem Projekt arbeiten.** Drei Modi:

1. **Nur lokal** (aktueller Stand aus M1/M3): Zielordner auf der eigenen
   Platte, kein GitHub involviert.
2. **Lokal + GitHub**: lokaler Ordner ist die Arbeitskopie wie in Modus 1,
   zusätzlich wird jede vom Wizard geschriebene Änderung committed und zu
   einem GitHub-Repo gepusht. Bestehendes Repo verbinden oder über den
   Wizard neu anlegen (Sichtbarkeit privat/öffentlich wählbar, wie im
   Konzept unter "GitHub-Integration" bereits vorgesehen).
3. **Nur GitHub, kein dauerhafter lokaler Ordner**: OpenWizardAI legt
   einen temporären Arbeitsordner an, klont/aktualisiert von dort, jede
   Änderung wird committed und sofort gepusht. **Nach jedem erfolgreichen
   Push wird der Temp-Ordner sofort gelöscht** — GitHub bleibt die
   einzige dauerhafte Quelle, kein Datenmüll auf der lokalen Platte. Bei
   der nächsten Aktion wird frisch geklont.

**GitHub-Verbindung: OAuth-Flow.** "Mit GitHub verbinden"-Button öffnet
den Browser für den GitHub-Login/-Bestätigung, Token kommt automatisch
zurück (kein manuelles Token-Einfügen wie beim DeepSeek-Key). Setzt eine
registrierte GitHub-OAuth-App für OpenWizardAI voraus (Client-ID/Secret —
Verwaltung davon noch zu klären, vermutlich analog zur DeepSeek-Key-
Verwaltung im OS-Keychain, aber für den zurückgegebenen Token statt einen
selbst eingefügten Key).

**Repo-Erstellung direkt aus dem Wizard**, wenn kein bestehendes Repo
verbunden wird — nutzt die bereits im Konzept vorgesehene GitHub-Integration
(privat/öffentlich wählbar).

**Konkretisierung für opencode/OpenChamber:** Bei diesem Tool soll nicht
nur "opencode nutzen" ausgewählt werden, sondern zusätzlich, welches
KI-Modell darunter läuft (z.B. DeepSeek, Claude, Codex) — eine Auswahl-
liste verschiedener Modelle, die opencode ansteuern kann.

Details (genauer UI-Flow, Konflikt-Behandlung beim Schreiben in Modus 2/3,
OAuth-App-Registrierung/Client-Secret-Verwaltung) noch nicht ausgearbeitet
— wird vor Implementierung wie gewohnt zur Freigabe vorgelegt.
