<script lang="ts">
  import { wizardStore } from "../lib/wizardStore";
  import StepToolSelect from "../lib/components/StepToolSelect.svelte";
  import StepHitlLevel from "../lib/components/StepHitlLevel.svelte";
  import StepSummary from "../lib/components/StepSummary.svelte";
  import ThemeToggle from "../lib/components/ThemeToggle.svelte";

  const step = $derived($wizardStore.step);
</script>

<main class="container">
  <header>
    <h1>OpenWizardAI</h1>
    <ThemeToggle />
  </header>

  <p class="step-indicator">Schritt {step} von 3</p>

  {#if step === 1}
    <StepToolSelect />
  {:else if step === 2}
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
