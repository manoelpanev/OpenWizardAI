<script lang="ts">
  import { wizardStore } from "../wizardStore";

  type AgentMode = "none" | "custom" | "ai-suggested";

  let mode = $state<AgentMode>("none");
  let description = $state("");

  function next() {
    // Bei "ai-suggested" bleibt die Beschreibung leer — die
    // Empfehlungs-Engine schlägt dann selbst einen passenden Agenten vor
    // (siehe custom_agent in OnboardingRecommendation).
    wizardStore.setCustomAgentAnswer(mode !== "none", mode === "custom" ? description : "");
    wizardStore.goToStep("questions");
  }

  const canProceed = $derived(mode !== "custom" || description.trim().length > 0);
</script>

<section>
  <h2>0b. Custom-Agent einrichten?</h2>
  <p>Möchtest du dir zusätzlich einen eigenen Agenten für dieses Projekt einrichten lassen?</p>

  <div class="options">
    <label class="option" class:active={mode === "none"}>
      <input type="radio" name="wants-agent" checked={mode === "none"} onchange={() => (mode = "none")} />
      Nein, kein Custom-Agent
    </label>
    <label class="option" class:active={mode === "custom"}>
      <input type="radio" name="wants-agent" checked={mode === "custom"} onchange={() => (mode = "custom")} />
      <span>
        <strong>Ja, individuell</strong>
        <span class="option-description">Ich beschreibe selbst, was der Agent können soll.</span>
      </span>
    </label>
    <label class="option" class:active={mode === "ai-suggested"}>
      <input
        type="radio"
        name="wants-agent"
        checked={mode === "ai-suggested"}
        onchange={() => (mode = "ai-suggested")}
      />
      <span>
        <strong>Ja, die KI soll vorschlagen</strong>
        <span class="option-description">
          DeepSeek analysiert das Projekt und schlägt selbst vor, was der Agent können soll — im
          Empfehlungs-Screen danach editierbar.
        </span>
      </span>
    </label>
  </div>

  {#if mode === "custom"}
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

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
