<script lang="ts">
  import { wizardStore } from "../wizardStore";
  import { STORAGE_MODES } from "../types";
  import type { StorageMode } from "../types";

  let selected = $state<StorageMode>("LocalOnly");

  function next() {
    wizardStore.setStorageMode(selected);
    wizardStore.goToStep("connect");
  }
</script>

<section>
  <h2>Arbeitsweise</h2>
  <p>Wie soll mit diesem Projekt gearbeitet werden?</p>

  <div class="options">
    {#each STORAGE_MODES as mode (mode.value)}
      <label class="option" class:active={selected === mode.value}>
        <input
          type="radio"
          name="storage-mode"
          checked={selected === mode.value}
          onchange={() => (selected = mode.value)}
        />
        <span>
          <strong>{mode.label}</strong>
          <span class="option-description">{mode.description}</span>
        </span>
      </label>
    {/each}
  </div>

  {#if selected === "LocalAndGitHub" || selected === "GitHubOnly"}
    <p class="hint">
      GitHub-Verbindung (OAuth) und Repo-Erstellung sind noch nicht umgesetzt — dieser Modus ist bereits wählbar,
      wird aber vorerst wie „Nur lokal" behandelt.
    </p>
  {/if}

  <div class="actions">
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
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.5rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .option.active {
    border-color: var(--owai-accent);
  }

  .option-description {
    display: block;
    color: var(--owai-muted);
    font-size: 0.85rem;
    font-weight: 400;
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
