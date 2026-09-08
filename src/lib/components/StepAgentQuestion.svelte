<script lang="ts">
  import { wizardStore } from "../wizardStore";

  let wants = $state(false);
  let description = $state("");

  function next() {
    wizardStore.setCustomAgentAnswer(wants, wants ? description : "");
    wizardStore.goToStep("questions");
  }

  const canProceed = $derived(!wants || description.trim().length > 0);
</script>

<section>
  <h2>0b. Custom-Agent einrichten?</h2>
  <p>Möchtest du dir zusätzlich einen eigenen Agenten für dieses Projekt einrichten lassen?</p>

  <div class="options">
    <label class="option" class:active={!wants}>
      <input type="radio" name="wants-agent" checked={!wants} onchange={() => (wants = false)} />
      Nein, kein Custom-Agent
    </label>
    <label class="option" class:active={wants}>
      <input type="radio" name="wants-agent" checked={wants} onchange={() => (wants = true)} />
      Ja, ich möchte einen einrichten
    </label>
  </div>

  {#if wants}
    <label>
      Was soll der Agent können?
      <textarea bind:value={description} rows="3" placeholder="z.B. ein Agent, der PRs auf fehlende Tests prüft"></textarea>
    </label>
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

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
