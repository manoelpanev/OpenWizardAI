<script lang="ts">
  import { wizardStore } from "../lib/wizardStore";
  import StepProjectStatus from "../lib/components/StepProjectStatus.svelte";
  import StepStorageMode from "../lib/components/StepStorageMode.svelte";
  import StepConnect from "../lib/components/StepConnect.svelte";
  import StepAgentQuestion from "../lib/components/StepAgentQuestion.svelte";
  import StepQuestions from "../lib/components/StepQuestions.svelte";
  import StepFollowupQuestions from "../lib/components/StepFollowupQuestions.svelte";
  import StepRecommendation from "../lib/components/StepRecommendation.svelte";
  import StepToolSelect from "../lib/components/StepToolSelect.svelte";
  import StepHitlLevel from "../lib/components/StepHitlLevel.svelte";
  import StepSummary from "../lib/components/StepSummary.svelte";
  import ThemeToggle from "../lib/components/ThemeToggle.svelte";
  import ApiRegistry from "../lib/components/ApiRegistry.svelte";
  import WizardShell from "../lib/components/WizardShell.svelte";

  const step = $derived($wizardStore.step);

  // Die API-Verwaltung liegt neben dem Wizard-Flow, nicht darin — sie ist
  // kein Schritt, sondern jederzeit erreichbar und kehrt danach an genau
  // die Stelle zurück, an der der Nutzer war.
  let showApiRegistry = $state(false);

  const STEP_LABELS: Record<string, string> = {
    "project-status": "Projekt-Status",
    "storage-mode": "Arbeitsweise",
    connect: "DeepSeek verbinden",
    "agent-question": "Custom-Agent",
    questions: "Basis-Fragen",
    "followup-questions": "Gezielte Rückfragen",
    recommendation: "Empfehlung",
    tools: "Projekt",
    hitl: "Rückfrage-Verhalten",
    summary: "Zusammenfassung",
  };
</script>

<div class="page">
  <main class="container">
    <header>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <h1>OpenWizardAI</h1>
      </div>
      <div class="header-actions">
        <button type="button" class="ghost-button" onclick={() => (showApiRegistry = !showApiRegistry)}>
          {showApiRegistry ? "Zurück zum Wizard" : "Eigene APIs"}
        </button>
        <ThemeToggle />
      </div>
    </header>

    <div class="card">
      {#if showApiRegistry}
        <ApiRegistry />
      {:else}
        <WizardShell label={STEP_LABELS[step]} />

        {#if step === "project-status"}
          <StepProjectStatus />
        {:else if step === "storage-mode"}
          <StepStorageMode />
        {:else if step === "connect"}
          <StepConnect />
        {:else if step === "agent-question"}
          <StepAgentQuestion />
        {:else if step === "questions"}
          <StepQuestions />
        {:else if step === "followup-questions"}
          <StepFollowupQuestions />
        {:else if step === "recommendation"}
          <StepRecommendation />
        {:else if step === "tools"}
          <StepToolSelect />
        {:else if step === "hitl"}
          <StepHitlLevel />
        {:else}
          <StepSummary />
        {/if}
      {/if}
    </div>
  </main>
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    justify-content: center;
  }

  .container {
    width: 100%;
    max-width: 42rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .brand-mark {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--owai-accent), var(--owai-accent-strong));
    box-shadow: 0 0 0 1px var(--owai-accent-soft);
    flex-shrink: 0;
  }

  h1 {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .card {
    background: var(--owai-surface);
    border: 1px solid var(--owai-border);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 1px 2px rgba(23, 21, 43, 0.04);
  }

  @media (max-width: 30rem) {
    .card {
      padding: 1.25rem;
      border-radius: 12px;
    }
  }
</style>
