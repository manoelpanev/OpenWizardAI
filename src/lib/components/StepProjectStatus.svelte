<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { wizardStore } from "../wizardStore";
  import type { ExistingConfig, ProjectAnalysis } from "../types";
  import { formatProjectAnalysis } from "../types";

  let isNewProject = $state(true);
  let existingRoot = $state("");
  let scanning = $state(false);
  let scanResults = $state<[string, ExistingConfig][]>([]);
  let scanned = $state(false);
  let analysis = $state<ProjectAnalysis | null>(null);
  let analysisError = $state("");

  async function pickExistingFolder() {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "Bestehendes Projekt wählen",
    });
    if (typeof selectedPath === "string") {
      existingRoot = selectedPath;
      scanned = false;
      scanResults = [];
      analysis = null;
      analysisError = "";
      // Analyse direkt nach der Ordnerwahl, ohne extra Klick — die KI
      // soll sich selbst um das bestehende Projekt kümmern.
      void scan();
    }
  }

  async function scan() {
    scanning = true;
    analysisError = "";
    try {
      const [tools, projectAnalysis] = await Promise.all([
        invoke<[string, ExistingConfig][]>("detect_existing_tools", { projectRoot: existingRoot }),
        invoke<ProjectAnalysis>("analyze_project", { projectRoot: existingRoot }),
      ]);
      scanResults = tools;
      analysis = projectAnalysis;
      wizardStore.setProjectAnalysis(formatProjectAnalysis(projectAnalysis));
    } catch (e) {
      analysisError = `Projekt konnte nicht vollständig analysiert werden: ${e}`;
    } finally {
      scanning = false;
      scanned = true;
    }
  }

  function next() {
    wizardStore.setIsNewProject(isNewProject);
    if (!isNewProject) {
      wizardStore.setProjectBasics("", existingRoot);
    } else {
      // Bei einem neuen Projekt gibt es nichts zu analysieren — einen
      // eventuell vorher gescannten Ordner nicht mitschleppen.
      wizardStore.setProjectAnalysis("");
    }
    wizardStore.goToStep("storage-mode");
  }

  const canProceed = $derived(isNewProject || existingRoot.trim().length > 0);
</script>

<section>
  <h2>Projekt-Status</h2>
  <p>Ist das ein neues Projekt, oder soll ein bestehendes optimiert werden?</p>

  <div class="options">
    <label class="option" class:active={isNewProject}>
      <input type="radio" name="project-status" checked={isNewProject} onchange={() => (isNewProject = true)} />
      Neues Projekt
    </label>
    <label class="option" class:active={!isNewProject}>
      <input type="radio" name="project-status" checked={!isNewProject} onchange={() => (isNewProject = false)} />
      Bestehendes Projekt optimieren/andocken
    </label>
  </div>

  {#if !isNewProject}
    <div class="folder-picker">
      <span class="folder-picker-label">Projektordner</span>
      <div class="folder-picker-row">
        <output class="folder-path" class:placeholder={!existingRoot}>
          {existingRoot || "Kein Ordner gewählt"}
        </output>
        <button type="button" onclick={pickExistingFolder}>Ordner wählen…</button>
      </div>
    </div>

    {#if existingRoot && scanning}
      <p class="hint">Projekt wird analysiert…</p>
    {/if}

    {#if existingRoot && !scanning}
      <button type="button" onclick={scan}>Erneut analysieren</button>
    {/if}

    {#if analysisError}
      <p class="error">{analysisError}</p>
    {/if}

    {#if scanned && !scanning}
      {#if analysis}
        <dl class="analysis">
          {#if analysis.languages.length > 0}
            <dt>Erkannt</dt>
            <dd>{analysis.languages.join(", ")}</dd>
          {/if}
          {#if analysis.markers.length > 0}
            <dt>Marker-Dateien</dt>
            <dd>{analysis.markers.join(", ")}</dd>
          {/if}
          <dt>Git-Repository</dt>
          <dd>{analysis.has_git ? "ja" : "nein"}</dd>
          {#if analysis.top_extensions.length > 0}
            <dt>Häufigste Dateien</dt>
            <dd>{analysis.top_extensions.join(", ")}</dd>
          {/if}
        </dl>
        <p class="hint">
          Diese Analyse geht als Kontext an DeepSeek — Tool-, Plugin- und Agent-Vorschläge richten sich danach.
        </p>
      {/if}

      {#if scanResults.length === 0}
        <p class="hint">Keine bekannten Tool-Konfigurationen gefunden.</p>
      {:else}
        <ul class="scan-results">
          {#each scanResults as [toolId, config] (toolId)}
            <li><strong>{toolId}</strong>: {config.found_paths.join(", ")}</li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/if}

  <div class="actions">
    <button type="button" disabled={!canProceed} onclick={next}>Weiter</button>
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 32rem;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .option {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .option.active {
    border-color: var(--owai-accent);
  }

  .folder-picker {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
  }

  .folder-picker-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .folder-path {
    flex: 1;
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem;
    font-weight: 400;
    font-family: monospace;
    font-size: 0.85rem;
    overflow-x: auto;
    white-space: nowrap;
  }

  .folder-path.placeholder {
    color: var(--owai-muted);
    font-family: inherit;
  }

  .scan-results {
    margin: 0;
    padding-left: 1.2rem;
    font-size: 0.85rem;
  }

  .hint {
    color: var(--owai-muted);
    font-size: 0.85rem;
  }

  .error {
    color: var(--owai-danger);
    font-size: 0.85rem;
  }

  .analysis {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    margin: 0;
    font-size: 0.85rem;
  }

  .analysis dt {
    color: var(--owai-muted);
  }

  .analysis dd {
    margin: 0;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
