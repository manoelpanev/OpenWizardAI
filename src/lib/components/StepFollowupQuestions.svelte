<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import type { FollowupAnswer, OnboardingAnswers, OnboardingRecommendation } from "../types";

  const questions = $derived($wizardStore.followupQuestions);

  let currentIndex = $state(0);
  let currentAnswer = $state("");
  let collected = $state<FollowupAnswer[]>([]);
  let requesting = $state(false);
  let error = $state("");

  onMount(() => {
    if (questions.length === 0) {
      void getRecommendation();
    }
  });

  function next() {
    collected = [...collected, { question: questions[currentIndex], answer: currentAnswer.trim() }];
    currentAnswer = "";

    if (currentIndex + 1 < questions.length) {
      currentIndex += 1;
    } else {
      void getRecommendation();
    }
  }

  function skipQuestion() {
    collected = [...collected, { question: questions[currentIndex], answer: "(übersprungen)" }];
    currentAnswer = "";

    if (currentIndex + 1 < questions.length) {
      currentIndex += 1;
    } else {
      void getRecommendation();
    }
  }

  async function getRecommendation() {
    requesting = true;
    error = "";

    const state = get(wizardStore);
    wizardStore.setFollowupAnswers(collected);

    const answers: OnboardingAnswers = {
      used_tools: state.usedTools,
      project_description: state.projectDescription,
      is_prototype: state.isPrototype,
      wants_custom_agent: state.wantsCustomAgent,
      custom_agent_description: state.customAgentDescription || null,
      followup_answers: collected,
    };

    try {
      const recommendation = await invoke<OnboardingRecommendation>("get_onboarding_recommendation", {
        answers,
        model: state.model,
      });
      wizardStore.setRecommendation(recommendation);
      wizardStore.goToStep("recommendation");
    } catch (e) {
      error = `Empfehlung konnte nicht abgerufen werden: ${e}`;
      requesting = false;
    }
  }
</script>

<section>
  {#if questions.length === 0}
    <p>Keine projektspezifischen Rückfragen — Empfehlung wird geholt…</p>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  {:else}
    <h2>Rückfrage {currentIndex + 1} von {questions.length}</h2>
    <p class="question">{questions[currentIndex]}</p>

    <label>
      Antwort
      <textarea bind:value={currentAnswer} rows="3" placeholder="Deine Antwort…"></textarea>
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" onclick={skipQuestion} disabled={requesting}>Überspringen</button>
      <button type="button" onclick={next} disabled={requesting || currentAnswer.trim().length === 0}>
        {requesting ? "Empfehlung wird geholt…" : currentIndex + 1 < questions.length ? "Weiter" : "Empfehlung abrufen"}
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

  .question {
    font-weight: 600;
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

  .error {
    color: var(--owai-danger);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
