<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { wizardStore } from "../wizardStore";
  import type { OnboardingAnswers, ToolInfo } from "../types";
  import { get } from "svelte/store";

  type SubStep = "used-tools" | "vorhaben" | "prototype";

  let subStep = $state<SubStep>("used-tools");
  let tools = $state<ToolInfo[]>([]);
  let usedTools = $state<Set<string>>(new Set());
  let projectDescription = $state("");
  let isPrototype = $state(true);
  let loadingTools = $state(true);
  let requesting = $state(false);
  let error = $state("");

  onMount(async () => {
    try {
      tools = await invoke<ToolInfo[]>("list_supported_tools");
    } finally {
      loadingTools = false;
    }
  });

  function toggleUsedTool(id: string) {
    const next = new Set(usedTools);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    usedTools = next;
  }

  async function finish() {
    requesting = true;
    error = "";

    const state = get(wizardStore);
    const answers: OnboardingAnswers = {
      is_new_project: state.isNewProject,
      used_tools: Array.from(usedTools),
      project_description: projectDescription,
      is_prototype: isPrototype,
      wants_custom_agent: state.wantsCustomAgent,
      custom_agent_description: state.customAgentDescription || null,
      followup_answers: [],
    };

    wizardStore.setOnboardingAnswers(answers.used_tools, answers.project_description, answers.is_prototype);

    try {
      const questions = await invoke<string[]>("generate_followup_questions", {
        answers,
        model: state.model,
      });
      wizardStore.setFollowupQuestions(questions);
      wizardStore.goToStep("followup-questions");
    } catch (e) {
      error = `Rückfragen konnten nicht generiert werden: ${e}`;
    } finally {
      requesting = false;
    }
  }
</script>

<section>
  {#if subStep === "used-tools"}
    <h2>1. Welche KI-Tools nutzt du bereits?</h2>
    {#if loadingTools}
      <p>Lade Tools…</p>
    {:else}
      <fieldset>
        <legend>Auswahl optional — hilft bei der Empfehlung.</legend>
        {#each tools as tool (tool.id)}
          <label class="tool-option">
            <input
              type="checkbox"
              checked={usedTools.has(tool.id)}
              onchange={() => toggleUsedTool(tool.id)}
            />
            {tool.display_name}
          </label>
        {/each}
      </fieldset>
    {/if}
    <div class="actions">
      <button type="button" onclick={() => (subStep = "vorhaben")}>Weiter</button>
    </div>
  {:else if subStep === "vorhaben"}
    <h2>2. Was ist dein Vorhaben?</h2>
    <label>
      Kurze Beschreibung
      <textarea bind:value={projectDescription} rows="3" placeholder="z.B. eine REST-API für eine Todo-App in Rust"></textarea>
    </label>
    <div class="actions">
      <button type="button" onclick={() => (subStep = "used-tools")}>Zurück</button>
      <button type="button" disabled={projectDescription.trim().length === 0} onclick={() => (subStep = "prototype")}>
        Weiter
      </button>
    </div>
  {:else}
    <h2>3. Prototyp oder Produktions-Code?</h2>
    <div class="options">
      <label class="option" class:active={isPrototype}>
        <input type="radio" name="prototype" checked={isPrototype} onchange={() => (isPrototype = true)} />
        Prototyp — schnell ausprobieren
      </label>
      <label class="option" class:active={!isPrototype}>
        <input type="radio" name="prototype" checked={!isPrototype} onchange={() => (isPrototype = false)} />
        Produktions-Code — soll stabil laufen
      </label>
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" onclick={() => (subStep = "vorhaben")} disabled={requesting}>Zurück</button>
      <button type="button" onclick={finish} disabled={requesting}>
        {requesting ? "Rückfragen werden erstellt…" : "Weiter"}
      </button>
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

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
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
    gap: 0.5rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 1rem;
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

  .error {
    color: var(--owai-danger);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
