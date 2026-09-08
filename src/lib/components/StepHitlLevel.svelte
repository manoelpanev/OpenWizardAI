<script lang="ts">
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import { HITL_LEVELS } from "../types";
  import type { HitlLevel } from "../types";

  let selected = $state<HitlLevel>(get(wizardStore).hitlLevel);

  function back() {
    wizardStore.goToStep("tools");
  }

  function next() {
    wizardStore.setHitlLevel(selected);
    wizardStore.goToStep("summary");
  }
</script>

<section>
  <h2>2. Rückfrage-Verhalten</h2>
  <p>Wie viel sollen die KI-Tools in diesem Projekt selbstständig entscheiden dürfen?</p>

  <div class="options" role="radiogroup" aria-label="HITL-Stufe">
    {#each HITL_LEVELS as level (level.value)}
      <label class="option" class:active={selected === level.value}>
        <input type="radio" name="hitl" value={level.value} bind:group={selected} />
        <span class="option-label">{level.label}</span>
        <span class="option-desc">{level.description}</span>
      </label>
    {/each}
  </div>

  <div class="actions">
    <button type="button" onclick={back}>Zurück</button>
    <button type="button" onclick={next}>Weiter</button>
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
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.5rem;
    row-gap: 0.1rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
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
    font-size: 0.9rem;
    color: var(--owai-muted);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
