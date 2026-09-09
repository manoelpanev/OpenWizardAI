<script lang="ts">
  import { wizardStore } from "../wizardStore";

  let { label }: { label: string } = $props();

  const history = $derived($wizardStore.history);
  const recommendationUsed = $derived($wizardStore.recommendation !== null);

  // Die Gesamtschrittzahl hängt vom Pfad ab: der KI-Pfad läuft über
  // connect → agent-question → questions → followup-questions →
  // recommendation → summary (8 Stationen insgesamt), der manuelle Pfad
  // über connect → tools → hitl → summary (6 Stationen). "questions"/
  // "followup-questions" zählen als eine Station, obwohl sie intern
  // mehrere Unterschritte haben — die Sub-Navigation dort zeigt ihren
  // eigenen Fortschritt separat an.
  const KI_PATH_LENGTH = 8;
  const MANUAL_PATH_LENGTH = 6;

  const usesAiPath = $derived(
    history.includes("agent-question") || history.includes("followup-questions") || recommendationUsed
  );

  const totalSteps = $derived(usesAiPath ? KI_PATH_LENGTH : MANUAL_PATH_LENGTH);
  const currentPosition = $derived(Math.min(history.length, totalSteps));
  const progressPercent = $derived(Math.round((currentPosition / totalSteps) * 100));

  const canGoBack = $derived(history.length > 1);

  function back() {
    wizardStore.goBack();
  }
</script>

<div class="shell-header">
  <div class="shell-nav">
    {#if canGoBack}
      <button type="button" class="back-button" onclick={back} aria-label="Zurück">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            d="M12.5 4.5 7 10l5.5 5.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Zurück
      </button>
    {/if}
    <span class="step-label">{label}</span>
    <span class="step-count">Schritt {currentPosition} von {totalSteps}</span>
  </div>

  <div class="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
    <div class="progress-fill" style="width: {progressPercent}%"></div>
  </div>
</div>

<style>
  .shell-header {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 1.75rem;
  }

  .shell-nav {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 1.75rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    padding: 0.2rem 0.4rem 0.2rem 0.1rem;
    margin: 0 0 0 -0.4rem;
    color: var(--owai-muted);
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 6px;
  }

  .back-button:hover {
    color: var(--owai-accent);
    background: var(--owai-accent-soft);
  }

  .step-label {
    font-weight: 600;
    font-size: 0.95rem;
    flex: 1;
  }

  .step-count {
    color: var(--owai-muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .progress-track {
    height: 5px;
    border-radius: 999px;
    background: var(--owai-border);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--owai-accent), var(--owai-accent-strong));
    border-radius: 999px;
    transition: width 0.3s ease;
  }
</style>
