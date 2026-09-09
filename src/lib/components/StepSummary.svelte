<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { wizardStore } from "../wizardStore";
  import { HITL_LEVELS } from "../types";
  import type { SetupProjectRequest, SetupProjectResponse } from "../types";
  import { get } from "svelte/store";

  let running = $state(false);
  let error = $state("");

  const wizardState = $derived($wizardStore);
  const hitlLabel = $derived(HITL_LEVELS.find((l) => l.value === wizardState.hitlLevel)?.label ?? wizardState.hitlLevel);

  function back() {
    wizardStore.goToStep("hitl");
  }

  async function run() {
    running = true;
    error = "";
    const current = get(wizardStore);

    const request: SetupProjectRequest = {
      project_name: current.projectName,
      project_root: current.projectRoot,
      selected_tool_ids: current.selectedToolIds,
      hitl_level: current.hitlLevel,
      already_confirmed: [],
      opencode_model: current.opencodeModel.trim() || null,
    };

    try {
      const response = await invoke<SetupProjectResponse>("setup_project", { request });
      wizardStore.setOutcomes(response.outcomes);
    } catch (e) {
      error = `Setup fehlgeschlagen: ${e}`;
    } finally {
      running = false;
    }
  }

  async function openProjectFolder() {
    try {
      await openPath(wizardState.projectRoot);
    } catch (e) {
      error = `Ordner konnte nicht geöffnet werden: ${e}`;
    }
  }
</script>

<section>
  <h2>3. Zusammenfassung</h2>

  <dl>
    <dt>Projekt</dt>
    <dd>{wizardState.projectName}</dd>
    <dt>Zielordner</dt>
    <dd>{wizardState.projectRoot}</dd>
    <dt>Tools</dt>
    <dd>{wizardState.selectedToolIds.join(", ")}</dd>
    {#if wizardState.opencodeModel.trim().length > 0}
      <dt>Modell unter opencode</dt>
      <dd>{wizardState.opencodeModel}</dd>
    {/if}
    <dt>Rückfrage-Verhalten</dt>
    <dd>{hitlLabel}</dd>
  </dl>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if wizardState.outcomes}
    <h3>Ergebnis</h3>
    <ul>
      {#each wizardState.outcomes as outcome}
        <li class={outcome.outcome.toLowerCase()}>
          {#if outcome.outcome === "Written"}
            ✓ {outcome.path}
          {:else if outcome.outcome === "Skipped"}
            ⏭ {outcome.path} — {outcome.reason}
          {:else}
            ✗ {outcome.path} — {outcome.error}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    <button type="button" onclick={back} disabled={running}>Zurück</button>
    {#if wizardState.outcomes}
      <button type="button" onclick={openProjectFolder}>Ordner öffnen</button>
    {/if}
    <button type="button" onclick={run} disabled={running}>
      {running ? "Wird eingerichtet…" : "Projekt einrichten"}
    </button>
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 32rem;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0;
  }

  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  li.failed {
    color: var(--owai-danger);
  }

  .error {
    color: var(--owai-danger);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
