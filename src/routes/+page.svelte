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

  const step = $derived($wizardStore.step);

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

<main class="container">
  <header>
    <h1>OpenWizardAI</h1>
    <ThemeToggle />
  </header>

  <p class="step-indicator">{STEP_LABELS[step]}</p>

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
</main>

<style>
  .container {
    max-width: 40rem;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: 1.4rem;
    margin: 0;
  }

  .step-indicator {
    color: var(--owai-muted);
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }
</style>
