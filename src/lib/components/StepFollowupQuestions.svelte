<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import type { ClarityCheck, FollowupAnswer, OnboardingAnswers, OnboardingRecommendation } from "../types";

  // Lokale, erweiterbare Kopie der generierten Fragen — Klärungs-
  // Nachfragen werden hier direkt nach der aktuellen Frage eingefügt,
  // ohne den Store selbst zu verändern.
  let questions = $state<string[]>([]);
  let questionsInitialized = false;

  // Indizes, für die bereits eine Klärungsfrage eingefügt wurde — verhindert,
  // dass eine Klärungsfrage selbst wieder eine weitere auslöst (max. 1
  // Klärungs-Nachfrage pro Basisfrage, wie festgelegt).
  let clarifiedIndices = $state<Set<number>>(new Set());

  let currentIndex = $state(0);
  let currentAnswer = $state("");
  let collected = $state<FollowupAnswer[]>([]);
  let requesting = $state(false);
  let checkingClarity = $state(false);
  let error = $state("");

  onMount(() => {
    if (!questionsInitialized) {
      questions = [...get(wizardStore).followupQuestions];
      questionsInitialized = true;
    }
    if (questions.length === 0) {
      void getRecommendation();
    }
  });

  async function checkClarityAndAdvance(answer: string) {
    const question = questions[currentIndex];
    const answeredIndex = currentIndex;
    collected = [...collected, { question, answer }];
    currentAnswer = "";

    const alreadyClarified = clarifiedIndices.has(answeredIndex);

    if (!alreadyClarified) {
      const state = get(wizardStore);
      checkingClarity = true;
      try {
        const clarity = await invoke<ClarityCheck>("check_answer_clarity", {
          question,
          answer,
          model: state.model,
        });
        if (!clarity.is_clear && clarity.clarifying_question.trim().length > 0) {
          questions = [
            ...questions.slice(0, answeredIndex + 1),
            clarity.clarifying_question,
            ...questions.slice(answeredIndex + 1),
          ];
          clarifiedIndices = new Set([...clarifiedIndices, answeredIndex + 1]);
        }
      } catch {
        // Klarheits-Check ist ein Komfort-Feature — schlägt er fehl, geht
        // der Flow normal weiter statt zu blockieren.
      } finally {
        checkingClarity = false;
      }
    }

    if (currentIndex + 1 < questions.length) {
      currentIndex += 1;
    } else {
      void getRecommendation();
    }
  }

  function next() {
    void checkClarityAndAdvance(currentAnswer.trim());
  }

  function skipQuestion() {
    void checkClarityAndAdvance("(übersprungen)");
  }

  async function getRecommendation() {
    requesting = true;
    error = "";

    const state = get(wizardStore);
    wizardStore.setFollowupAnswers(collected);

    const answers: OnboardingAnswers = {
      is_new_project: state.isNewProject,
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

  const busy = $derived(requesting || checkingClarity);
  const progressPercent = $derived(
    questions.length === 0 ? 0 : Math.round(((currentIndex + 1) / questions.length) * 100)
  );
</script>

<section>
  {#if questions.length === 0}
    <p>Keine projektspezifischen Rückfragen — Empfehlung wird geholt…</p>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  {:else}
    <h2>Rückfrage {currentIndex + 1} von {questions.length}</h2>

    <div class="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
      <div class="progress-fill" style="width: {progressPercent}%"></div>
    </div>

    <p class="question">{questions[currentIndex]}</p>

    <label>
      Antwort
      <textarea bind:value={currentAnswer} rows="3" placeholder="Deine Antwort…"></textarea>
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" onclick={skipQuestion} disabled={busy}>Überspringen</button>
      <button type="button" onclick={next} disabled={busy || currentAnswer.trim().length === 0}>
        {#if checkingClarity}
          Prüfe Antwort…
        {:else if requesting}
          Empfehlung wird geholt…
        {:else if currentIndex + 1 < questions.length}
          Weiter
        {:else}
          Empfehlung abrufen
        {/if}
      </button>
    </div>
  {/if}

  {#if requesting}
    <div class="progress-track indeterminate" aria-label="Empfehlung wird geladen">
      <div class="progress-fill-indeterminate"></div>
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

  .progress-track {
    height: 6px;
    border-radius: 3px;
    background: var(--owai-border);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--owai-accent);
    transition: width 0.3s ease;
  }

  .progress-track.indeterminate {
    position: relative;
  }

  .progress-fill-indeterminate {
    position: absolute;
    inset: 0;
    width: 40%;
    background: var(--owai-accent);
    animation: indeterminate 1.1s ease-in-out infinite;
  }

  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(350%);
    }
  }
</style>
