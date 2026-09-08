<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { wizardStore } from "../wizardStore";
  import type { ToolInfo } from "../types";

  let tools = $state<ToolInfo[]>([]);
  let projectName = $state("");
  let projectRoot = $state("");
  let selected = $state<Set<string>>(new Set());
  let loading = $state(true);
  let error = $state("");

  onMount(async () => {
    try {
      tools = await invoke<ToolInfo[]>("list_supported_tools");
    } catch (e) {
      error = `Tools konnten nicht geladen werden: ${e}`;
    } finally {
      loading = false;
    }
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function next() {
    wizardStore.setProjectBasics(projectName, projectRoot);
    wizardStore.setSelectedTools(Array.from(selected));
    wizardStore.goToStep(2);
  }

  const canProceed = $derived(projectName.trim().length > 0 && projectRoot.trim().length > 0 && selected.size > 0);
</script>

<section>
  <h2>1. Projekt & Tools</h2>

  <label>
    Projektname
    <input type="text" bind:value={projectName} placeholder="mein-projekt" />
  </label>

  <label>
    Zielordner
    <input type="text" bind:value={projectRoot} placeholder="/pfad/zum/projekt" />
  </label>

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
</style>
