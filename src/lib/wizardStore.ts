import { writable } from "svelte/store";
import type { HitlLevel, OnboardingRecommendation, WriteOutcome } from "./types";

export type WizardStep =
  | "connect"
  | "agent-question"
  | "questions"
  | "recommendation"
  | "tools"
  | "hitl"
  | "summary";

export interface WizardState {
  step: WizardStep;
  deepSeekConnected: boolean;
  wantsCustomAgent: boolean;
  customAgentDescription: string;
  usedTools: string[];
  projectDescription: string;
  isPrototype: boolean;
  recommendation: OnboardingRecommendation | null;
  projectName: string;
  projectRoot: string;
  selectedToolIds: string[];
  hitlLevel: HitlLevel;
  outcomes: WriteOutcome[] | null;
}

function initialState(): WizardState {
  return {
    step: "connect",
    deepSeekConnected: false,
    wantsCustomAgent: false,
    customAgentDescription: "",
    usedTools: [],
    projectDescription: "",
    isPrototype: true,
    recommendation: null,
    projectName: "",
    projectRoot: "",
    selectedToolIds: [],
    hitlLevel: "AskOnRisky",
    outcomes: null,
  };
}

function createWizardStore() {
  const { subscribe, update, set } = writable<WizardState>(initialState());

  return {
    subscribe,
    setDeepSeekConnected(connected: boolean) {
      update((s) => ({ ...s, deepSeekConnected: connected }));
    },
    setCustomAgentAnswer(wants: boolean, description: string) {
      update((s) => ({ ...s, wantsCustomAgent: wants, customAgentDescription: description }));
    },
    setOnboardingAnswers(usedTools: string[], projectDescription: string, isPrototype: boolean) {
      update((s) => ({ ...s, usedTools, projectDescription, isPrototype }));
    },
    setRecommendation(recommendation: OnboardingRecommendation) {
      update((s) => ({
        ...s,
        recommendation,
        selectedToolIds: recommendation.recommended_tool_ids.value,
        hitlLevel: recommendation.recommended_hitl_level.value,
      }));
    },
    setProjectBasics(projectName: string, projectRoot: string) {
      update((s) => ({ ...s, projectName, projectRoot }));
    },
    setSelectedTools(ids: string[]) {
      update((s) => ({ ...s, selectedToolIds: ids }));
    },
    setHitlLevel(level: HitlLevel) {
      update((s) => ({ ...s, hitlLevel: level }));
    },
    setOutcomes(outcomes: WriteOutcome[]) {
      update((s) => ({ ...s, outcomes }));
    },
    goToStep(step: WizardStep) {
      update((s) => ({ ...s, step }));
    },
    reset() {
      set(initialState());
    },
  };
}

export const wizardStore = createWizardStore();
