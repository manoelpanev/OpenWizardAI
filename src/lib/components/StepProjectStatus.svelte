<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { wizardStore } from "../wizardStore";
  import type { ExistingConfig } from "../types";

  let isNewProject = $state(true);
  let existingRoot = $state("");
  let scanning = $state(false);
  let scanResults = $state<[string, ExistingConfig][]>([]);
  let scanned = $state(false);

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
    }
  }

  async function scan() {
    scanning = true;
    try {
      scanResults = await invoke<[string, ExistingConfig][]>("detect_existing_tools", {
        projectRoot: existingRoot,
      });
    } finally {
      scanning = false;
      scanned = true;
    }
  }

  function next() {
    wizardStore.setIsNewProject(isNewProject);
    if (!isNewProject) {
      wizardStore.setProjectBasics("", existingRoot);
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

    {#if existingRoot}
      <button type="button" onclick={scan} disabled={scanning}>
        {scanning ? "Scanne…" : "Vorhandene Konfiguration scannen"}
      </button>
    {/if}

    {#if scanned}
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

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
