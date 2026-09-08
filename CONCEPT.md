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

## Offene Fragen (noch nicht entschieden)

- Wie sieht der Wizard-Flow UI-seitig konkret aus (Schritt-für-Schritt)?
- Wird der Masterprompt-Text als generisches Template parametrisiert
  (Projektname statt "MRPNV_AI") oder pro Nutzer fest übernommen?
- Wie wird das gewählte Set an KI-Tools technisch verwaltet — eine zentrale
  Config-Datei, die pro Tool in dessen natives Format projiziert wird, oder
  pro Tool eine eigene native Datei ohne gemeinsame Zwischenschicht?
- Wie wird der DeepSeek-API-Key verwaltet (Keychain, .env, Wizard-Prompt bei
  erster Nutzung)?
- Native macOS-App (Swift/SwiftUI, wie OpenPin) oder Electron/Tauri, falls
  spätere OS-Portierung leichter sein soll?
- Lizenz für das öffentliche Repo noch nicht gewählt.

## Nächster Schritt

Sobald die offenen Fragen oben geklärt sind, wird daraus eine Architektur-
Skizze (Ordnerstruktur, Datenfluss, erster Meilenstein) — vor jeglicher
Code-Implementierung erneut zur Freigabe vorgelegt.
