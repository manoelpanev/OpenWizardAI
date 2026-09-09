<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import type { OpencodeModel, ToolInfo } from "../types";

  const OPENCODE_ID = "opencode";
  // Sentinel für "eigenes Modell eintragen" im Dropdown — kein echtes
  // Modell-ID, damit die kuratierte Liste nicht limitierend ist.
  const CUSTOM_MODEL_CHOICE = "__custom__";

  // Wenn eine KI-Empfehlung vorliegt (KI-Pfad durchlaufen und
  // StepRecommendation abgeschlossen), sind Tools und HITL-Stufe dort
  // bereits final gewählt — dieser Screen fragt dann nur noch
  // Projektname/Zielordner ab und überspringt Tool-Auswahl/HITL-Schritt.
  const usedAiRecommendation = get(wizardStore).recommendation !== null;

  let tools = $state<ToolInfo[]>([]);
  let projectName = $state(get(wizardStore).projectName);
  let projectRoot = $state(get(wizardStore).projectRoot);
  let selected = $state<Set<string>>(new Set());
  let loading = $state(!usedAiRecommendation);
  let error = $state("");
  let opencodeModels = $state<OpencodeModel[]>([]);
  let opencodeModelChoice = $state("");
  let customOpencodeModel = $state("");

  onMount(async () => {
    // Modell-Liste in beiden Pfaden laden: auch eine KI-Empfehlung kann
    // opencode enthalten, dann braucht der Nutzer hier das Dropdown.
    try {
      opencodeModels = await invoke<OpencodeModel[]>("list_opencode_models");
      opencodeModelChoice = opencodeModels[0]?.id ?? "";
    } catch {
      // Ohne Liste bleibt nur die Freitext-Eingabe — kein harter Fehler,
      // da das Modell ohnehin optional ist.
      opencodeModelChoice = CUSTOM_MODEL_CHOICE;
    }

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
    // Nur speichern, wenn opencode überhaupt gewählt ist — sonst bliebe
    // ein vorher gewähltes Modell hängen, obwohl das Tool abgewählt wurde.
    wizardStore.setOpencodeModel(opencodeSelected ? effectiveOpencodeModel.trim() : "");
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

  // Im KI-Pfad stehen die Tools schon im Store (aus der Empfehlung), im
  // manuellen Pfad in der lokalen Checkbox-Auswahl.
  const opencodeSelected = $derived(
    usedAiRecommendation ? $wizardStore.selectedToolIds.includes(OPENCODE_ID) : selected.has(OPENCODE_ID)
  );

  const effectiveOpencodeModel = $derived(
    opencodeModelChoice === CUSTOM_MODEL_CHOICE ? customOpencodeModel : opencodeModelChoice
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

  {#if opencodeSelected}
    <div class="model-callout">
      <div class="model-callout-head">
        <span class="model-callout-badge">opencode</span>
        <strong>Welches KI-Modell soll darunter laufen?</strong>
      </div>

      <label>
        Modell
        <select bind:value={opencodeModelChoice}>
          {#each opencodeModels as model (model.id)}
            <option value={model.id}>{model.display_name}</option>
          {/each}
          <option value={CUSTOM_MODEL_CHOICE}>Eigenes Modell eintragen…</option>
        </select>
      </label>

      {#if opencodeModelChoice === CUSTOM_MODEL_CHOICE}
        <label>
          Modell-Bezeichner
          <input type="text" bind:value={customOpencodeModel} placeholder="provider/modell-name" />
        </label>
      {/if}

      <p class="hint">
        Wird als <code>"model"</code> in <code>opencode.jsonc</code> eingetragen. Leer lassen bzw. eigenes Feld leer
        lassen heißt: opencode behält seine eigene Standard-Einstellung.
      </p>
    </div>
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

  .model-callout {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: 1.5px solid var(--owai-accent);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    background: var(--owai-accent-soft);
  }

  .model-callout-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  .model-callout-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--owai-accent);
    color: white;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
  }

  select {
    font-family: inherit;
    font-size: 1rem;
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem;
    background: var(--owai-bg);
    color: var(--owai-fg);
  }

  .hint {
    color: var(--owai-muted);
    font-size: 0.85rem;
    margin: 0;
  }

  code {
    font-size: 0.85em;
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
