<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import type { ToolInfo } from "../types";

  // Wenn eine KI-Empfehlung vorliegt (KI-Pfad durchlaufen und
  // StepRecommendation abgeschlossen), sind Tools und HITL-Stufe dort
  // bereits final gewählt — dieser Screen fragt dann nur noch
  // Projektname/Zielordner ab und überspringt Tool-Auswahl/HITL-Schritt.
  const usedAiRecommendation = get(wizardStore).recommendation !== null;

  let tools = $state<ToolInfo[]>([]);
  let projectName = $state("");
  let projectRoot = $state("");
  let selected = $state<Set<string>>(new Set());
  let loading = $state(!usedAiRecommendation);
  let error = $state("");

  onMount(async () => {
    if (usedAiRecommendation) return;

    const prefilled = get(wizardStore).selectedToolIds;
    if (prefilled.length > 0) {
      selected = new Set(prefilled);
    }

    try {
      tools = await invoke<ToolInfo[]>("list_supported_tools");
    } catch (e) {
      error = `Tools konnten nicht geladen werden: ${e}`;
    } finally {
      loading = false;
    }
  });

  async function pickFolder() {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "Zielordner für das Projekt wählen",
    });
    if (typeof selectedPath === "string") {
      projectRoot = selectedPath;
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function next() {
    wizardStore.setProjectBasics(projectName, projectRoot);
    if (usedAiRecommendation) {
      wizardStore.goToStep("summary");
    } else {
      wizardStore.setSelectedTools(Array.from(selected));
      wizardStore.goToStep("hitl");
    }
  }

  const canProceed = $derived(
    projectName.trim().length > 0 && projectRoot.trim().length > 0 && (usedAiRecommendation || selected.size > 0)
  );
</script>

<section>
  <h2>Projekt</h2>

  <label>
    Projektname
    <input type="text" bind:value={projectName} placeholder="mein-projekt" />
  </label>

  <div class="folder-picker">
    <span class="folder-picker-label">Zielordner</span>
    <div class="folder-picker-row">
      <output class="folder-path" class:placeholder={!projectRoot}>
        {projectRoot || "Kein Ordner gewählt"}
      </output>
      <button type="button" onclick={pickFolder}>Ordner wählen…</button>
    </div>
  </div>

  {#if !usedAiRecommendation}
    {#if loading}
      <p>Lade Tools…</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else}
      <fieldset>
        <legend>Welche KI-Tools sollen für dieses Projekt genutzt werden?</legend>
        {#each tools as tool (tool.id)}
          <label class="tool-option">
            <input
              type="checkbox"
              checked={selected.has(tool.id)}
              onchange={() => toggle(tool.id)}
            />
            {tool.display_name}
          </label>
        {/each}
      </fieldset>
    {/if}
  {/if}

  <button type="button" disabled={!canProceed} onclick={next}>Weiter</button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 32rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
  }

  .tool-option {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 1rem;
  }

  .error {
    color: var(--owai-danger);
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
</style>
