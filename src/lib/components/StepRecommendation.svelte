<script lang="ts">
  import { wizardStore } from "../wizardStore";
  import { HITL_LEVELS } from "../types";

  const recommendation = $derived($wizardStore.recommendation);
  const hitlLabel = $derived(
    recommendation
      ? HITL_LEVELS.find((l) => l.value === recommendation.recommended_hitl_level.value)?.label ??
        recommendation.recommended_hitl_level.value
      : ""
  );

  function acceptAndContinue() {
    // Empfehlung wurde bereits in wizardStore.setRecommendation() als
    // selectedToolIds/hitlLevel übernommen — Schritt 1 (Tool-Auswahl)
    // zeigt sie dort vorausgefüllt an und bleibt manuell überschreibbar.
    wizardStore.goToStep("tools");
  }

  function skipToManual() {
    wizardStore.setSelectedTools([]);
    wizardStore.setHitlLevel("AskOnRisky");
    wizardStore.goToStep("tools");
  }
</script>

<section>
  <h2>KI-Empfehlung</h2>

  {#if recommendation}
    <div class="rec-block">
      <h3>Empfohlene Tools</h3>
      <p class="rec-value">{recommendation.recommended_tool_ids.value.join(", ") || "keine"}</p>
      <p class="reasoning">{recommendation.recommended_tool_ids.reasoning}</p>
    </div>

    <div class="rec-block">
      <h3>Rückfrage-Verhalten</h3>
      <p class="rec-value">{hitlLabel}</p>
      <p class="reasoning">{recommendation.recommended_hitl_level.reasoning}</p>
    </div>

    <div class="rec-block">
      <h3>Passende Plugin-Themen</h3>
      <p class="rec-value">{recommendation.recommended_plugin_tags.value.join(", ") || "keine"}</p>
      <p class="reasoning">{recommendation.recommended_plugin_tags.reasoning}</p>
    </div>

    {#if recommendation.custom_agent}
      <div class="rec-block">
        <h3>Custom-Agent: {recommendation.custom_agent.name}</h3>
        <p class="rec-value">{recommendation.custom_agent.description}</p>
        <p class="reasoning">{recommendation.custom_agent.reasoning}</p>
      </div>
    {/if}

    <p class="hint">
      Diese Empfehlung ist im nächsten Schritt vorausgefüllt und bleibt dort
      einzeln anpassbar.
    </p>

    <div class="actions">
      <button type="button" onclick={skipToManual}>Ignorieren, manuell wählen</button>
      <button type="button" onclick={acceptAndContinue}>Übernehmen & weiter</button>
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
  }

  .rec-block h3 {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
  }

  .rec-value {
    margin: 0 0 0.25rem 0;
    font-weight: 600;
  }

  .reasoning {
    margin: 0;
    color: var(--owai-muted);
    font-size: 0.85rem;
  }

  .hint {
    color: var(--owai-muted);
    font-size: 0.85rem;
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
