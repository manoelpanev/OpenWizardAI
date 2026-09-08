<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import { HITL_LEVELS } from "../types";
  import type { HitlLevel, ToolInfo } from "../types";

  const recommendation = $derived($wizardStore.recommendation);

  let tools = $state<ToolInfo[]>([]);
  let selectedToolIds = $state<Set<string>>(new Set());
  let hitlLevel = $state<HitlLevel>(get(wizardStore).hitlLevel);
  let pluginTagsText = $state(get(wizardStore).editablePluginTags.join(", "));
  let hasAgent = $state(get(wizardStore).editableCustomAgent !== null);
  let agentName = $state(get(wizardStore).editableCustomAgent?.name ?? "");
  let agentDescription = $state(get(wizardStore).editableCustomAgent?.description ?? "");

  onMount(async () => {
    selectedToolIds = new Set(get(wizardStore).selectedToolIds);
    tools = await invoke<ToolInfo[]>("list_supported_tools");
  });

  function toggleTool(id: string) {
    const next = new Set(selectedToolIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedToolIds = next;
  }

  function commitEdits() {
    wizardStore.setSelectedTools(Array.from(selectedToolIds));
    wizardStore.setHitlLevel(hitlLevel);
    wizardStore.setEditablePluginTags(
      pluginTagsText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    );
    wizardStore.setEditableCustomAgent(
      hasAgent ? { name: agentName.trim(), description: agentDescription.trim() } : null
    );
  }

  function acceptAndContinue() {
    commitEdits();
    // Wenn eine KI-Empfehlung vorliegt, ist die gesamte Konfiguration
    // bereits hier auf einem Screen erledigt — die separaten Tool-/HITL-
    // Schritte werden übersprungen, direkt weiter zu Projektname/Ordner.
    wizardStore.goToStep("tools");
  }
</script>

<section>
  <h2>KI-Empfehlung — direkt anpassbar</h2>

  {#if recommendation}
    <div class="rec-block">
      <h3>Tools</h3>
      <p class="reasoning">{recommendation.recommended_tool_ids.reasoning}</p>
      <fieldset>
        {#each tools as tool (tool.id)}
          <label class="tool-option">
            <input
              type="checkbox"
              checked={selectedToolIds.has(tool.id)}
              onchange={() => toggleTool(tool.id)}
            />
            {tool.display_name}
          </label>
        {/each}
      </fieldset>
    </div>

    <div class="rec-block">
      <h3>Rückfrage-Verhalten</h3>
      <p class="reasoning">{recommendation.recommended_hitl_level.reasoning}</p>
      <div class="options">
        {#each HITL_LEVELS as level (level.value)}
          <label class="option" class:active={hitlLevel === level.value}>
            <input type="radio" name="hitl" value={level.value} bind:group={hitlLevel} />
            <span class="option-label">{level.label}</span>
            <span class="option-desc">{level.description}</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="rec-block">
      <h3>Passende Plugin-Themen</h3>
      <p class="reasoning">{recommendation.recommended_plugin_tags.reasoning}</p>
      <label>
        Themen (kommagetrennt)
        <input type="text" bind:value={pluginTagsText} placeholder="z.B. testing, security" />
      </label>
    </div>

    <div class="rec-block">
      <h3>Custom-Agent</h3>
      {#if recommendation.custom_agent}
        <p class="reasoning">{recommendation.custom_agent.reasoning}</p>
      {/if}
      <label class="checkbox-row">
        <input type="checkbox" bind:checked={hasAgent} />
        Custom-Agent einrichten
      </label>
      {#if hasAgent}
        <label>
          Name
          <input type="text" bind:value={agentName} placeholder="Agent-Name" />
        </label>
        <label>
          Beschreibung
          <textarea bind:value={agentDescription} rows="2"></textarea>
        </label>
      {/if}
    </div>

    <div class="actions">
      <button type="button" onclick={acceptAndContinue}>Weiter</button>
    </div>
  {:else}
    <p class="error">Keine Empfehlung vorhanden.</p>
    <div class="actions">
      <button type="button" onclick={acceptAndContinue}>Weiter</button>
    </div>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 32rem;
  }

  .rec-block {
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .rec-block h3 {
    margin: 0;
    font-size: 0.95rem;
  }

  .reasoning {
    margin: 0;
    color: var(--owai-muted);
    font-size: 0.85rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
  }

  .checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  input[type="text"] {
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem;
    background: var(--owai-bg);
    color: var(--owai-fg);
    font-family: inherit;
  }

  textarea {
    font-family: inherit;
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem;
    background: var(--owai-bg);
    color: var(--owai-fg);
    resize: vertical;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border: none;
    padding: 0;
    margin: 0;
  }

  .tool-option {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .option {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.5rem;
    row-gap: 0.1rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    cursor: pointer;
  }

  .option.active {
    border-color: var(--owai-accent);
  }

  .option-label {
    font-weight: 600;
  }

  .option-desc {
    grid-column: 2;
    font-size: 0.85rem;
    color: var(--owai-muted);
  }

  .error {
    color: var(--owai-danger);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
